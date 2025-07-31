# utils.py
import re
from typing import List
from config import GLYPH_RE
from extractors import header_re, next_header

def normalize_string(s: str) -> str:
    """Lowercase, strip punctuation and collapse whitespace."""
    return re.sub(r'[^\w\s]', '', s).strip().lower()

def custom_tokenizer(text: str) -> List[str]:
    """
    Split a semicolon‑delimited 'skill:score' string into raw skill names.
    E.g. "asp net:1.00; angular js:1.00" → ["asp net", "angular js"]
    """
    tokens: List[str] = []
    for seg in text.split(';'):
        seg = seg.strip()
        if not seg:
            continue
        tokens.append(seg.split(':', 1)[0].strip())
    return tokens

def split_outside_parens(s: str) -> List[str]:
    """Split on commas not enclosed in parentheses."""
    parts: List[str] = []
    buf = ''
    depth = 0
    for ch in s:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(0, depth - 1)
        if ch == ',' and depth == 0:
            parts.append(buf.strip())
            buf = ''
        else:
            buf += ch
    if buf.strip():
        parts.append(buf.strip())
    return parts

def merge_continuations(lines: List[str]) -> List[str]:
    """Merge lines broken by bullets or wrapped formatting."""
    merged: List[str] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        # If it has a colon, merge following continuation lines
        if ':' in ln:
            blk = ln
            j = i + 1
            while j < len(lines):
                nxt = lines[j]
                if header_re.match(nxt) or next_header.match(nxt):
                    break
                if (',' in nxt or len(nxt.split()) == 1) and ':' not in nxt:
                    blk += ' ' + nxt
                    j += 1
                    continue
                break
            merged.append(blk)
            i = j
            continue

        # simple comma‑wrapped lines
        if ',' in ln and i + 1 < len(lines):
            nxt = lines[i + 1]
            if (',' in nxt or len(nxt.split()) == 1) and ':' not in nxt:
                ln = f"{ln} {nxt}"
                i += 1

        merged.append(ln)
        i += 1
    return merged

def parse_skills(lines: List[str]) -> List[str]:
    """Tokenize each line into individual skill strings."""
    tokens: List[str] = []
    for ln in merge_continuations(lines):
        clean = ln.strip()
        if ':' in clean:
            parts = split_outside_parens(clean.split(':', 1)[1])
        elif '|' in clean:
            parts = [p.strip() for p in clean.split('|') if p.strip()]
        elif ',' in clean:
            parts = split_outside_parens(clean)
        else:
            parts = [clean]

        for part in parts:
            tok = re.sub(r'^[^\w]+', '', part)
            tok = re.sub(r'[^\w\s]+$', '', tok)
            tok = re.sub(r'\s+', ' ', tok).strip()
            if tok:
                tokens.append(tok)
    return tokens

# extractors.py
import re
import pdfplumber
from typing import List
from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph
from config import BOX_CHARS

# Header & stopping regexes
header_re = re.compile(
    r'^\s*[-•\*]?\s*'
    r'(?:primary\s*/\s*additional\s+skills'
    r'|additional\s+skills'
    r'|technology\s+skill\s+set\s+summary'
    r'|skill\s+set\s+summary'
    r'|skills?\s+summary'
    r'|skills?'
    r'|technical\s+skills'
    r'|TECHNICALSKILLS'
    r'|technical\s+skill'
    r'|technical\s+skill\s+set'
    r'|key\s+skills'
    r'|skills\s+profile'
    r'|areas\s+of\s+expertise'
    r'|technical\s+competencies\s*/\s*skills'
    r'|technical\s+skills\s*(?:&|and)\s*tools'
    r'|technical\s+skills\s*(?:&|and)\s*COMPETENCIES'
    r'|technical\s*/\s*Software\s+Exposure'
    r'|skills\s*(?:&|and)\s*(?:tools|technologies)'
    r'|core\s+competencies'
    r'|SKILLS\s*(?:&|and)\s*COMPETENCIES'
    r'|Tools\s*(?:&|and)\s*Technology'
    r'|SKILLS\s*(?:&|and)\s*ABILITIES'
    r'|core\s+skills'
    r'|technical\s*(?:proficiencies|proficiency)'
    r'|technical\s+expertise'
    r'|professional\s+skills'
    r'|it\s+skills'
    r'|relevant\s+skills'
    r'|Skill\s+set'
    r'|Top\s+Skills'
    r'|TECHNOLOGY\s+COMPETENCIES'
    r'|SOFTWARE\s+SKILLS'
    r'|expertise'
    r')\s*:?\s*$',
    re.IGNORECASE
)

next_header = re.compile(
    r'^\s*(?:Education|Responsibilities|Educational Qualification|Professional\s+Experience|PERSONAL DETAILS|ACADEMIC PERFORMANCE|Experience|Projects?'
    r'|Publications|Certifications|Volunteering|Awards|Interests|Work History|Career Profile|Academic Profile|Employment Profile'
    r'|Work\s+experience|Date|NON TECHNICAL SKILLS|Sincerely|Regards|SUMMARY|PERSONAL\s+INTERESTS|CAREER\s+TIMELINE|hobbies'
    r'|CAREER SUMMARY|Professional Summary|Academic Details|LATEST PROJECT EXPERIENCE|KEY ENGAGEMENTS|Professional Timeline'
    r'|ACADEMIC INFORMATION|WORKING EXPERIENCE|Educational Details|KEY\s+ROLES\s*(?:&|and)\s*RESPONSIBILITIES|WORKEXPERIENCE)\b',
    re.IGNORECASE
)

def extract_section_docx(path: str) -> List[str]:
    """Extract the raw lines of the Skills section from a DOCX resume."""
    doc = Document(path)
    sec: List[str] = []
    cap = False

    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            p = Paragraph(child, doc)
            raw = p.text or ''
            if any(ch in raw for ch in BOX_CHARS) or not raw.strip():
                continue
            txt = raw.strip().lstrip('⚫●•*-▪').strip()

            if not cap:
                if header_re.match(txt):
                    cap = True
                continue

            if next_header.match(txt):
                break

            sec.append(txt)

        elif isinstance(child, CT_Tbl):
            tbl = Table(child, doc)

            # Look for header row
            if not cap:
                found = any(
                    header_re.match(cell.text.strip())
                    for row in tbl.rows for cell in row.cells
                )
                if not found:
                    continue
                cap = True

            for row in tbl.rows:
                cells = [
                    c.text.strip()
                    for c in row.cells
                    if c.text.strip() and not any(ch in c.text for ch in BOX_CHARS)
                ]
                if not cells:
                    continue
                if any(header_re.match(c) for c in cells):
                    continue
                if len(cells) == 2:
                    sec.append(f"{cells[0]}: {cells[1]}")
                else:
                    sec.extend(cells)
            break

    return sec

def extract_lines_pdf(path: str) -> List[str]:
    """Extract cleaned lines from PDF pages."""
    out: List[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for ln in text.split('\n'):
                for frag in re.split(r'\s{2,}', ln):
                    raw = frag.strip()
                    if any(ch in raw for ch in BOX_CHARS):
                        continue
                    f = raw.lstrip('⚫●•*-▪').strip()
                    if f and not re.match(r'^\d+ of \d+', f):
                        out.append(f)
    return out

def extract_table_pdf(path: str) -> List[str]:
    """Fallback: extract the first table under the Skills header in PDF."""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            if not any(
                header_re.match(ln.strip())
                for ln in (page.extract_text() or "").split('\n')
            ):
                continue
            tables = page.extract_tables()
            if not tables:
                return []
            out: List[str] = []
            for row in tables[0]:
                cells = [
                    c.strip() for c in row
                    if c and not any(ch in c for ch in BOX_CHARS)
                ]
                if not cells:
                    continue
                if len(cells) == 2:
                    out.append(f"{cells[0]}: {cells[1]}")
                else:
                    out.extend(cells)
            return out
    return []

def extract_section_pdf(path: str) -> List[str]:
    """Extract the raw lines of the Skills section from a PDF resume."""
    lines = extract_lines_pdf(path)
    sec: List[str] = []
    cap = False
    for ln in lines:
        if not cap:
            if header_re.match(ln):
                cap = True
            continue
        if next_header.match(ln):
            break
        sec.append(ln)

    if not sec:
        sec = extract_table_pdf(path) or []
    return sec

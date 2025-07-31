# routes/extract_skills.py
import os
import tempfile
import re
from flask import Blueprint, request, jsonify
from extractors import extract_section_pdf, extract_section_docx
from config import BOX_CHARS, GLYPH_RE, MIN_LENGTH, FUZZY_THRESHOLD
from utils import parse_skills, normalize_string
from data_loader import norm_skills
from rapidfuzz import fuzz

extract_skills_bp = Blueprint('extract_skills', __name__)

@extract_skills_bp.route('/extract_skills', methods=['POST'])
def extract_skills_endpoint():
    if 'resume' not in request.files:
        return jsonify({'error': 'No resume file provided'}), 400
    file = request.files['resume']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.pdf', '.docx'):
        return jsonify({'error': 'Unsupported file type'}), 400

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    file.save(tmp.name)
    try:
        section = (extract_section_pdf(tmp.name) if ext == '.pdf'
                   else extract_section_docx(tmp.name))

        if not section:
            return jsonify({'skills_section_found': False, 'skills': []})

        tokens = parse_skills(section)
        matched = []
        for tok in tokens:
            norm = normalize_string(tok)
            if len(norm) < MIN_LENGTH:
                if norm in norm_skills:
                    matched.append(tok)
            else:
                if max(fuzz.partial_ratio(norm, ns) for ns in norm_skills) >= FUZZY_THRESHOLD:
                    matched.append(tok)

        seen, final = set(), []
        for m in matched:
            k = normalize_string(m)
            if k not in seen:
                seen.add(k)
                final.append(m)
        cleaned = [re.sub(GLYPH_RE, '', s).strip() for s in final]

        return jsonify({'skills_section_found': True, 'skills': cleaned})
    finally:
        tmp.close()
        os.unlink(tmp.name)

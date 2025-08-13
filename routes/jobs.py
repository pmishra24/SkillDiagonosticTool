# routes/jobs.py
from flask import Blueprint, request, jsonify, current_app
from matching import match_jobs

jobs_bp = Blueprint('jobs', __name__)

@jobs_bp.route('/jobs', methods=['POST'])
def get_jobs():
    data = request.get_json() or {}
    user_skills = data.get('skills', [])
    if not user_skills:
        return jsonify({'error': 'No skills provided'}), 400

    matching = match_jobs(user_skills, current_app.config['JOBS_DF'])
    if matching.empty:
        return jsonify([])

    result = matching[['id', 'title', 'company', 'location', 'match_score']].to_dict(orient='records')
    return jsonify(result)

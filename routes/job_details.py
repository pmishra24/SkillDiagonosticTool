# routes/job_details.py
from flask import Blueprint, request, jsonify, current_app
from matching import recommend_courses

job_details_bp = Blueprint('job_details', __name__)

@job_details_bp.route('/job_details', methods=['POST'])
def get_job_details():
    data = request.get_json() or {}
    user_skills = data.get('user_skills', [])
    job_ids = data.get('job_ids') or ([data.get('job_id')] if data.get('job_id') else None)
    if not job_ids:
        return jsonify({'error': 'No job id provided'}), 400

    results = []
    for jid in job_ids:
        df = current_app.config['JOBS_DF']
        job_row = df[df['id'] == int(jid)]
        if job_row.empty:
            results.append({'job_id': jid, 'error': 'Job not found'})
            continue

        job = job_row.iloc[0]
        missing = recommend_courses(user_skills, job['all_skills'], current_app.config['COURSES_DF'])
        results.append({
            'job': {
                'id': str(job['id']),
                'title': job['title'],
                'company': job['company'],
                'location': job['location'],
                'description': job['description']
            },
            'missing_skills_courses': missing
        })

    return jsonify(results)

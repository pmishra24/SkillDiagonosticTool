import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import re
from rapidfuzz import fuzz, process

app = Flask(__name__)

# Configure logger
logging.basicConfig(level=logging.INFO)
CORS(app, resources={r"/*": {"origins": "*"}})

# ----- Load Data from CSV Files -----
jobs = pd.read_csv('job_data_clean_v2.0.csv')
courses = pd.read_csv('course_data_clean_v2.0.csv', encoding='latin1')

def normalize_string(s):
    """Lowercase, strip punctuation and collapse whitespace."""
    return re.sub(r'[^\w\s]', '', s).strip().lower()

def custom_tokenizer(text):
    """
    Split a semicolon‑delimited 'skill:score' string into raw skill names.
    E.g. "asp net:1.00; angular js:1.00" → ["asp net", "angular js"]
    """
    tokens = []
    for seg in text.split(';'):
        seg = seg.strip()
        if not seg:
            continue
        tokens.append(seg.split(':', 1)[0].strip())
    return tokens

# ----- Preprocessing Functions -----
def preprocess_jobs(jobs_data):
    df = jobs_data.copy()
    df["all_skills"] = df["merged_skills"]
    df['id'] = range(1, len(df) + 1)
    df['job_tokens'] = df['all_skills']\
        .fillna('')\
        .map(lambda txt: [t.lower() for t in custom_tokenizer(txt)])
    df['job_norm'] = df['job_tokens']\
        .map(lambda toks: [normalize_string(t) for t in toks])
    return df

def preprocess_courses(courses_data):
    df = courses_data.copy()
    df["skills_string"] = df["Unique Skills"]
    return df

# Preprocess the data for the endpoints.
jobs_df = preprocess_jobs(jobs)
courses_df = preprocess_courses(courses)

FUZZY_THRESHOLD = 90

def compute_match_score(
    user_norm,
    job_norm,
    threshold):
    """
    Compute the fuzzy‑Jaccard match between two normalized token lists:
      1) exact match for tokens <4 chars
      2) fuzzy partial_ratio ≥ threshold for tokens ≥4 chars
    Returns matched_count / union_count.
    """
    # Partition into short vs long
    user_short = {u for u in user_norm if len(u) < 4}
    user_long  = [u for u in user_norm if len(u) >= 4]
    job_short  = {j for j in job_norm if len(j) < 4}
    job_long   = [j for j in job_norm if len(j) >= 4]

    # Exact matches on short tokens
    exact_matches = user_short & job_short

    # Fuzzy matches on long tokens
    fuzzy_matches = 0
    if user_long and job_long:
        for jt in job_long:
            best = process.extractOne(jt, user_long, scorer=fuzz.partial_ratio)
            if best and best[1] >= threshold:
                fuzzy_matches += 1

    matched_count = len(exact_matches) + fuzzy_matches
    union_count   = len(set(job_norm))
    return matched_count / union_count if union_count else 0.0

def match_jobs(user_skills, jobs_df, threshold = 0.01):
    """
    Top‑10 jobs by match_score > threshold, using compute_match_score.
    """
    # Normalize user once
    user_norm = [normalize_string(s) for s in user_skills]

    # Compute scores
    scores = [
        compute_match_score(user_norm, job_norm, FUZZY_THRESHOLD)
        for job_norm in jobs_df['job_norm']
    ]

    jobs_df['match_score'] = scores
    return (
        jobs_df[jobs_df['match_score'] > threshold]
          .sort_values('match_score', ascending=False)
          .head(10)
    )

def is_skill_present(target_skill, user_skills, cutoff=0.9):
    
    j = normalize_string(target_skill)
    for skill in user_skills:
        u = normalize_string(skill)
        if len(u) < 4:
            return u == j
        elif fuzz.partial_ratio(u, j) >= FUZZY_THRESHOLD:
            return True

    return False

def recommend_courses(user_skills, target_job_skills, courses_df):
    # Parse the target_job_skills string into a dictionary: {skill: score}
    target_skills_with_scores = {}
    for pair in target_job_skills.split(";"):
        pair = pair.strip()
        if not pair:
            continue
        if ":" in pair:
            skill, score = pair.split(":", 1)
            try:
                target_skills_with_scores[skill.strip()] = float(score.strip())
            except ValueError:
                app.logger.error(f"Invalid score format for {skill}")
    
    # Identify missing skills along with their scores
    missing_skills = {}  # dictionary {skill: score} for skills not present in user_skills
    for skill, score in target_skills_with_scores.items():
        if not is_skill_present(skill, user_skills):
            missing_skills[skill] = score
    
    missing_skills_courses = []
    # For each missing skill, find the first relevant course and include skill score in the output string
    for skill, score in missing_skills.items():
        # Use re.escape to safely incorporate the skill into the regex pattern
        pattern = r'\b' + re.escape(skill) + r'\b'
        relevant_courses = courses_df[courses_df['skills_string'].str.contains(
            pattern, regex=True, case=False, na=False)]
        first_relevant_course = relevant_courses.head(1)

        if not first_relevant_course.empty:
            course_title = first_relevant_course['course_title'].iloc[0]
            course_link = first_relevant_course['course_url'].iloc[0]
            missing_skills_courses.append(
                f"{skill} ({score:.2f}) - <a href='{course_link}' target='_blank'>{course_title}</a>"
            )
        else:
            missing_skills_courses.append(f"{skill} ({score:.2f}) - No course recommended")
        
    return missing_skills_courses


# ----- API Endpoints -----

# Endpoint 1: Returns jobs matching the provided skills using advanced matching.
@app.route('/jobs', methods=['POST'])
def get_jobs():
    data = request.get_json()
    user_skills = data.get('skills', [])
    if not user_skills:
        return jsonify({"error": "No skills provided"}), 400

    matching_jobs = match_jobs(user_skills, jobs_df)
    if matching_jobs.empty:
        return jsonify([])

    # Return selected job fields.
    result = matching_jobs[['id', 'title', 'company', 'location', 'match_score']].to_dict(orient='records')
    return jsonify(result)

# Endpoint 2: Accepts one or more job IDs and returns the missing skills and recommended courses (including URL) for each.
@app.route('/job_details', methods=['POST'])
def get_job_details():
    data = request.get_json()
    user_skills = data.get('user_skills', [])
    job_ids = data.get('job_ids')
    if not job_ids:
        job_id = data.get('job_id')
        if job_id is not None:
            job_ids = [job_id]
        else:
            return jsonify({"error": "No job id provided"}), 400

    results = []
    for jid in job_ids:
        job_row = jobs_df[jobs_df['id'] == int(jid)]
        if job_row.empty:
            results.append({
                "job_id": jid,
                "error": "Job not found"
            })
            continue
        
        job_dict = job_row.iloc[0].to_dict()
        target_job_skills = job_dict["all_skills"]
        missing_skills_courses = recommend_courses(user_skills, target_job_skills, courses_df)

        results.append({
            "job": {
                "id": str(job_dict["id"]),
                "title": job_dict["title"],
                "company": job_dict["company"],
                "location": job_dict["location"],
                "description": job_dict["description"]
            },
            "missing_skills_courses": missing_skills_courses
        })

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)

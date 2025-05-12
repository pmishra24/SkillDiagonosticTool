import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import difflib
import logging
import re

app = Flask(__name__)

# Configure logger
logging.basicConfig(level=logging.INFO)
CORS(app, resources={r"/*": {"origins": "*"}})

# ----- Load Data from CSV Files -----
jobs = pd.read_csv('job_data_clean.csv')
courses = pd.read_csv('course_data_clean.csv')


# ----- Preprocessing Functions -----
def preprocess_jobs(jobs_data):
    df = jobs_data.copy()
    df["all_skills"] = df["merged_skills"]
    df['id'] = range(1, len(df) + 1)
    return df

def preprocess_courses(courses_data):
    df = courses_data.copy()
    df["skills_string"] = df["Unique Skills"]
    return df

# Preprocess the data for the endpoints.
jobs_df = preprocess_jobs(jobs)
courses_df = preprocess_courses(courses)

def custom_tokenizer(text):
    tokens = []
    
    # Split the input string into segments using semicolon as the delimiter
    for skill_score in text.split(';'):
        skill_score = skill_score.strip()  # Remove any leading/trailing whitespace
        if not skill_score:
            continue  # Skip empty segments
        
        # Split the segment by colon to separate the skill from its score
        parts = skill_score.split(':')
        if parts:
            # The skill name is before the colon
            skill_name = parts[0].strip()
            tokens.append(skill_name)
    
    return tokens

# ----- Matching and Recommendation Functions -----
def jaccard_similarity(set1, set2):
    # If job_tokens are completely contained in user_tokens, then return a perfect score.
    if set2.issubset(set1) :
        return 1.0
    # Otherwise, fall back to Jaccard similarity or another metric.
    intersection = set1.intersection(set2)
    union = set1.union(set2)
    app.logger.info(intersection)
    app.logger.info(union)
    return float(len(intersection)) / len(union)

def match_jobs(user_skills, jobs_df, threshold=0.01):
    user_skills_str = '; '.join(user_skills)
    user_skills_set = set(custom_tokenizer(user_skills_str.lower()))
    
    match_scores = []
    
    # Compute Jaccard similarity for each job
    for skills in jobs_df['all_skills'].fillna(""):
        job_skills_set = set(custom_tokenizer(skills.lower()))
        score = jaccard_similarity(user_skills_set, job_skills_set)
        match_scores.append(score)
    
    jobs_df['match_score'] = match_scores
    matching_jobs = jobs_df[jobs_df['match_score'] > threshold] \
                        .sort_values(by='match_score', ascending=False) \
                        .head(10)
    
    return matching_jobs


def is_skill_present(target_skill, user_skills, cutoff=0.8):
    target_skill_clean = target_skill.lower().strip()
    for skill in user_skills:
        similarity = difflib.SequenceMatcher(None, target_skill_clean, skill.lower().strip()).ratio()
        if similarity >= cutoff:
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
                "id": job_dict["id"],
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

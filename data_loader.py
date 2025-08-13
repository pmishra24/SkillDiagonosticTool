# data_loader.py
import pandas as pd
from preprocessing import preprocess_jobs, preprocess_courses
from utils import normalize_string

def load_data():
    jobs = pd.read_csv('job_data_clean_v2.0.csv')
    courses = pd.read_csv('course_data_clean_v2.0.csv', encoding='latin1')

    jobs_df = preprocess_jobs(jobs)
    courses_df = preprocess_courses(courses)

    skills_list = courses['Unique Skills'].dropna().astype(str).tolist()
    norm_skills = [normalize_string(s) for s in skills_list]

    return jobs_df, courses_df, norm_skills

jobs_df, courses_df, norm_skills = load_data()

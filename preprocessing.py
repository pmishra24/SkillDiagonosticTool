# preprocessing.py
import pandas as pd
from utils import custom_tokenizer, normalize_string

def preprocess_jobs(jobs_data: pd.DataFrame) -> pd.DataFrame:
    df = jobs_data.copy()
    df['id'] = range(1, len(df) + 1)
    df['all_skills'] = df['merged_skills']
    df['job_tokens'] = df['all_skills']\
        .fillna('')\
        .map(lambda txt: [t.lower() for t in custom_tokenizer(txt)])
    df['job_norm'] = df['job_tokens']\
        .map(lambda toks: [normalize_string(t) for t in toks])
    return df

def preprocess_courses(courses_data: pd.DataFrame) -> pd.DataFrame:
    df = courses_data.copy()
    df['skills_string'] = df['Unique Skills']
    return df

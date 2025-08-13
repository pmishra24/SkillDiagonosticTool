# matching.py
import re
from typing import List
from rapidfuzz import fuzz, process
from utils import normalize_string
from config import FUZZY_THRESHOLD

def compute_match_score(user_norm: List[str], job_norm: List[str], threshold: int) -> float:
    user_short = {u for u in user_norm if len(u) < 4}
    user_long  = [u for u in user_norm if len(u) >= 4]
    job_short  = {j for j in job_norm if len(j) < 4}
    job_long   = [j for j in job_norm if len(j) >= 4]

    exact_matches = user_short & job_short
    fuzzy_matches = 0
    if user_long and job_long:
        for jt in job_long:
            best = process.extractOne(jt, user_long, scorer=fuzz.partial_ratio)
            if best and best[1] >= threshold:
                fuzzy_matches += 1

    matched_count = len(exact_matches) + fuzzy_matches
    union_count   = len(set(job_norm))
    return matched_count / union_count if union_count else 0.0

def match_jobs(user_skills: List[str], jobs_df, threshold: float = 0.01):
    user_norm = [normalize_string(s) for s in user_skills]
    scores = [
        compute_match_score(user_norm, job_norm, FUZZY_THRESHOLD)
        for job_norm in jobs_df['job_norm']
    ]
    df = jobs_df.copy()
    df['match_score'] = scores
    return (
        df[df['match_score'] > threshold]
          .sort_values('match_score', ascending=False)
          .head(10)
    )

def is_skill_present(target_skill: str, user_skills: List[str], cutoff: float = 0.9) -> bool:
    j = normalize_string(target_skill)
    for skill in user_skills:
        u = normalize_string(skill)
        if len(u) < 4:
            return u == j
        elif fuzz.partial_ratio(u, j) >= FUZZY_THRESHOLD:
            return True
    return False

def recommend_courses(user_skills: List[str], target_job_skills: str, courses_df) -> List[str]:
    target_skills_with_scores: dict[str, float] = {}
    for pair in target_job_skills.split(';'):
        pair = pair.strip()
        if not pair:
            continue
        if ':' in pair:
            skill, score = pair.split(':', 1)
            try:
                target_skills_with_scores[skill.strip()] = float(score.strip())
            except ValueError:
                # logged upstream
                pass

    missing: dict[str, float] = {}
    for skill, score in target_skills_with_scores.items():
        if not is_skill_present(skill, user_skills):
            missing[skill] = score

    recommendations: List[str] = []
    for skill, score in missing.items():
        pattern = r'\b' + re.escape(skill) + r'\b'
        relevant = courses_df[courses_df['skills_string']
                              .str.contains(pattern, regex=True, case=False, na=False)]
        if not relevant.empty:
            first = relevant.iloc[0]
            recommendations.append(
                f"{skill} ({score:.2f}) - "
                f"<a href='{first['course_url']}' target='_blank'>{first['course_title']}</a>"
            )
        else:
            recommendations.append(f"{skill} ({score:.2f}) - No course recommended")
    return recommendations

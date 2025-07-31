# app.py
import logging
from flask import Flask
from flask_cors import CORS
from config import LOG_LEVEL
from data_loader import jobs_df, courses_df
from routes.jobs import jobs_bp
from routes.job_details import job_details_bp
from routes.extract_skills import extract_skills_bp

def create_app():
    app = Flask(__name__)
    logging.basicConfig(level=LOG_LEVEL)
    CORS(app, resources={r"/*": {"origins": "*"}})
    app.config['JOBS_DF'] = jobs_df
    app.config['COURSES_DF'] = courses_df
    app.register_blueprint(jobs_bp)
    app.register_blueprint(job_details_bp)
    app.register_blueprint(extract_skills_bp)
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)

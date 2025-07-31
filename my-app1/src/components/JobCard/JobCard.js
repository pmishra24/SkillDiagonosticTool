// src/components/JobCard/JobCard.js
import React from 'react';
import './JobCard.css';

export default function JobCard({ job, checked, onCheckboxChange }) {
  const pct = job.match_score != null
    ? (job.match_score * 100).toFixed(1)
    : null;

  return (
    <div className="job-card">
      <div className="job-card-header">
        <h3 className="job-title">{job.title}</h3>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheckboxChange}
          className="job-checkbox"
        />
      </div>
      <div className="job-card-body">
        <p><strong>Company:</strong> {job.company}</p>
        <p><strong>Location:</strong> {job.location}</p>
        {pct && (
          <div className="score-section">
            <p className="score-label"><strong>Match:</strong> {pct}%</p>
            <div className="score-bar">
              <div className="score-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

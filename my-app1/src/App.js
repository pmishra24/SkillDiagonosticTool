// App.js
import React, { useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import './App.css';
import logo from './logo.png';

const BASE_URL = "http://127.0.0.1:5000";

function JobCard({ job, checked, onCheckboxChange }) {
  const matchScorePercentage = job.match_score != null
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
        {matchScorePercentage && (
          <div className="score-section">
            <p className="score-label"><strong>Match:</strong> {matchScorePercentage}%</p>
            <div className="score-bar">
              <div
                className="score-bar-fill"
                style={{ width: `${matchScorePercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ content, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-body">{content}</div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="spinner">
      <div className="bounce1" />
      <div className="bounce2" />
      <div className="bounce3" />
    </div>
  );
}

function App() {
  // input vs list
  const [inputSkills, setInputSkills] = useState("");
  const [skillsList,   setSkillsList]   = useState([]);

  // jobs & recs
  const [jobs, setJobs]                         = useState([]);
  const [selectedJobIds, setSelectedJobIds]     = useState([]);
  const [jobDetails, setJobDetails]             = useState([]);
  const [jobsError, setJobsError]               = useState("");
  const [detailsError, setDetailsError]         = useState("");
  const [isLoadingJobs, setIsLoadingJobs]       = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // modal
  const [modalOpen, setModalOpen]     = useState(false);
  const [modalContent, setModalContent] = useState("");

  const openModal  = txt => { setModalContent(txt); setModalOpen(true); };
  const closeModal = ()   => setModalOpen(false);

  // add tag
  const handleAddSkills = e => {
    e.preventDefault();
    if (!inputSkills.trim()) return;
    const newSkills = inputSkills
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    setSkillsList(prev => Array.from(new Set([...prev, ...newSkills])));
    setInputSkills("");
  };

  // remove tag
  const handleRemoveSkill = skill =>
    setSkillsList(prev => prev.filter(s => s !== skill));

  // enter key
  const handleInputKeyDown = e => {
    if (e.key === "Enter") handleAddSkills(e);
  };

  // search jobs
  const handleJobSearchSubmit = e => {
    e && e.preventDefault();
    if (!skillsList.length) {
      alert("Please add at least one skill.");
      return;
    }
    setJobsError(""); setJobs([]); setSelectedJobIds([]); setJobDetails([]);
    setIsLoadingJobs(true);

    fetch(`${BASE_URL}/jobs`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ skills: skillsList })
    })
      .then(r => r.json())
      .then(data => {
        setIsLoadingJobs(false);
        if (data.error)       return setJobsError(data.error);
        if (!data.length)     return setJobsError("No jobs found.");
        setJobs(data);
      })
      .catch(() => {
        setIsLoadingJobs(false);
        setJobsError("An error occurred.");
      });
  };

  // toggle select
  const handleCheckboxChange = jobId =>
    setSelectedJobIds(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );

  // get missing‑skills recs
  const handleGetRecommendations = () => {
    if (!selectedJobIds.length) {
      alert("Select at least one job.");
      return;
    }
    setDetailsError(""); setJobDetails([]);
    setIsLoadingDetails(true);

    fetch(`${BASE_URL}/job_details`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        job_ids:     selectedJobIds,
        user_skills: skillsList
      })
    })
      .then(r => r.json())
      .then(data => {
        setIsLoadingDetails(false);
        if (data.error)           return setDetailsError(data.error);
        if (!Array.isArray(data))  return setDetailsError("Unexpected format.");
        setJobDetails(data);
      })
      .catch(() => {
        setIsLoadingDetails(false);
        setDetailsError("An error occurred.");
      });
  };

  return (
    <HelmetProvider>
      <div className="container">
        <Helmet>
          <title>Skill Diagnostic Tool</title>
        </Helmet>

        {/* header */}
        <header className="app-header-inner">
          <img src={logo} alt="Skillnari logo" className="app-logo" />
          <h1 className="app-header-text">Skill Diagnostic Tool</h1>
          <p className="tagline">See Your Skills Clearly &amp; Shape Your Future.</p>
        </header>

        {/* Search by Skills */}
        <div className="card search-card">
          <div className="card-header">
            <h2>Search Jobs by Skills</h2>
          </div>
          <div className="card-body">
            <div className="skill-input-section">
              <input
                type="text"
                placeholder="e.g. python, flask"
                value={inputSkills}
                onChange={e => setInputSkills(e.target.value)}
                onKeyDown={handleInputKeyDown}
              />
              <button className="btn-add" onClick={handleAddSkills}>
                + Add Skill
              </button>
            </div>

            <div className="skills-tags">
              {skillsList.map((skill, i) => (
                <span key={i} className="skill-tag">
                  {skill}
                  <button
                    className="remove-skill"
                    onClick={() => handleRemoveSkill(skill)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* moved Search Jobs button here */}
            <button
              className="btn-search"
              style={{ marginTop: '1rem' }}
              onClick={handleJobSearchSubmit}
            >
              🔍 Search Jobs
            </button>
          </div>
        </div>

        {/* Job Recommendations */}
        <div className="card rec-card">
          <div className="card-header">
            <h2>Job Recommendations</h2>
          </div>
          <div className="card-body">
            {isLoadingJobs && <Spinner />}
            {jobsError && <p className="error">{jobsError}</p>}

            <div className="job-list">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  checked={selectedJobIds.includes(job.id)}
                  onCheckboxChange={() => handleCheckboxChange(job.id)}
                />
              ))}
            </div>

            {/* moved Get Recommendations button here */}
            <button
              className="btn-getrec"
              style={{ marginTop: '1.5rem' }}
              onClick={handleGetRecommendations}
            >
              Get Recommendations
            </button>
          </div>
        </div>

        {/* Missing Skills & Recommendations */}
        <div className="card rec-card">
          <div className="card-header">
            <h2>Missing Skills &amp; Recommendations</h2>
          </div>
          <div className="card-body">
            {isLoadingDetails && <Spinner />}
            {detailsError && <p className="error">{detailsError}</p>}
            {!isLoadingDetails && !detailsError && jobDetails.length === 0 && (
              <p className="placeholder">No recommendations available.</p>
            )}

            {jobDetails.length > 0 && (
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Company</th>
                    <th>Description</th>
                    <th>Location</th>
                    <th>Missing Skills &amp; Courses</th>
                  </tr>
                </thead>
                <tbody>
                  {jobDetails.map((item, idx) => {
                    if (item.error) {
                      return (
                        <tr key={idx}>
                          <td colSpan="5" className="error">
                            Job ID {item.job_id}: {item.error}
                          </td>
                        </tr>
                      );
                    }
                    const desc = item.job.description || "";
                    const shortDesc = desc.length > 100
                      ? desc.slice(0, 100) + "…"
                      : desc;
                    return (
                      <tr key={idx}>
                        <td>{item.job.title}</td>
                        <td>{item.job.company}</td>
                        <td>
                          {shortDesc}
                          {desc.length > 100 && (
                            <button
                              className="show-more"
                              onClick={() => openModal(desc)}
                            >
                              Show More
                            </button>
                          )}
                        </td>
                        <td>{item.job.location}</td>
                        <td>
                          {item.missing_skills_courses?.length
                            ? <ul>
                                {item.missing_skills_courses.map((html, i) => (
                                  <li key={i} dangerouslySetInnerHTML={{ __html: html }} />
                                ))}
                              </ul>
                            : "None"
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {modalOpen && (
          <Modal content={modalContent} onClose={closeModal} />
        )}
      </div>
    </HelmetProvider>
  );
}

export default App;

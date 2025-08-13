import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import logo from './logo.png';
import './App.css';

/** uniqueMerge util */
function uniqueMerge(existing, toAdd) {
  const lower = new Set(existing.map(s => s.toLowerCase()));
  return [
    ...existing,
    ...toAdd.filter(s => !lower.has(s.toLowerCase())),
  ];
}

/** Spinner component */
function Spinner() {
  return (
    <div className="spinner">
      <div className="bounce1" />
      <div className="bounce2" />
      <div className="bounce3" />
    </div>
  );
}

/** Modal component */
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

/** JobCard component */
function JobCard({ job, checked, onCheckboxChange }) {
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

/** Stepper component with two connectors */
function Stepper({ currentStep, onStepClick }) {
  const isCompleted = step => currentStep > step;
  const isActive = step => currentStep === step;

  const renderCircle = (step) => {
    if (isCompleted(step)) {
      return (
        <div className="circle completed">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="check-icon">
            <path
              d="M4 8l3 3 5-5"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    }
    return (
      <div className="circle">
        <span className="number">{step}</span>
      </div>
    );
  };

  return (
    <div className="stepper-wrapper">
      <div className="stepper">
        <div
          className={`step-item ${isActive(1) ? 'active' : ''} ${isCompleted(1) ? 'completed' : ''}`}
          onClick={() => onStepClick?.(1)}
        >
          {renderCircle(1)}
          <div className="label">Add Skills</div>
        </div>

        <div className={`connector ${currentStep >= 2 ? 'active' : ''}`} />

        <div
          className={`step-item ${isActive(2) ? 'active' : ''} ${isCompleted(2) ? 'completed' : ''}`}
          onClick={() => onStepClick?.(2)}
        >
          {renderCircle(2)}
          <div className="label">Job Recommendations</div>
        </div>

        <div className={`connector ${currentStep >= 3 ? 'active' : ''}`} />

        <div
          className={`step-item ${isActive(3) ? 'active' : ''} ${isCompleted(3) ? 'completed' : ''}`}
          onClick={() => onStepClick?.(3)}
        >
          {renderCircle(3)}
          <div className="label">Missing Skills & Recommendations</div>
        </div>
      </div>
    </div>
  );
}

// const BASE_URL = 'http://127.0.0.1:5000';
const BASE_URL = "https://skilldiagonostictool.onrender.com"
const JOBS_PER_PAGE = 4;

function App() {
  const [inputSkills, setInputSkills] = useState('');
  const [skillsList, setSkillsList] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [jobDetails, setJobDetails] = useState([]);
  const [jobsError, setJobsError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [jobsPage, setJobsPage] = useState(1);
  const [resumeName, setResumeName] = useState('');

  const openModal  = txt => { setModalContent(txt); setModalOpen(true); };
  const closeModal = ()   => setModalOpen(false);

  const handleAddSkills = e => {
    e.preventDefault();
    const raw = inputSkills.trim();
    if (!raw) return;
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    setSkillsList(prev => uniqueMerge(prev, parts));
    setInputSkills('');
  };

  const handleRemoveSkill = skill =>
    setSkillsList(prev => prev.filter(s => s !== skill));
  const handleClearAll = () => {
    setInputSkills('');
    setSkillsList([]);
  };
  const handleInputKeyDown = e => { if (e.key === 'Enter') handleAddSkills(e); };

  const handleResumeUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;

    // clear prior job & detail state on new resume
    setJobs([]);
    setSelectedJobIds([]);
    setJobDetails([]);
    setJobsError('');
    setDetailsError('');
    setJobsPage(1);

    setIsUploading(true);
    setUploadError('');
    setSkillsList([]);
    setResumeName(file.name);

    const form = new FormData();
    form.append('resume', file);

    try {
      const res = await fetch(`${BASE_URL}/extract_skills`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      setIsUploading(false);

      if (data.error) {
        setUploadError(data.error);
        return;
      }
      if (!data.skills_section_found) {
        setUploadError('No skills section found in resume.');
        return;
      }

      const seen = new Set();
      const uniq = [];
      data.skills.forEach(s => {
        const k = s.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          uniq.push(s);
        }
      });
      setSkillsList(uniq);
    } catch {
      setIsUploading(false);
      setUploadError('Upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const clearResume = () => {
    setResumeName('');
  };

  const handleJobSearchSubmit = e => {
    e && e.preventDefault();
    if (!skillsList.length) {
      alert('Please add at least one skill.');
      return;
    }
    setJobsError(''); setJobs([]); setSelectedJobIds([]); setJobDetails([]);
    setIsLoadingJobs(true);
    setJobsPage(1);

    fetch(`${BASE_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: skillsList })
    })
      .then(r => r.json())
      .then(data => {
        setIsLoadingJobs(false);
        if (data.error)   return setJobsError(data.error);
        if (!data.length) return setJobsError('No jobs found.');
        setJobs(data);
      })
      .catch(() => {
        setIsLoadingJobs(false);
        setJobsError('An error occurred.');
      });
  };

  const handleCheckboxChange = jobId =>
    setSelectedJobIds(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );

  const handleGetRecommendations = () => {
    if (!selectedJobIds.length) {
      alert('Select at least one job.');
      return;
    }
    setDetailsError(''); setJobDetails([]); setIsLoadingDetails(true);

    fetch(`${BASE_URL}/job_details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_ids:     selectedJobIds,
        user_skills: skillsList
      })
    })
      .then(r => r.json())
      .then(data => {
        setIsLoadingDetails(false);
        if (data.error)          return setDetailsError(data.error);
        if (!Array.isArray(data)) return setDetailsError('Unexpected format.');
        setJobDetails(data);
      })
      .catch(() => {
        setIsLoadingDetails(false);
        setDetailsError('An error occurred.');
      });
  };

  const handleResetAll = () => {
    setInputSkills('');
    setSkillsList([]);
    setJobs([]);
    setSelectedJobIds([]);
    setJobDetails([]);
    setJobsError('');
    setDetailsError('');
    setUploadError('');
    setIsUploading(false);
    setJobsPage(1);
    setResumeName('');
  };

  const handleStepClick = step => {
    if (step === 1) {
      setJobs([]);
      setSelectedJobIds([]);
      setJobDetails([]);
      setJobsError('');
      setDetailsError('');
      setJobsPage(1);
    } else if (step === 2) {
      setJobDetails([]);
      setDetailsError('');
    }
  };

  // current step logic
  let currentStep = 1;
  if (jobDetails.length > 0 || isLoadingDetails || detailsError) currentStep = 3;
  else if (jobs.length > 0 || isLoadingJobs || jobsError) currentStep = 2;

  // pagination
  const totalPages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
  const startIdx = (jobsPage - 1) * JOBS_PER_PAGE;
  const pagedJobs = jobs.slice(startIdx, startIdx + JOBS_PER_PAGE);

  const handleNextPage = () => {
    if (jobsPage < totalPages) setJobsPage(prev => prev + 1);
  };
  const handlePrevPage = () => {
    if (jobsPage > 1) setJobsPage(prev => prev - 1);
  };

  return (
    <div className="container">
      <Helmet><title>Skill Diagnostic Tool</title></Helmet>

      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="logo-box">
              <img src={logo} alt="Skillnari logo" className="app-logo" />
              <div className="brand-name">Skillnari</div>
            </div>
            <div className="titles">
              <h1 className="app-header-text">Skill Diagnostic Tool</h1>
              <p className="tagline">See Your Skills Clearly & Shape Your Future.</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="quick-stats">
              <div className="stat">
                <span className="stat-value">{skillsList.length}</span>
                <span className="stat-label">Skills</span>
              </div>
              <div className="stat">
                <span className="stat-value">{selectedJobIds.length}</span>
                <span className="stat-label">Jobs Selected</span>
              </div>
            </div>
            <button className="btn-reset" onClick={handleResetAll}>
              Start Over
            </button>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <Stepper currentStep={currentStep} onStepClick={handleStepClick} />

      {/* Top Section */}
      <div className="top-section">
        {/* Search by Skills */}
        <div className="card search-card">
          <div className="card-header"><h2>Search Jobs by Skills</h2></div>
          <p className="upload-hint">
            Enter skills manually or upload your resume (PDF/DOCX only).
          </p>
          <div className="card-body">
            <div className="skill-input-section">
              <input
                className="skill-input"
                type="text"
                placeholder="e.g. python, flask"
                value={inputSkills}
                onChange={e => setInputSkills(e.target.value)}
                onKeyDown={handleInputKeyDown}
              />
              <button className="btn-add" onClick={handleAddSkills}>+ Add</button>
              <label className="btn-upload">
                {isUploading ? 'Uploading…' : 'Upload Resume'}
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleResumeUpload}
                />
              </label>
            </div>
            {resumeName && (
              <div className="resume-info">
                <span className="resume-label">Uploaded:</span>
                <span className="resume-name">
                  {resumeName}
                  <button
                    aria-label="Remove resume"
                    onClick={clearResume}
                    className="remove-resume-btn"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
            {uploadError && <p className="error upload-error">{uploadError}</p>}
            <div className="skills-tags">
              {skillsList.map((skill,i) => (
                <span key={i} className="skill-tag">
                  {skill}
                  <button className="remove-skill" onClick={()=>handleRemoveSkill(skill)}>×</button>
                </span>
              ))}
            </div>
            <div className="action-row">
              <button className="btn-search" onClick={handleJobSearchSubmit}>
                🔍 Search Jobs
              </button>
              <button className="btn-clear" onClick={handleClearAll}>
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Job Recommendations */}
        <div className="card rec-card">
          <div className="card-header"><h2>Job Recommendations</h2></div>
          <div className="card-body rec-body">
            <div className="rec-main">
              {isLoadingJobs && <Spinner />}
              {jobsError && <p className="error">{jobsError}</p>}
              <div className="job-list">
                {pagedJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    checked={selectedJobIds.includes(job.id)}
                    onCheckboxChange={()=>handleCheckboxChange(job.id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {jobs.length > JOBS_PER_PAGE && (
                <div className="pagination">
                  <div className="pagination-info">
                    Page {jobsPage} of {totalPages} &middot; Showing {Math.min(startIdx + 1, jobs.length)}–{Math.min(startIdx + JOBS_PER_PAGE, jobs.length)} of {jobs.length}
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="pagination-button"
                      onClick={handlePrevPage}
                      disabled={jobsPage === 1}
                    >
                      Previous
                    </button>
                    <button
                      className="pagination-button"
                      onClick={handleNextPage}
                      disabled={jobsPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rec-footer">
              <button className="btn-getrec" onClick={handleGetRecommendations}>
                Get Recommendations
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Missing Skills & Recommendations */}
      <div className="card rec-card">
        <div className="card-header"><h2>Missing Skills & Recommendations</h2></div>
        <div className="card-body">
          {isLoadingDetails && <Spinner />}
          {detailsError && <p className="error">{detailsError}</p>}
          {!isLoadingDetails && !detailsError && jobDetails.length===0 && (
            <p className="placeholder">No recommendations available.</p>
          )}
          {jobDetails.length>0 && (
            <table className="details-table">
              <thead>
                <tr>
                  <th>Title</th><th>Company</th><th>Description</th>
                  <th>Location</th><th>Missing Skills & Courses</th>
                </tr>
              </thead>
              <tbody>
                {jobDetails.map((item,idx)=> {
                  if(item.error){
                    return (
                      <tr key={idx}>
                        <td colSpan="5" className="error">
                          Job ID {item.job_id}: {item.error}
                        </td>
                      </tr>
                    );
                  }
                  const desc = item.job.description || '';
                  const shortDesc = desc.length>100
                    ? desc.slice(0,100)+'…'
                    : desc;
                  return (
                    <tr key={idx}>
                      <td>{item.job.title}</td>
                      <td>{item.job.company}</td>
                      <td className="description-cell">
                        {shortDesc}
                        {desc.length>100 && (
                          <button
                            className="show-more"
                            onClick={()=>openModal(desc)}
                          >
                            Show More
                          </button>
                        )}
                      </td>
                      <td>{item.job.location}</td>
                      <td>
                        {item.missing_skills_courses?.length
                          ? <ul>
                              {item.missing_skills_courses.map((html,i)=>
                                <li key={i} dangerouslySetInnerHTML={{__html:html}}/>
                              )}
                            </ul>
                          : 'None'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Full‐Description Modal */}
      {modalOpen && <Modal content={modalContent} onClose={closeModal}/>}
    </div>
  );
}

ReactDOM.render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
  document.getElementById('root')
);

export default App;


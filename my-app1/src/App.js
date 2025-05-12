import React, { useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import './App.css';
import logo from './logo.png';

const BASE_URL = "http://127.0.0.1:5000";

// JobCard renders a job with title, company, location, match score (if available)
// for the search results, along with a selectable checkbox.
function JobCard({ job, checked, onCheckboxChange }) {
  // Convert match_score (expected to be between 0 and 1) to percentage.
  const matchScorePercentage = job.match_score !== undefined
    ? (job.match_score * 100).toFixed(2)
    : null;

  return (
    <div className="job-card">
      <div className="job-card-header">
        <h3 className="job-title">{job.title}</h3>
        <input
          className="job-checkbox"
          type="checkbox"
          checked={checked}
          onChange={onCheckboxChange}
          aria-label={`Select job ${job.title}`}
        />
      </div>
      <div className="job-card-body">
        <p><strong>Company:</strong> {job.company}</p>
        <p><strong>Location:</strong> {job.location}</p>
        {matchScorePercentage && (
          <div className="score-section">
            <p className="score-label">
              <strong>Match Score:</strong> {matchScorePercentage}%
            </p>
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

// Modal component displays content in a popup.
function Modal({ content, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>X</button>
        <div className="modal-body">{content}</div>
      </div>
    </div>
  );
}

// Spinner for showing loading state.
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
  const [skills, setSkills] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [jobDetails, setJobDetails] = useState([]);
  const [jobsError, setJobsError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Modal state for job description
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState("");

  // Open modal with given content.
  const openModal = (content) => {
    setModalContent(content);
    setModalOpen(true);
  };

  // Close the modal.
  const closeModal = () => {
    setModalOpen(false);
  };

  // Handle the "Search Jobs" submission.
  const handleJobSearchSubmit = (e) => {
    e.preventDefault();
    const skillsArray = skills.split(",").map(s => s.trim()).filter(Boolean);

    // Clear previous data (but keep labels visible)
    setJobsError("");
    setJobs([]);
    setSelectedJobIds([]);
    setJobDetails([]);
    setIsLoadingJobs(true);

    fetch(`${BASE_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills: skillsArray })
    })
      .then(res => res.json())
      .then(data => {
        setIsLoadingJobs(false);
        if (data.error) {
          setJobsError(data.error);
          return;
        }
        if (!data.length) {
          setJobsError("No jobs found.");
          return;
        }
        setJobs(data);
      })
      .catch(err => {
        console.error(err);
        setIsLoadingJobs(false);
        setJobsError("An error occurred.");
      });
  };

  // Toggle checkbox selection for a job.
  const handleCheckboxChange = (jobId) => {
    setSelectedJobIds(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  // Handle the "Get Recommendations" button click.
  const handleGetRecommendations = () => {
    if (!selectedJobIds.length) {
      alert("Please select at least one job from the search results.");
      return;
    }
    setDetailsError("");
    setJobDetails([]);
    setIsLoadingDetails(true);

    const skillsArray = skills.split(",").map(s => s.trim()).filter(Boolean);

    fetch(`${BASE_URL}/job_details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_ids: selectedJobIds,
        user_skills: skillsArray
      })
    })
      .then(res => res.json())
      .then(data => {
        setIsLoadingDetails(false);
        if (data.error) {
          setDetailsError(data.error);
          return;
        }
        if (!Array.isArray(data)) {
          setDetailsError("Unexpected response format.");
          return;
        }
        setJobDetails(data);
      })
      .catch(err => {
        console.error(err);
        setIsLoadingDetails(false);
        setDetailsError("An error occurred.");
      });
  };

  // Render job cards for search results.
  const renderJobCards = () => (
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
  );

  // Render the recommendations table with an extra column for Job Description.
  const renderJobDetailsTable = () => {
    if (jobDetails.length === 0) {
      return <p>No recommendations available.</p>;
    }
    return (
      <table className="details-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Company</th>
            <th>Job Description</th>
            <th>Location</th>
            <th>Missing Skills &amp; Recommended Courses</th>
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
            const description = item.job.description || "";
            // Show only first 100 characters if available
            const truncated = description.length > 100
              ? description.substring(0, 100) + "..."
              : description;

            return (
              <tr key={idx}>
                <td>{item.job.title}</td>
                <td>{item.job.company}</td>
                <td>
                  {description ? (
                    <>
                      {truncated}
                      {description.length > 100 && (
                        <a
                          href="#!"
                          className="show-more"
                          onClick={() => openModal(description)}
                        >
                          {" "}Show More
                        </a>
                      )}
                    </>
                  ) : "N/A"}
                </td>
                <td>{item.job.location}</td>
                <td>
                  {item.missing_skills_courses?.length ? (
                    <ul>
                      {item.missing_skills_courses.map((entry, i) => (
                        <li key={i} dangerouslySetInnerHTML={{ __html: entry }} />
                      ))}
                    </ul>
                  ) : (
                    "None"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <HelmetProvider>
      <div className="container">
        <Helmet>
          <title>Skill Diagostic Tool</title>
        </Helmet>
        <header className="app-header">
         <div className="app-header-inner">
           <img src={logo} alt="Skill Diagnostic Logo" className="app-logo" />
           <div className="app-header-text">
             <br/><h1>Skill Diagnostic Tool</h1>
             <p className="tagline">See Your Skills Clearly &amp; Shape Your Future.</p>
           </div>
         </div>
       </header>
        {/* Search Jobs Section */}
        <h2>Search Jobs by Skills</h2>
        <form onSubmit={handleJobSearchSubmit}>
          <label htmlFor="skillsInput">Enter Skills (comma separated):</label>
          <input
            type="text"
            id="skillsInput"
            placeholder="e.g., python, flask"
            value={skills}
            onChange={e => setSkills(e.target.value)}
          />
          <button type="submit">Search Jobs</button>
        </form>

        <div className="results">
          {isLoadingJobs && <Spinner />}
          {jobsError && <p className="error">{jobsError}</p>}
          {/* Job Recommendations label always visible */}
          <h2>Job Recommendations</h2>
          {renderJobCards()}
        </div>

        {/* Get Recommendations Button */}
        <button onClick={handleGetRecommendations}>Get Recommendations</button>

        <div className="results">
          {isLoadingDetails && <Spinner />}
          {detailsError && <p className="error">{detailsError}</p>}
          {/* Missing Skills & Recommendations label always visible */}
          <h2>Missing Skills &amp; Recommendations</h2>
          {renderJobDetailsTable()}
        </div>

        {/* Modal for full job description */}
        {modalOpen && <Modal content={modalContent} onClose={closeModal} />}
      </div>
    </HelmetProvider>
  );
}

export default App;

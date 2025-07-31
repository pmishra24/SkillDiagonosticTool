// src/components/Spinner/Spinner.js
import React from 'react';
import './Spinner.css';

export default function Spinner() {
  return (
    <div className="spinner">
      <div className="bounce1" />
      <div className="bounce2" />
      <div className="bounce3" />
    </div>
  );
}

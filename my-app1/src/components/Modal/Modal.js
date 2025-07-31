// src/components/Modal/Modal.js
import React from 'react';
import './Modal.css';

export default function Modal({ content, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-body">{content}</div>
      </div>
    </div>
  );
}

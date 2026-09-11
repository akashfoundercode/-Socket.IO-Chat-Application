import React from 'react';

/**
 * ExitConfirmModal
 * 
 * Clean WhatsApp-themed dialog shown when the user taps back at the root/home screen.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {() => void} props.onConfirm - Called when user taps "Yes / Exit"
 * @param {() => void} props.onCancel - Called when user taps "No / Cancel"
 */
export default function ExitConfirmModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="wa-modal-overlay wa-exit-dialog-overlay" onClick={onCancel}>
      <div
        className="wa-exit-dialog-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-dialog-title"
      >
        <div className="wa-exit-dialog-icon-wrap">
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
        </div>

        <h3 id="exit-dialog-title" className="wa-exit-dialog-title">
          Exit App?
        </h3>

        <p className="wa-exit-dialog-desc">
          Are you sure you want to exit the application?
        </p>

        <div className="wa-exit-dialog-actions">
          <button
            type="button"
            className="wa-exit-dialog-btn cancel"
            onClick={onCancel}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className="wa-exit-dialog-btn confirm"
            onClick={onConfirm}
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}


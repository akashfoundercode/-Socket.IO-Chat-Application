import React from 'react';

export default function ContactInfoModal({
  recipientProfile,
  recipientId,
  isOnline,
  onClose,
  onStartCall
}) {
  if (!recipientProfile && !recipientId) return null;

  const displayName = recipientProfile?.name || recipientId || 'Contact Info';
  const displayPhone = recipientProfile?.fullPhone || recipientProfile?.phone || recipientId || '';
  const avatar = recipientProfile?.avatar;
  const about = recipientProfile?.about || 'Hey there! I am using WhatsApp.';

  return (
    <div className="wa-contact-info-overlay" onClick={onClose}>
      <div className="wa-contact-info-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="wa-contact-info-header">
          <button type="button" className="wa-contact-close-btn" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <h3>Contact Info</h3>
        </div>

        <div className="wa-contact-info-body">
          {/* Large Avatar Header */}
          <div className="wa-contact-avatar-section">
            <div className="wa-contact-avatar-circle">
              {avatar ? (
                avatar.length <= 4 ? (
                  <span style={{ fontSize: '72px' }}>{avatar}</span>
                ) : (
                  <img src={avatar} alt="Contact Avatar" />
                )
              ) : (
                <i className="fa-solid fa-user" style={{ fontSize: '60px', color: '#8696a0' }}></i>
              )}
            </div>

            <h2 className="wa-contact-name">{displayName}</h2>
            <div className="wa-contact-phone-sub">{displayPhone}</div>

            {/* Online Status Badge */}
            <div className="wa-contact-status-badge">
              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Quick Action Buttons */}
            <div className="wa-contact-quick-actions">
              <button
                type="button"
                className="wa-contact-action-btn"
                onClick={() => {
                  onClose();
                  onStartCall && onStartCall('voice');
                }}
              >
                <i className="fa-solid fa-phone"></i>
                <span>Audio</span>
              </button>
              <button
                type="button"
                className="wa-contact-action-btn"
                onClick={() => {
                  onClose();
                  onStartCall && onStartCall('video');
                }}
              >
                <i className="fa-solid fa-video"></i>
                <span>Video</span>
              </button>
              <button
                type="button"
                className="wa-contact-action-btn"
                onClick={onClose}
              >
                <i className="fa-solid fa-message"></i>
                <span>Message</span>
              </button>
            </div>
          </div>

          {/* About / Bio Card */}
          <div className="wa-contact-card">
            <div className="wa-card-label">About</div>
            <div className="wa-card-value about-text">{about}</div>
          </div>

          {/* Phone Number Card */}
          <div className="wa-contact-card">
            <div className="wa-card-label">Mobile Number</div>
            <div className="wa-card-value phone-val">
              <span>{displayPhone}</span>
              <span className="wa-badge-verified">Verified User</span>
            </div>
          </div>

          {/* Security & Encryption Card */}
          <div className="wa-contact-card encryption-card">
            <div className="wa-enc-left">
              <i className="fa-solid fa-lock"></i>
              <div>
                <div className="wa-enc-title">Encryption</div>
                <div className="wa-enc-desc">Messages and calls are end-to-end encrypted. Tap to verify.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


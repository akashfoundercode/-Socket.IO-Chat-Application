import React, { useState } from 'react';
import ContactInfoModal from './ContactInfoModal';

export default function ChatHeader({
  userId,
  recipientId,
  recipientName,
  recipientAvatar,
  recipientAbout,
  isRecipientOnline,
  isConnected,
  isTyping,
  onStartCall,
  onBack
}) {
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const displayName = recipientName || recipientId || 'Select Chat';
  const displayPhone = recipientId || '';
  const showSubtitlePhone = recipientName && recipientName !== recipientId;

  const statusText = isTyping
    ? 'typing...'
    : !isConnected
    ? 'connecting...'
    : isRecipientOnline
    ? 'online'
    : 'offline';

  return (
    <>
      <header className="wa-chat-header">
        <div className="wa-chat-header-left">
          <button type="button" className="wa-header-back" onClick={onBack} title="Back">
            <i className="fa-solid fa-arrow-left"></i>
          </button>

          <div
            className="wa-avatar"
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setShowContactInfo(true)}
            title="View Contact Info"
          >
            {recipientAvatar ? (
              recipientAvatar.length <= 4 ? (
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{recipientAvatar}</span>
              ) : (
                <img
                  src={recipientAvatar}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              )
            ) : (
              <i className="fa-solid fa-user"></i>
            )}
            {/* Online Green Dot Badge */}
            {isRecipientOnline && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#25d366',
                  borderRadius: '50%',
                  border: '2px solid #ffffff'
                }}
                title="Online"
              />
            )}
          </div>

          <div
            className="wa-chat-title-wrap"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowContactInfo(true)}
            title="View Contact Info"
          >
            <div className="wa-chat-name" title={displayName}>
              {displayName}
            </div>
            <div className="wa-chat-status">
              {showSubtitlePhone && <span style={{ opacity: 0.85, marginRight: '4px' }}>{displayPhone} •</span>}
              <span
                style={{
                  color: isTyping ? '#25d366' : isRecipientOnline ? '#dcfce7' : 'rgba(255,255,255,0.75)',
                  fontWeight: isTyping ? '700' : 'normal',
                  fontStyle: isTyping ? 'italic' : 'normal',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                {isTyping ? (
                  <>
                    <span>typing</span>
                    <span className="wa-typing-dots">
                      <span className="dot">.</span>
                      <span className="dot">.</span>
                      <span className="dot">.</span>
                    </span>
                  </>
                ) : (
                  statusText
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="wa-chat-header-actions">
          <button
            type="button"
            className="wa-action-icon"
            title="Video Call"
            onClick={() => onStartCall && onStartCall('video')}
          >
            <i className="fa-solid fa-video"></i>
          </button>
          <button
            type="button"
            className="wa-action-icon"
            title="Voice Call"
            onClick={() => onStartCall && onStartCall('voice')}
          >
            <i className="fa-solid fa-phone"></i>
          </button>
          <div className="wa-menu-anchor" style={{ position: 'relative' }}>
            <button
              type="button"
              className="wa-action-icon"
              title="More Options"
              onClick={() => setShowMenu((prev) => !prev)}
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>

            {showMenu && (
              <div className="wa-dropdown-menu" style={{ right: 0, top: '35px' }}>
                <button
                  type="button"
                  className="wa-menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    setShowContactInfo(true);
                  }}
                >
                  <i className="fa-solid fa-user"></i> Contact info
                </button>
                <button
                  type="button"
                  className="wa-menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    onBack && onBack();
                  }}
                >
                  <i className="fa-solid fa-xmark"></i> Close chat
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Dynamic Recipient Contact Info Modal */}
      {showContactInfo && (
        <ContactInfoModal
          recipientId={recipientId}
          recipientProfile={{
            name: displayName,
            phone: displayPhone,
            fullPhone: displayPhone,
            avatar: recipientAvatar,
            about: recipientAbout
          }}
          isOnline={isRecipientOnline}
          onClose={() => setShowContactInfo(false)}
          onStartCall={onStartCall}
        />
      )}
    </>
  );
}

import React from 'react';

export default function ChatHeader({
  userId,
  recipientId,
  recipientName,
  recipientAvatar,
  recipientAbout,
  isRecipientOnline,
  isConnected,
  onBack
}) {
  const displayName = recipientName || recipientId || 'Select Chat';
  const displayPhone = recipientId || '';
  const showSubtitlePhone = recipientName && recipientName !== recipientId;

  const statusText = !isConnected
    ? 'connecting...'
    : isRecipientOnline
      ? 'online'
      : 'offline';

  return (
    <header className="wa-chat-header">
      <div className="wa-chat-header-left">
        <button type="button" className="wa-header-back" onClick={onBack} title="Back">
          <i className="fa-solid fa-arrow-left"></i>
        </button>

        <div className="wa-avatar" style={{ position: 'relative' }}>
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

        <div className="wa-chat-title-wrap">
          <div className="wa-chat-name" title={displayName}>
            {displayName}
          </div>
          <div className="wa-chat-status">
            {showSubtitlePhone && <span style={{ opacity: 0.85, marginRight: '4px' }}>{displayPhone} •</span>}
            <span style={{ color: isRecipientOnline ? '#dcfce7' : 'rgba(255,255,255,0.75)' }}>
              {statusText}
            </span>
          </div>
        </div>
      </div>

      <div className="wa-chat-header-actions">
        <button type="button" className="wa-action-icon" title="Video Call">
          <i className="fa-solid fa-video"></i>
        </button>
        <button type="button" className="wa-action-icon" title="Voice Call">
          <i className="fa-solid fa-phone"></i>
        </button>
        <button type="button" className="wa-action-icon" title="More Options">
          <i className="fa-solid fa-ellipsis-vertical"></i>
        </button>
      </div>
    </header>
  );
}



import React, { useState, useEffect, useRef } from 'react';

function CallAvatar({ avatar, name }) {
  const [imageFailed, setImageFailed] = useState(false);
  const value = String(avatar || '').trim();
  const isEmoji = value && value.length <= 4 && !value.startsWith('/') && !value.startsWith('data:') && !value.startsWith('http');

  if (value && !imageFailed && isEmoji) {
    return <span className="wa-call-emoji-avatar">{value}</span>;
  }

  if (value && !imageFailed) {
    return (
      <img
        src={value}
        alt={name || 'Call participant'}
        className="wa-call-img-avatar"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <i className="fa-brands fa-whatsapp wa-call-default-icon" aria-label="Default avatar"></i>;
}

export default function CallModal({
  callState,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  localVideoTrack,
  remoteVideoTrack,
  onToggleMute,
  onToggleVideo
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [duration, setDuration] = useState(0);

  const localVideoContainerRef = useRef(null);
  const remoteVideoContainerRef = useRef(null);

  // Bind Agora Local Video Track to DOM container
  useEffect(() => {
    if (localVideoContainerRef.current && localVideoTrack) {
      try {
        localVideoTrack.play(localVideoContainerRef.current);
      } catch (err) {
        console.warn('Local video play error:', err);
      }
    }
  }, [localVideoTrack, callState?.callType]);

  // Bind Agora Remote Video Track to DOM container
  useEffect(() => {
    if (remoteVideoContainerRef.current && remoteVideoTrack) {
      try {
        remoteVideoTrack.play(remoteVideoContainerRef.current);
      } catch (err) {
        console.warn('Remote video play error:', err);
      }
    }
  }, [remoteVideoTrack, callState?.callType]);

  // Call duration timer once connected
  useEffect(() => {
    let timer = null;
    if (callState?.isAccepted) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState?.isAccepted]);

  // Mute / Unmute Audio Track
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (onToggleMute) {
      onToggleMute(nextMuted);
    }
  };

  // Enable / Disable Video Track
  const toggleVideo = () => {
    const nextDisabled = !isVideoDisabled;
    setIsVideoDisabled(nextDisabled);
    if (onToggleVideo) {
      onToggleVideo(nextDisabled);
    }
  };

  // Format Duration seconds to mm:ss
  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!callState) return null;

  const isIncoming = callState.isIncoming && !callState.isAccepted;
  const isVideo = callState.callType === 'video';
  const peerName = callState.peerName || callState.peerId || 'User';
  const peerAvatar = callState.peerAvatar;

  return (
    <div className="wa-call-overlay">
      {/* 1. INCOMING CALL NOTIFICATION CARD */}
      {isIncoming ? (
        <div className="wa-incoming-call-card">
          <div className="wa-call-header-tag">
            <i className={`fa-solid ${isVideo ? 'fa-video' : 'fa-phone'}`}></i>
            <span>Incoming WhatsApp {isVideo ? 'Video' : 'Voice'} Call</span>
          </div>

          <div className="wa-incoming-avatar-wrap">
            <CallAvatar avatar={peerAvatar} name={peerName} />
            <div className="wa-call-pulse-ring"></div>
          </div>

          <h3 className="wa-incoming-name">{peerName}</h3>
          <p className="wa-incoming-status">
            {callState.isCallWaiting ? 'Incoming Call Waiting...' : 'Ringing...'}
          </p>

          <div className="wa-incoming-actions">
            {/* Decline Call Button */}
            <button
              type="button"
              className="wa-call-action-btn decline"
              onClick={onRejectCall}
              title="Decline Call"
            >
              <i className="fa-solid fa-phone-slash"></i>
              <span>Decline</span>
            </button>

            {/* Accept Call Button */}
            <button
              type="button"
              className="wa-call-action-btn accept"
              onClick={onAcceptCall}
              title="Accept Call"
            >
              <i className={`fa-solid ${isVideo ? 'fa-video' : 'fa-phone'}`}></i>
              <span>Accept</span>
            </button>
          </div>
        </div>
      ) : (
        /* 2. ACTIVE / OUTGOING CALL MODAL */
        <div className={`wa-active-call-modal ${isVideo ? 'is-video-call' : 'is-voice-call'}`}>
          {/* Top Status & Name Header */}
          <div className="wa-active-call-top">
            <div className="wa-call-secure-badge">
              <i className="fa-solid fa-lock"></i>
              <span>End-to-end encrypted (Agora RTC)</span>
            </div>
            <h2 className="wa-active-call-name">{peerName}</h2>
            <div className="wa-active-call-status">
              {callState.isAccepted
                ? formatDuration(duration)
                : callState.isCallWaiting
                  ? 'User is on another call...'
                  : callState.isRinging
                    ? 'Ringing...'
                    : 'Calling...'}
            </div>
          </div>

          {/* Call Body Area */}
          <div className="wa-active-call-body">
            {isVideo ? (
              /* Video Streams Container */
              <div className="wa-video-call-stage">
                {/* Remote Video Stream Container */}
                <div
                  ref={remoteVideoContainerRef}
                  className="wa-remote-video"
                  style={{ width: '100%', height: '100%', position: 'relative' }}
                />

                {/* Remote fallback if stream not active */}
                {!remoteVideoTrack && (
                  <div className="wa-video-placeholder">
                    <div className="wa-call-avatar-circle">
                      <CallAvatar avatar={peerAvatar} name={peerName} />
                    </div>
                    <span>Waiting for video...</span>
                  </div>
                )}

                {/* Local Video Stream PiP */}
                <div className="wa-local-video-pip">
                  <div
                    ref={localVideoContainerRef}
                    className="wa-local-video"
                    style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
                  />
                  {isVideoDisabled && (
                    <div className="wa-video-disabled-overlay">
                      <i className="fa-solid fa-video-slash"></i>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Voice Call Stage with Pulsing Wave */
              <div className="wa-voice-call-stage">
                <div className="wa-voice-avatar-wrap">
                  <div className="wa-voice-avatar-circle">
                    <CallAvatar avatar={peerAvatar} name={peerName} />
                  </div>
                  {callState.isAccepted && (
                    <>
                      <div className="wa-voice-wave wave-1"></div>
                      <div className="wa-voice-wave wave-2"></div>
                      <div className="wa-voice-wave wave-3"></div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Controls Bar */}
          <div className="wa-active-call-controls">
            {/* Mute Button */}
            <button
              type="button"
              className={`wa-call-ctrl-btn ${isMuted ? 'active-off' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            </button>

            {/* Video Toggle (If Video Call) */}
            {isVideo && (
              <button
                type="button"
                className={`wa-call-ctrl-btn ${isVideoDisabled ? 'active-off' : ''}`}
                onClick={toggleVideo}
                title={isVideoDisabled ? 'Turn Video On' : 'Turn Video Off'}
              >
                <i className={`fa-solid ${isVideoDisabled ? 'fa-video-slash' : 'fa-video'}`}></i>
              </button>
            )}

            {/* End Call Button */}
            <button
              type="button"
              className="wa-call-ctrl-btn end-call"
              onClick={onEndCall}
              title="End Call"
            >
              <i className="fa-solid fa-phone-slash"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


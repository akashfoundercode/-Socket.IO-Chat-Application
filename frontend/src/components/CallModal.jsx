import React, { useState, useEffect, useRef } from 'react';

export default function CallModal({
  callState,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  localStream,
  remoteStream
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Bind streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState?.isAccepted]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState?.isAccepted]);

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
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Enable / Disable Video Track
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
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
            {peerAvatar ? (
              peerAvatar.length <= 4 ? (
                <span className="wa-call-emoji-avatar">{peerAvatar}</span>
              ) : (
                <img src={peerAvatar} alt="Caller Avatar" className="wa-call-img-avatar" />
              )
            ) : (
              <i className="fa-solid fa-user wa-call-default-icon"></i>
            )}
            <div className="wa-call-pulse-ring"></div>
          </div>

          <h3 className="wa-incoming-name">{peerName}</h3>
          <p className="wa-incoming-status">Ringing...</p>

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
              <span>End-to-end encrypted</span>
            </div>
            <h2 className="wa-active-call-name">{peerName}</h2>
            <div className="wa-active-call-status">
              {callState.isAccepted
                ? formatDuration(duration)
                : callState.isIncoming
                ? 'Connecting...'
                : 'Calling...'}
            </div>
          </div>

          {/* Call Body Area */}
          <div className="wa-active-call-body">
            {isVideo ? (
              /* Video Streams Container */
              <div className="wa-video-call-stage">
                {/* Remote Video Stream */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="wa-remote-video"
                />

                {/* Remote fallback if stream not active */}
                {!remoteStream && (
                  <div className="wa-video-placeholder">
                    <div className="wa-call-avatar-circle">
                      {peerAvatar ? (
                        peerAvatar.length <= 4 ? (
                          <span>{peerAvatar}</span>
                        ) : (
                          <img src={peerAvatar} alt="Peer" />
                        )
                      ) : (
                        <i className="fa-solid fa-user"></i>
                      )}
                    </div>
                    <span>Waiting for video...</span>
                  </div>
                )}

                {/* Local Video Stream PiP */}
                <div className="wa-local-video-pip">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="wa-local-video"
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
                    {peerAvatar ? (
                      peerAvatar.length <= 4 ? (
                        <span>{peerAvatar}</span>
                      ) : (
                        <img src={peerAvatar} alt="Peer" />
                      )
                    ) : (
                      <i className="fa-solid fa-user"></i>
                    )}
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

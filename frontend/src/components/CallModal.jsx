import React, { useState, useEffect, useRef } from 'react';

// Generates consistent color based on string
const getAvatarColor = (str) => {
  const colors = [
    'linear-gradient(135deg, #25d366, #128c7e)',
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #ec4899, #be185d)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    'linear-gradient(135deg, #10b981, #047857)',
    'linear-gradient(135deg, #06b6d4, #0e7490)'
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
};

function CallAvatar({ avatar, name, size = 'default' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const value = String(avatar || '').trim();
  const isEmoji = value && value.length <= 4 && !value.startsWith('/') && !value.startsWith('data:') && !value.startsWith('http');

  if (value && !imageFailed && isEmoji) {
    return <span className={`wa-call-emoji-avatar ${size}`}>{value}</span>;
  }

  if (value && !imageFailed) {
    return (
      <img
        src={value}
        alt={name || 'Call participant'}
        className={`wa-call-img-avatar ${size}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  const initial = (name || 'U').charAt(0).toUpperCase();
  return (
    <div
      className={`wa-call-initial-avatar ${size}`}
      style={{ background: getAvatarColor(name || 'user') }}
    >
      <span>{initial}</span>
    </div>
  );
}

export default function CallModal({
  callState,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  localVideoTrack,
  remoteVideoTrack,
  onToggleMute,
  onToggleVideo,
  participants = [],
  speakingVolumes = {},
  currentUserId,
  currentUser
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
  const isGroup = Boolean(callState.groupId || String(callState.peerId || '').startsWith('group:'));
  const peerName = callState.peerName || callState.peerId || 'User';
  const peerAvatar = callState.peerAvatar;

  // Build complete participants list
  const activeParticipants = React.useMemo(() => {
    if (!isGroup) return [];

    // Ensure self is in participants list
    const selfItem = {
      uid: 'self',
      userId: currentUserId || 'self',
      name: currentUser?.name || currentUser?.fullPhone || 'You',
      avatar: currentUser?.avatar || null,
      isSelf: true,
      isMuted: isMuted,
      volume: speakingVolumes['self'] || speakingVolumes[0] || 0
    };

    const remoteList = (participants || []).filter((p) => !p.isSelf && p.userId !== currentUserId);

    // If caller is in callState but not in remoteList yet, include them
    if (callState.callerId && callState.callerId !== currentUserId && !remoteList.some((p) => p.userId === callState.callerId)) {
      remoteList.push({
        uid: callState.callerId,
        userId: callState.callerId,
        name: callState.peerName || callState.callerId,
        avatar: callState.peerAvatar,
        isSelf: false,
        isMuted: false,
        volume: speakingVolumes[callState.callerId] || 0
      });
    }

    return [selfItem, ...remoteList];
  }, [isGroup, participants, currentUserId, currentUser, isMuted, speakingVolumes, callState]);

  const participantCount = activeParticipants.length;

  // Grid class calculation based on total number of participants
  const getGridClass = (count) => {
    if (count <= 1) return 'wa-grid-1';
    if (count === 2) return 'wa-grid-2';
    if (count <= 4) return 'wa-grid-4';
    if (count <= 6) return 'wa-grid-6';
    return 'wa-grid-multi';
  };

  return (
    <div className="wa-call-overlay">
      {/* 1. INCOMING CALL NOTIFICATION CARD */}
      {isIncoming ? (
        <div className="wa-incoming-call-card">
          <div className="wa-call-header-tag">
            <i className={`fa-solid ${isVideo ? 'fa-video' : 'fa-phone'}`}></i>
            <span>{isGroup ? 'Group' : 'Incoming'} {isVideo ? 'Video' : 'Voice'} Call</span>
          </div>

          <div className="wa-incoming-avatar-wrap">
            <CallAvatar avatar={peerAvatar} name={peerName} size="large" />
            <div className="wa-call-pulse-ring"></div>
          </div>

          <h3 className="wa-incoming-name">{peerName}</h3>
          {isGroup && callState.callerName && (
            <p className="wa-incoming-status" style={{ fontSize: '13px', opacity: 0.85 }}>
              from {callState.callerName}
            </p>
          )}

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
              title={isGroup ? 'Join Call' : 'Accept Call'}
            >
              <i className={`fa-solid ${isVideo ? 'fa-video' : 'fa-phone'}`}></i>
              <span>{isGroup ? 'Join' : 'Accept'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* 2. ACTIVE / OUTGOING CALL MODAL */
        <div className={`wa-active-call-modal ${isGroup ? 'is-group-call' : ''} ${isVideo ? 'is-video-call' : 'is-voice-call'}`}>
          {/* Top Status & Info Header */}
          <div className="wa-active-call-top">
            <div className="wa-call-top-row">
              <div className="wa-call-secure-badge">
                <i className="fa-solid fa-lock"></i>
                <span>End-to-end encrypted (Agora RTC)</span>
              </div>
              {isGroup && (
                <div className="wa-call-count-pill">
                  <i className="fa-solid fa-users"></i>
                  <span>{participantCount} {participantCount === 1 ? 'Participant' : 'Participants'}</span>
                </div>
              )}
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
            {isGroup ? (
              /* MULTI-USER DYNAMIC GROUP CALL GRID (1, 2, 3, 4, 5, 6+ Tiles) */
              <div className={`wa-group-call-stage ${getGridClass(participantCount)}`}>
                {activeParticipants.map((participant, index) => {
                  const vol = participant.isSelf
                    ? (isMuted ? 0 : (speakingVolumes['self'] || speakingVolumes[0] || 0))
                    : (speakingVolumes[participant.uid] || speakingVolumes[participant.userId] || 0);
                  const isSpeaking = vol > 6;
                  const isParticipantMuted = participant.isSelf ? isMuted : Boolean(participant.isMuted);

                  return (
                    <div
                      key={participant.uid || participant.userId || index}
                      className={`wa-participant-tile ${participant.isSelf ? 'is-self' : ''} ${isSpeaking ? 'is-speaking' : ''} ${isParticipantMuted ? 'is-muted' : ''}`}
                    >
                      {/* Speaking Pulse Ring & Glow */}
                      {isSpeaking && <div className="wa-tile-speaking-glow" />}

                      {/* Participant Avatar Container */}
                      <div className="wa-tile-avatar-wrap">
                        <div className={`wa-tile-avatar-circle ${isSpeaking ? 'speaking' : ''}`}>
                          <CallAvatar
                            avatar={participant.avatar}
                            name={participant.name}
                            size={participantCount > 4 ? 'small' : 'medium'}
                          />
                        </div>

                        {/* Animated 3-Bar Speaking Equalizer Waves */}
                        {isSpeaking && (
                          <div className="wa-tile-equalizer">
                            <span className="eq-bar bar-1" />
                            <span className="eq-bar bar-2" />
                            <span className="eq-bar bar-3" />
                          </div>
                        )}

                        {/* Mute Indicator Badge */}
                        {isParticipantMuted && (
                          <div className="wa-tile-mute-badge" title="Microphone Muted">
                            <i className="fa-solid fa-microphone-slash"></i>
                          </div>
                        )}
                      </div>

                      {/* Participant Name & Status Footer */}
                      <div className="wa-tile-info">
                        <span className="wa-tile-name">
                          {participant.name} {participant.isSelf && <strong className="wa-self-tag">(You)</strong>}
                        </span>
                        <span className="wa-tile-status-text">
                          {isSpeaking
                            ? 'Speaking...'
                            : isParticipantMuted
                              ? 'Muted'
                              : callState.isAccepted
                                ? 'Connected'
                                : 'Connecting...'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isVideo ? (
              /* 1-on-1 Video Call Stage */
              <div className="wa-video-call-stage">
                <div
                  ref={remoteVideoContainerRef}
                  className="wa-remote-video"
                  style={{ width: '100%', height: '100%', position: 'relative' }}
                />

                {!remoteVideoTrack && (
                  <div className="wa-video-placeholder">
                    <div className="wa-call-avatar-circle">
                      <CallAvatar avatar={peerAvatar} name={peerName} size="large" />
                    </div>
                    <span>Waiting for video...</span>
                  </div>
                )}

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
              /* 1-on-1 Voice Call Stage with Pulsing Wave */
              <div className="wa-voice-call-stage">
                <div className="wa-voice-avatar-wrap">
                  <div className="wa-voice-avatar-circle">
                    <CallAvatar avatar={peerAvatar} name={peerName} size="large" />
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
            {/* Mute / Unmute Button */}
            <button
              type="button"
              className={`wa-call-ctrl-btn ${isMuted ? 'active-off' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            </button>

            {/* Video Toggle (If Video Call) */}
            {isVideo && (
              <button
                type="button"
                className={`wa-call-ctrl-btn ${isVideoDisabled ? 'active-off' : ''}`}
                onClick={toggleVideo}
                title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                <i className={`fa-solid ${isVideoDisabled ? 'fa-video-slash' : 'fa-video'}`}></i>
              </button>
            )}

            {/* Leave / End Call Button */}
            <button
              type="button"
              className="wa-call-ctrl-btn end-call"
              onClick={onEndCall}
              title={isGroup ? 'Leave group call' : 'End call'}
            >
              <i className="fa-solid fa-phone-slash"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


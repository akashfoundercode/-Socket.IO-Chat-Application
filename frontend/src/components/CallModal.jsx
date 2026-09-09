import React, { useState, useEffect, useRef } from 'react';

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

function CallAvatar({ avatar, name, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const val = String(avatar || '').trim();
  const invalid = !val || val === 'null' || val === 'undefined' || val.toLowerCase() === 'avatar';
  const isEmoji = !invalid && val.length <= 4 && !val.startsWith('/') && !val.startsWith('data:') && !val.startsWith('http');

  if (!invalid && !failed && isEmoji) return <span className={`cav-emoji cav-${size}`}>{val}</span>;
  if (!invalid && !failed) return <img src={val} alt="" className={`cav-img cav-${size}`} onError={() => setFailed(true)} />;

  const initial = (name || 'U').charAt(0).toUpperCase();
  return (
    <div className={`cav-initial cav-${size}`} style={{ background: getAvatarColor(name || 'user') }}>
      <span>{initial}</span>
    </div>
  );
}

// Video tile for group video calls — each participant gets their own video container
function VideoTile({ participant, videoTrack, isSpeaking, isMuted, count }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && videoTrack) {
      try {
        containerRef.current.innerHTML = '';
        videoTrack.play(containerRef.current);
      } catch (e) {
        console.warn('[VideoTile] Play error:', e);
      }
    }
  }, [videoTrack]);

  return (
    <div className={`call-tile ${isSpeaking ? 'speaking' : ''} ${isMuted ? 'muted' : ''} ${count > 4 ? 'tile-sm' : ''}`}>
      {isSpeaking && <div className="tile-glow" />}
      <div ref={containerRef} className="tile-video-container" style={{ display: videoTrack ? 'block' : 'none' }} />
      {!videoTrack && (
        <div className="tile-avatar-bg">
          <div className={`tile-avatar-ring ${isSpeaking ? 'ring-active' : ''}`}>
            <CallAvatar avatar={participant.avatar} name={participant.name} size={count > 4 ? 'sm' : 'md'} />
          </div>
          {isSpeaking && (
            <div className="tile-eq">
              <span className="eq-b b1" /><span className="eq-b b2" /><span className="eq-b b3" /><span className="eq-b b4" />
            </div>
          )}
        </div>
      )}
      <div className="tile-footer">
        <span className="tile-name">{participant.name}{participant.isSelf ? ' (You)' : ''}</span>
        {isMuted && <i className="fa-solid fa-microphone-slash tile-mute-icon" />}
        {isSpeaking && !isMuted && <i className="fa-solid fa-volume-high tile-speak-icon" />}
      </div>
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
  remoteVideoTracks = {},
  onToggleMute,
  onToggleVideo,
  participants = [],
  speakingVolumes = {},
  currentUserId,
  currentUser
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localVideoTrack) {
      try { localVideoTrack.play(localVideoRef.current); } catch (e) { /* ignore */ }
    }
  }, [localVideoTrack, callState?.callType]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoTrack) {
      try { remoteVideoTrack.play(remoteVideoRef.current); } catch (e) { /* ignore */ }
    }
  }, [remoteVideoTrack, callState?.callType]);

  useEffect(() => {
    let t = null;
    if (callState?.isAccepted) {
      t = setInterval(() => setDuration(p => p + 1), 1000);
    } else {
      setDuration(0);
    }
    return () => { if (t) clearInterval(t); };
  }, [callState?.isAccepted]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    onToggleMute?.(next);
  };

  const toggleVideo = () => {
    const next = !isVideoOff;
    setIsVideoOff(next);
    onToggleVideo?.(next);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!callState) return null;

  const isIncoming = callState.isIncoming && !callState.isAccepted;
  const isVideo = callState.callType === 'video';
  const isGroup = Boolean(callState.groupId || String(callState.peerId || '').startsWith('group:'));
  const peerName = callState.peerName || callState.peerId || 'User';
  const peerAvatar = callState.peerAvatar;

  const statusText = callState.isAccepted
    ? fmt(duration)
    : callState.isCallWaiting
      ? 'User is on another call...'
      : callState.isRinging ? 'Ringing...' : 'Calling...';

  // Build participants list for group call
  const allParticipants = React.useMemo(() => {
    if (!isGroup) return [];
    const self = {
      uid: 'self',
      agoraUid: 'self',
      userId: currentUserId || 'self',
      name: currentUser?.name || currentUser?.fullPhone || 'You',
      avatar: currentUser?.avatar || null,
      isSelf: true,
      isMuted,
      volume: speakingVolumes['self'] || speakingVolumes[0] || 0
    };

    // Deduplicate and filter out any invalid or self entries
    const seenKeys = new Set(['self', String(currentUserId)]);
    const remoteList = [];

    for (const p of (participants || [])) {
      if (!p || p.isSelf) continue;
      const agoraKey = p.agoraUid !== undefined && p.agoraUid !== null ? String(p.agoraUid) : (p.uid !== undefined && p.uid !== null ? String(p.uid) : null);
      const userKey = p.userId ? String(p.userId) : null;
      if (agoraKey && seenKeys.has(agoraKey)) continue;
      if (userKey && seenKeys.has(userKey)) continue;

      if (agoraKey) seenKeys.add(agoraKey);
      if (userKey) seenKeys.add(userKey);
      remoteList.push(p);
    }

    return [self, ...remoteList];
  }, [isGroup, participants, currentUserId, currentUser, isMuted, speakingVolumes]);

  const count = allParticipants.length;

  // Grid layout class: 1, 2, 3-4, 5-6, 7+
  const gridClass = count <= 1 ? 'grid-1' : count === 2 ? 'grid-2' : count <= 4 ? 'grid-4' : count <= 6 ? 'grid-6' : 'grid-many';

  return (
    <div className="call-overlay">
      {isIncoming ? (
        /* ── INCOMING CALL CARD ── */
        <div className="incoming-card">
          <div className="incoming-badge">
            <i className={`fa-solid ${isVideo ? 'fa-video' : 'fa-phone'}`} />
            <span>{isGroup ? 'Group' : 'Incoming'} {isVideo ? 'Video' : 'Voice'} Call</span>
          </div>
          <div className="incoming-avatar-wrap">
            <CallAvatar avatar={peerAvatar} name={peerName} size="xl" />
            <div className="pulse-ring r1" /><div className="pulse-ring r2" /><div className="pulse-ring r3" />
          </div>
          <h3 className="incoming-name">{peerName}</h3>
          {isGroup && callState.callerName && (
            <p className="incoming-sub">from {callState.callerName}</p>
          )}
          <div className="incoming-actions">
            <button type="button" className="inc-btn decline" onClick={onRejectCall}>
              <span className="inc-btn-icon"><i className="fa-solid fa-phone-slash" /></span>
              <span className="inc-btn-label">Decline</span>
            </button>
            <button type="button" className="inc-btn accept" onClick={onAcceptCall}>
              <span className="inc-btn-icon"><i className={`fa-solid ${isVideo ? 'fa-video' : 'fa-phone'}`} /></span>
              <span className="inc-btn-label">{isGroup ? 'Join' : 'Accept'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── ACTIVE CALL MODAL ── */
        <div className={`active-call ${isGroup ? 'is-group' : ''} ${isVideo ? 'is-video' : 'is-voice'}`}>

          {/* Top bar */}
          <div className="call-topbar">
            <div className="call-secure-tag">
              <i className="fa-solid fa-lock" />
              <span>End-to-end encrypted</span>
            </div>
            <div className="call-peer-info">
              <span className="call-peer-name">{peerName}</span>
              <span className={`call-status-text ${callState.isAccepted ? 'connected' : 'ringing'}`}>
                {statusText}
              </span>
            </div>
            {isGroup && (
              <div className="call-participants-pill">
                <i className="fa-solid fa-users" />
                <span>{count}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="call-body">
            {isGroup ? (
              /* ── GROUP CALL GRID ── */
              <div className={`group-grid ${gridClass}`}>
                {allParticipants.map((p, i) => {
                  const vol = p.isSelf
                    ? (isMuted ? 0 : (speakingVolumes['self'] || speakingVolumes[0] || 0))
                    : (speakingVolumes[p.agoraUid] || speakingVolumes[p.uid] || speakingVolumes[p.userId] || 0);
                  const speaking = vol > 6;
                  const muted = p.isSelf ? isMuted : Boolean(p.isMuted);
                  const vTrack = p.isSelf
                    ? (isVideo ? localVideoTrack : null)
                    : (isVideo ? (remoteVideoTracks[p.agoraUid] || remoteVideoTracks[p.uid] || remoteVideoTracks[p.userId] || (allParticipants.filter(x => !x.isSelf).length === 1 ? Object.values(remoteVideoTracks)[0] : null) || remoteVideoTrack) : null);
                  return (
                    <VideoTile
                      key={p.agoraUid ? `agora-${p.agoraUid}` : (p.userId ? `user-${p.userId}` : `part-${i}`)}
                      participant={p}
                      videoTrack={isVideo ? vTrack : null}
                      isSpeaking={speaking}
                      isMuted={muted}
                      count={count}
                    />
                  );
                })}
              </div>
            ) : isVideo ? (
              /* ── 1-on-1 VIDEO ── */
              <div className="video-stage">
                <div ref={remoteVideoRef} className="remote-video" />
                {!remoteVideoTrack && (
                  <div className="video-waiting">
                    <div className="video-waiting-avatar">
                      <CallAvatar avatar={peerAvatar} name={peerName} size="xl" />
                    </div>
                    <span>Waiting for video...</span>
                  </div>
                )}
                <div className="local-pip">
                  <div ref={localVideoRef} className="local-video-inner" />
                  {isVideoOff && (
                    <div className="pip-cam-off">
                      <i className="fa-solid fa-video-slash" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── 1-on-1 VOICE ── */
              <div className="voice-stage">
                <div className="voice-bg-blur" style={{ background: getAvatarColor(peerName) }} />
                <div className="voice-center">
                  <div className={`voice-avatar-ring ${callState.isAccepted ? 'ring-pulse' : ''}`}>
                    <div className="voice-avatar-inner">
                      <CallAvatar avatar={peerAvatar} name={peerName} size="xl" />
                    </div>
                  </div>
                  {callState.isAccepted && (
                    <>
                      <div className="vwave w1" /><div className="vwave w2" /><div className="vwave w3" />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="call-controls">
            <button
              type="button"
              className={`ctrl-btn ${isMuted ? 'ctrl-off' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`} />
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {isVideo && (
              <button
                type="button"
                className={`ctrl-btn ${isVideoOff ? 'ctrl-off' : ''}`}
                onClick={toggleVideo}
                title={isVideoOff ? 'Camera On' : 'Camera Off'}
              >
                <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`} />
                <span>Camera</span>
              </button>
            )}

            <button
              type="button"
              className={`ctrl-btn ${isSpeakerOn ? '' : 'ctrl-off'}`}
              onClick={() => setIsSpeakerOn(p => !p)}
              title="Speaker"
            >
              <i className={`fa-solid ${isSpeakerOn ? 'fa-volume-high' : 'fa-volume-xmark'}`} />
              <span>Speaker</span>
            </button>

            <button type="button" className="ctrl-btn ctrl-end" onClick={onEndCall} title="End call">
              <i className="fa-solid fa-phone-slash" />
              <span>{isGroup ? 'Leave' : 'End'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

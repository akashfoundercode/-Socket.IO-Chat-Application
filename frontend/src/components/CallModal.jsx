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

function CallAvatar({ avatar, name, isGroup = false, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const val = String(avatar || '').trim();
  const invalid = !val || val === 'null' || val === 'undefined' || val.toLowerCase() === 'avatar' || val.toLowerCase() === 'contact avatar' || val.toLowerCase() === 'user' || val.toLowerCase() === 'group';
  const isEmoji = !invalid && val.length <= 4 && !val.startsWith('/') && !val.startsWith('data:') && !val.startsWith('http');

  if (!invalid && !failed && isEmoji) return <span className={`cav-emoji cav-${size}`}>{val}</span>;
  if (!invalid && !failed) return <img src={val} alt="" className={`cav-img cav-${size}`} onError={() => setFailed(true)} />;

  return (
    <div className={`cav-dummy cav-${size}`} style={{ background: getAvatarColor(name || (isGroup ? 'group' : 'user')) }}>
      <i className={`fa-solid ${isGroup ? 'fa-users' : 'fa-user'}`}></i>
    </div>
  );
}

// Video tile for equal grid layout
function VideoTile({ participant, videoTrack, isSpeaking, isMuted, count, onClick }) {
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
    <div
      className={`call-tile ${isSpeaking ? 'speaking' : ''} ${isMuted ? 'muted' : ''} ${count > 4 ? 'tile-sm' : ''}`}
      onClick={onClick}
    >
      {isSpeaking && <div className="tile-glow" />}
      <div ref={containerRef} className="tile-video-container" style={{ display: videoTrack ? 'block' : 'none' }} />
      {!videoTrack && (
        <div className="tile-avatar-bg">
          <div className={`tile-avatar-ring ${isSpeaking ? 'ring-active' : ''}`}>
            <CallAvatar avatar={participant.avatar} name={participant.name} isGroup={Boolean(participant.isGroup)} size={count > 4 ? 'sm' : 'md'} />
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

// Compact Video Thumbnail Tile for Stage View
function VideoThumbnailTile({ participant, videoTrack, isSpeaking, isMuted, isSelected, onClick }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && videoTrack) {
      try {
        containerRef.current.innerHTML = '';
        videoTrack.play(containerRef.current);
      } catch (e) {
        console.warn('[VideoThumbnailTile] Play error:', e);
      }
    }
  }, [videoTrack]);

  return (
    <div
      className={`call-thumbnail-tile ${isSelected ? 'is-selected' : ''} ${isSpeaking ? 'speaking' : ''}`}
      onClick={onClick}
      title={`Click to focus on ${participant.name}`}
    >
      {isSpeaking && <div className="thumb-glow" />}
      <div ref={containerRef} className="thumb-video-container" style={{ display: videoTrack ? 'block' : 'none' }} />
      {!videoTrack && (
        <div className="thumb-avatar-bg">
          <CallAvatar avatar={participant.avatar} name={participant.name} isGroup={Boolean(participant.isGroup)} size="sm" />
        </div>
      )}
      <div className="thumb-footer">
        <span className="thumb-name">{participant.name}{participant.isSelf ? ' (You)' : ''}</span>
        {isMuted && <i className="fa-solid fa-microphone-slash thumb-mute-icon" />}
        {isSpeaking && !isMuted && <i className="fa-solid fa-volume-high thumb-speak-icon" />}
      </div>
    </div>
  );
}

// Main Video Stage for focused participant
function MainVideoStage({ participant, videoTrack, isSpeaking, isMuted, isVideoOff }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && videoTrack) {
      try {
        containerRef.current.innerHTML = '';
        videoTrack.play(containerRef.current);
      } catch (e) {
        console.warn('[MainVideoStage] Play error:', e);
      }
    }
  }, [videoTrack]);

  return (
    <div className={`main-stage-wrapper ${isSpeaking ? 'speaking' : ''}`}>
      <div ref={containerRef} className="main-stage-video" style={{ display: videoTrack && !isVideoOff ? 'block' : 'none' }} />
      {(!videoTrack || isVideoOff) && (
        <div className="main-stage-avatar-bg">
          <div className={`main-stage-avatar-ring ${isSpeaking ? 'ring-pulse' : ''}`}>
            <CallAvatar avatar={participant?.avatar} name={participant?.name || 'User'} isGroup={Boolean(participant?.isGroup)} size="xl" />
          </div>
          <span className="main-stage-status">
            {isVideoOff ? 'Camera is off' : 'Waiting for video...'}
          </span>
        </div>
      )}
      <div className="main-stage-badge">
        <span className="main-stage-name">{participant?.name}{participant?.isSelf ? ' (You)' : ''}</span>
        {isMuted && <i className="fa-solid fa-microphone-slash main-stage-mute" />}
        {isSpeaking && !isMuted && <i className="fa-solid fa-volume-high main-stage-speak" />}
      </div>
    </div>
  );
}

export default function CallModal({
  callState,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  onMinimize,
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
  const [selectedMainKey, setSelectedMainKey] = useState(null);
  const [viewMode, setViewMode] = useState('stage'); // 'stage' | 'grid'
  const [swap1on1, setSwap1on1] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localVideoTrack) {
      try { localVideoTrack.play(localVideoRef.current); } catch (e) { /* ignore */ }
    }
  }, [localVideoTrack, callState?.callType, swap1on1]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoTrack) {
      try { remoteVideoTrack.play(remoteVideoRef.current); } catch (e) { /* ignore */ }
    }
  }, [remoteVideoTrack, callState?.callType, swap1on1]);

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

  // Build unified participants list for group call
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

  // Find track for a participant
  const getTrackForParticipant = (p) => {
    if (!isVideo || !p) return null;
    if (p.isSelf) return isVideoOff ? null : localVideoTrack;
    return remoteVideoTracks[p.agoraUid] ||
      remoteVideoTracks[p.uid] ||
      remoteVideoTracks[String(p.agoraUid)] ||
      remoteVideoTracks[String(p.uid)] ||
      remoteVideoTracks[p.userId] ||
      null;
  };

  // Determine main participant in group call
  const mainParticipant = React.useMemo(() => {
    if (allParticipants.length === 0) return null;
    if (selectedMainKey) {
      const match = allParticipants.find(p => {
        const key = p.isSelf ? 'self' : String(p.agoraUid || p.uid || p.userId);
        return key === selectedMainKey;
      });
      if (match) return match;
    }
    // Default to first remote participant with video or active speaker, else first remote, else self
    const firstRemoteWithVideo = allParticipants.find(p => !p.isSelf && getTrackForParticipant(p));
    if (firstRemoteWithVideo) return firstRemoteWithVideo;
    const firstRemote = allParticipants.find(p => !p.isSelf);
    return firstRemote || allParticipants[0];
  }, [allParticipants, selectedMainKey, remoteVideoTracks, isVideoOff, localVideoTrack]);

  // Thumbnails (all participants except main, or all participants including self)
  const thumbnailParticipants = React.useMemo(() => {
    if (allParticipants.length <= 1) return [];
    const mainKey = mainParticipant?.isSelf ? 'self' : String(mainParticipant?.agoraUid || mainParticipant?.uid || mainParticipant?.userId);
    return allParticipants.filter(p => {
      const key = p.isSelf ? 'self' : String(p.agoraUid || p.uid || p.userId);
      return key !== mainKey;
    });
  }, [allParticipants, mainParticipant]);

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
            <CallAvatar avatar={peerAvatar} name={peerName} isGroup={isGroup} size="xl" />
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
            <div className="call-topbar-left">
              {onMinimize && (
                <button
                  type="button"
                  className="call-back-btn"
                  onClick={onMinimize}
                  title="Minimize Call / Return to chats"
                >
                  <i className="fa-solid fa-arrow-left" />
                  <span>Back</span>
                </button>
              )}
              <div className="call-secure-tag">
                <i className="fa-solid fa-lock" />
                <span>Encrypted</span>
              </div>
            </div>

            <div className="call-peer-info">
              <span className="call-peer-name">{peerName}</span>
              <span className={`call-status-text ${callState.isAccepted ? 'connected' : 'ringing'}`}>
                {statusText}
              </span>
            </div>

            <div className="call-topbar-right">
              {isGroup && (
                <div className="call-participants-pill" title={`${count} active participants`}>
                  <i className="fa-solid fa-users" />
                  <span>{count}</span>
                </div>
              )}
              {isGroup && isVideo && count >= 3 && (
                <button
                  type="button"
                  className="call-view-toggle-btn"
                  onClick={() => setViewMode(v => v === 'stage' ? 'grid' : 'stage')}
                  title={viewMode === 'stage' ? 'Switch to Grid View' : 'Switch to Stage View'}
                >
                  <i className={`fa-solid ${viewMode === 'stage' ? 'fa-table-cells-large' : 'fa-chalkboard-user'}`} />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="call-body">
            {isGroup ? (
              /* ── GROUP CALL (VIDEO / VOICE) ── */
              isVideo ? (
                viewMode === 'stage' && count >= 3 ? (
                  /* Modern Main Stage + Small Floating/Bottom Thumbnails Strip */
                  <div className="stage-view-container">
                    <div className="stage-main-area">
                      {mainParticipant && (
                        <MainVideoStage
                          participant={mainParticipant}
                          videoTrack={getTrackForParticipant(mainParticipant)}
                          isSpeaking={
                            mainParticipant.isSelf
                              ? (isMuted ? false : (speakingVolumes['self'] || speakingVolumes[0] || 0) > 6)
                              : ((speakingVolumes[mainParticipant.agoraUid] || speakingVolumes[mainParticipant.uid] || speakingVolumes[mainParticipant.userId] || 0) > 6)
                          }
                          isMuted={mainParticipant.isSelf ? isMuted : Boolean(mainParticipant.isMuted)}
                          isVideoOff={mainParticipant.isSelf ? isVideoOff : false}
                        />
                      )}
                    </div>

                    {/* Small Thumbnails Strip */}
                    {thumbnailParticipants.length > 0 && (
                      <div className="call-thumbnails-strip">
                        {thumbnailParticipants.map((p, i) => {
                          const pKey = p.isSelf ? 'self' : String(p.agoraUid || p.uid || p.userId || i);
                          const vol = p.isSelf
                            ? (isMuted ? 0 : (speakingVolumes['self'] || speakingVolumes[0] || 0))
                            : (speakingVolumes[p.agoraUid] || speakingVolumes[p.uid] || speakingVolumes[p.userId] || 0);
                          const speaking = vol > 6;
                          const muted = p.isSelf ? isMuted : Boolean(p.isMuted);
                          const vTrack = getTrackForParticipant(p);

                          return (
                            <VideoThumbnailTile
                              key={pKey}
                              participant={p}
                              videoTrack={vTrack}
                              isSpeaking={speaking}
                              isMuted={muted}
                              isSelected={false}
                              onClick={() => setSelectedMainKey(pKey)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Equal Grid View (for 1-2 users or when toggled to grid) */
                  <div className={`group-grid ${gridClass}`}>
                    {allParticipants.map((p, i) => {
                      const pKey = p.isSelf ? 'self' : String(p.agoraUid || p.uid || p.userId || i);
                      const vol = p.isSelf
                        ? (isMuted ? 0 : (speakingVolumes['self'] || speakingVolumes[0] || 0))
                        : (speakingVolumes[p.agoraUid] || speakingVolumes[p.uid] || speakingVolumes[p.userId] || 0);
                      const speaking = vol > 6;
                      const muted = p.isSelf ? isMuted : Boolean(p.isMuted);
                      const vTrack = getTrackForParticipant(p);
                      return (
                        <VideoTile
                          key={pKey}
                          participant={p}
                          videoTrack={vTrack}
                          isSpeaking={speaking}
                          isMuted={muted}
                          count={count}
                          onClick={() => {
                            if (count >= 3) {
                              setSelectedMainKey(pKey);
                              setViewMode('stage');
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                )
              ) : (
                /* Group Voice Grid */
                <div className={`group-grid ${gridClass}`}>
                  {allParticipants.map((p, i) => {
                    const pKey = p.isSelf ? 'self' : String(p.agoraUid || p.uid || p.userId || i);
                    const vol = p.isSelf
                      ? (isMuted ? 0 : (speakingVolumes['self'] || speakingVolumes[0] || 0))
                      : (speakingVolumes[p.agoraUid] || speakingVolumes[p.uid] || speakingVolumes[p.userId] || 0);
                    const speaking = vol > 6;
                    const muted = p.isSelf ? isMuted : Boolean(p.isMuted);
                    return (
                      <VideoTile
                        key={pKey}
                        participant={p}
                        videoTrack={null}
                        isSpeaking={speaking}
                        isMuted={muted}
                        count={count}
                      />
                    );
                  })}
                </div>
              )
            ) : isVideo ? (
              /* ── 1-on-1 VIDEO (Main Remote Video + Small Floating Local PiP with swap) ── */
              <div className="video-stage">
                <div
                  ref={swap1on1 ? localVideoRef : remoteVideoRef}
                  className="remote-video"
                />
                {!remoteVideoTrack && !swap1on1 && (
                  <div className="video-waiting">
                    <div className="video-waiting-avatar">
                      <CallAvatar avatar={peerAvatar} name={peerName} isGroup={isGroup} size="xl" />
                    </div>
                    <span>{callState.isAccepted ? 'Waiting for video...' : (callState.isRinging ? 'Ringing...' : 'Calling...')}</span>
                  </div>
                )}
                {swap1on1 && isVideoOff && (
                  <div className="video-waiting">
                    <div className="video-waiting-avatar">
                      <CallAvatar avatar={currentUser?.avatar} name={currentUser?.name || 'You'} isGroup={false} size="xl" />
                    </div>
                    <span>Camera is off</span>
                  </div>
                )}

                {/* Floating PiP Tile */}
                <div
                  className="local-pip"
                  onClick={() => setSwap1on1(s => !s)}
                  title="Click to swap focus"
                >
                  <div
                    ref={swap1on1 ? remoteVideoRef : localVideoRef}
                    className="local-video-inner"
                  />
                  {(!swap1on1 ? isVideoOff : !remoteVideoTrack) && (
                    <div className="pip-cam-off">
                      <i className="fa-solid fa-video-slash" />
                    </div>
                  )}
                  <span className="pip-label">{swap1on1 ? peerName : 'You'}</span>
                </div>
              </div>
            ) : (
              /* ── 1-on-1 VOICE ── */
              <div className="voice-stage">
                <div className="voice-bg-blur" style={{ background: getAvatarColor(peerName) }} />
                <div className="voice-center">
                  <div className={`voice-avatar-ring ${callState.isAccepted ? 'ring-pulse' : ''}`}>
                    <div className="voice-avatar-inner">
                      <CallAvatar avatar={peerAvatar} name={peerName} isGroup={isGroup} size="xl" />
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

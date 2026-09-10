import React, { useState, useEffect, useRef } from 'react';
import { statusApi, resolveMediaUrl } from '../services/api';
import { socket } from '../socket/socket';
import Avatar from './Avatar';

const BG_COLORS = [
  '#c2410c', '#ea580c', '#f97316', '#1a1a2e', '#16213e',
  '#0f3460', '#533483', '#e94560', '#f5a623', '#2c3e50',
  '#8e44ad', '#2980b9', '#27ae60', '#e74c3c', '#f39c12'
];
const FONT_STYLES = [
  { value: 'normal', label: 'Aa' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
  { value: 'cursive', label: 'Script' },
  { value: 'bold', label: 'Bold' }
];
const FONT_MAP = {
  normal: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Courier, monospace',
  cursive: 'cursive',
  bold: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '🎉', '😍', '👏'];

function AvatarCircle({ avatar, size = 46 }) {
  return <Avatar src={avatar} size={size} />;
}

function StatusRing({ avatar, hasNew, size = 52 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: hasNew
        ? 'linear-gradient(135deg, #25D366 0%, #00a884 100%)'
        : '#8696a0',
      padding: '2.5px',
      transition: 'background 0.3s ease'
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', overflow: 'hidden' }}>
        <AvatarCircle avatar={avatar} size={size - 7} />
      </div>
    </div>
  );
}

/* ── Viewers slide-up panel ── */
function ViewersPanel({ statusId, ownerId, onClose }) {
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchViewers = () => {
      statusApi.getViewers(statusId, ownerId)
        .then(d => { if (d?.success) setViewers(d.viewers || []); })
        .finally(() => setLoading(false));
    };

    fetchViewers();

    const handleLiveView = (data) => {
      if (!data?.statusId || String(data.statusId) === String(statusId)) {
        fetchViewers();
      }
    };

    socket.on('status_view_updated', handleLiveView);
    socket.on('status_reaction_updated', handleLiveView);
    return () => {
      socket.off('status_view_updated', handleLiveView);
      socket.off('status_reaction_updated', handleLiveView);
    };
  }, [statusId, ownerId]);

  return (
    <div className="wa-sv-viewers-panel" onClick={e => e.stopPropagation()}>
      <div className="wa-sv-viewers-drag-bar" />
      <div className="wa-sv-viewers-header">
        <span><i className="fa-solid fa-eye" style={{ marginRight: 6 }}></i>
          {loading ? '…' : viewers.length} {viewers.length === 1 ? 'view' : 'views'}
        </span>
        <button onClick={onClose} className="wa-sv-close-small">✕</button>
      </div>
      {loading
        ? <div className="wa-sv-center-msg"><i className="fa-solid fa-circle-notch fa-spin"></i></div>
        : viewers.length === 0
          ? <div className="wa-sv-center-msg" style={{ opacity: 0.5 }}>No views yet</div>
          : <div className="wa-sv-viewers-list">
            {viewers.map((v, i) => (
              <div key={i} className="wa-sv-viewer-row">
                <AvatarCircle avatar={v.avatar} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wa-sv-viewer-name">{v.name || v.phone}</div>
                  <div className="wa-sv-viewer-time">
                    {new Date(v.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {v.reaction && <span style={{ fontSize: '22px' }}>{v.reaction}</span>}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

/* ── Full-screen Status Viewer ── */
function StatusViewer({ statuses, userName, userAvatar, isOwn, ownerId, viewerId, onClose, onReply, onStatusViewed }) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [myReaction, setMyReaction] = useState(null);
  const [sending, setSending] = useState(false);
  const timerRef = useRef(null);
  const replyRef = useRef(null);
  const current = statuses[idx];
  const DURATION = current?.type === 'video' ? 15000 : 5000;
  const paused = showReply || showViewers || showReactions;

  const [liveViewCount, setLiveViewCount] = useState(current?.viewCount || 0);

  useEffect(() => {
    setLiveViewCount(current?.viewCount || 0);
  }, [current?.id, current?.viewCount]);

  useEffect(() => {
    if (!isOwn || !current?.id) return;
    const handleViewUpdate = (data) => {
      if (String(data?.statusId) === String(current.id)) {
        setLiveViewCount(prev => (typeof prev === 'number' ? prev + 1 : 1));
      }
    };
    socket.on('status_view_updated', handleViewUpdate);
    return () => {
      socket.off('status_view_updated', handleViewUpdate);
    };
  }, [isOwn, current?.id]);

  /* record view */
  useEffect(() => {
    if (!isOwn && current?.id && viewerId) {
      statusApi.viewStatus(current.id, viewerId).catch(() => { });
      socket.emit('status_viewed', { statusId: current.id, ownerId, viewerId });
      onStatusViewed?.(current.id);
    }
  }, [idx, current?.id]);

  /* progress timer */
  useEffect(() => {
    setProgress(0);
    if (paused) return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        if (idx < statuses.length - 1) setIdx(p => p + 1);
        else onClose();
      }
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [idx, paused]);

  useEffect(() => {
    if (showReply) replyRef.current?.focus();
  }, [showReply]);

  if (!current) return null;

  const fontFamily = FONT_MAP[current.fontStyle] || FONT_MAP.normal;
  const isBold = current.fontStyle === 'bold';

  const handleReact = async (emoji) => {
    setMyReaction(emoji);
    setShowReactions(false);
    const targetId = current.userId || ownerId;
    try { await statusApi.reactToStatus(current.id, viewerId, emoji); } catch (_) { }
    socket.emit('message', { to: targetId, text: emoji, type: 'status_reaction', statusId: current.id });
    if (onReply) onReply(targetId);
  };

  const handleSendReply = async () => {
    const msg = replyText.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      const targetId = current.userId || ownerId;
      await statusApi.replyToStatus(current.id, viewerId, msg);
      socket.emit('message', { to: targetId, text: msg, type: 'status_reply', statusId: current.id });
      if (onReply) onReply(targetId);
      setReplyText('');
      setShowReply(false);
    } catch (_) { }
    setSending(false);
  };

  return (
    <div className="wa-sv-overlay" onClick={onClose}>
      <div
        className="wa-sv-card"
        onClick={e => e.stopPropagation()}
        style={{ background: current.type === 'text' ? (current.bgColor || '#075e54') : '#000' }}
      >
        {/* Progress bars */}
        <div className="wa-sv-bars">
          {statuses.map((s, i) => (
            <div key={i} className="wa-sv-bar-track">
              <div
                className="wa-sv-bar-fill"
                style={{
                  width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="wa-sv-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div className="wa-sv-avatar">
              <AvatarCircle avatar={userAvatar} size={42} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="wa-sv-username" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </div>
              <div className="wa-sv-time">
                {new Date(current.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button className="wa-sv-close-btn" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* Body Content */}
        <div className="wa-sv-body">
          {current.type === 'text' && (
            <div
              className="wa-sv-text-content"
              style={{ fontFamily, fontWeight: isBold ? 'bold' : 'normal' }}
            >
              {current.content}
            </div>
          )}
          {current.type === 'link' && (
            <div className="wa-sv-text-content">
              <a href={current.content} target="_blank" rel="noreferrer" className="wa-sv-link">
                🔗 {current.content}
              </a>
            </div>
          )}
          {current.type === 'image' && (
            <img src={resolveMediaUrl(current.content)} alt="Status" className="wa-sv-media" />
          )}
          {current.type === 'video' && (
            <video src={resolveMediaUrl(current.content)} autoPlay playsInline className="wa-sv-media" />
          )}
          {current.caption && (
            <div className="wa-sv-caption">{current.caption}</div>
          )}
        </div>

        {/* Tap zones for Next/Prev */}
        <div className="wa-sv-tap-prev" onClick={() => setIdx(p => Math.max(0, p - 1))} />
        <div className="wa-sv-tap-next" onClick={() => {
          if (idx < statuses.length - 1) setIdx(p => p + 1);
          else onClose();
        }} />

        {/* Bottom bar */}
        <div className="wa-sv-bottom">
          {isOwn ? (
            <button className="wa-sv-views-btn" onClick={() => setShowViewers(v => !v)}>
              <i className="fa-solid fa-eye"></i>
              <span>{liveViewCount} {liveViewCount === 1 ? 'view' : 'views'}</span>
            </button>
          ) : (
            <div className="wa-sv-actions" style={{ position: 'relative' }}>
              {!showReply && (
                <>
                  <button className="wa-sv-react-btn" onClick={() => setShowReactions(r => !r)} title="React">
                    {myReaction ? <span style={{ fontSize: 20 }}>{myReaction}</span> : <i className="fa-regular fa-face-smile" style={{ color: '#fff', fontSize: 18 }}></i>}
                  </button>
                  <button className="wa-sv-reply-btn" onClick={() => setShowReply(true)}>
                    <i className="fa-solid fa-reply"></i> Reply
                  </button>
                </>
              )}

              {showReactions && !showReply && (
                <div className="wa-sv-emoji-tray">
                  {REACTION_EMOJIS.map(em => (
                    <button key={em} className="wa-sv-emoji-btn" onClick={() => handleReact(em)}>{em}</button>
                  ))}
                </div>
              )}

              {showReply && (
                <div className="wa-sv-reply-box">
                  <input
                    ref={replyRef}
                    className="wa-sv-reply-input"
                    placeholder="Type a reply..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendReply(); }}
                  />
                  <button className="wa-sv-reply-send" disabled={!replyText.trim() || sending} onClick={handleSendReply}>
                    <i className="fa-solid fa-paper-plane"></i>
                  </button>
                  <button className="wa-sv-reply-cancel" onClick={() => setShowReply(false)}>✕</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Viewers panel (for own status) */}
        {showViewers && (
          <ViewersPanel statusId={current.id} ownerId={ownerId} onClose={() => setShowViewers(false)} />
        )}
      </div>
    </div>
  );
}

/* ── StatusTab main ── */
export default function StatusTab({ userId, currentUser, onSelectChat }) {
  const [mine, setMine] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [compType, setCompType] = useState('text');
  const [compText, setCompText] = useState('');
  const [compCaption, setCompCaption] = useState('');
  const [compBg, setCompBg] = useState('#c2410c');
  const [compFont, setCompFont] = useState('normal');
  const [compLink, setCompLink] = useState('');
  const [compImage, setCompImage] = useState(null);
  const [compVideo, setCompVideo] = useState(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  const load = async (showSpinner = true) => {
    if (!userId) return;
    try {
      if (showSpinner) setLoading(true);
      const d = await statusApi.getStatuses(userId);
      if (d?.success) { setMine(d.mine || []); setContacts(d.contacts || []); }
    } catch (_) { }
    finally { if (showSpinner) setLoading(false); }
  };

  useEffect(() => {
    load(true);

    const handleRealtimeStatus = () => {
      load(false);
    };

    socket.on('status_updated', handleRealtimeStatus);
    socket.on('status_view_updated', handleRealtimeStatus);

    return () => {
      socket.off('status_updated', handleRealtimeStatus);
      socket.off('status_view_updated', handleRealtimeStatus);
    };
  }, [userId]);

  const handleStatusViewed = (statusId) => {
    setContacts(prev => prev.map(s => s.id === statusId ? { ...s, isViewed: true } : s));
  };

  const grouped = contacts.reduce((acc, s) => {
    if (!acc[s.userId]) acc[s.userId] = { statuses: [], userName: s.userName || s.userId, userAvatar: s.userAvatar };
    // Prevent any duplicate status IDs inside the same user group
    if (!acc[s.userId].statuses.some(existing => existing.id === s.id)) {
      acc[s.userId].statuses.push(s);
    }
    return acc;
  }, {});

  const recentUpdates = Object.entries(grouped).filter(([_, { statuses }]) => !statuses.every(s => s.isViewed));
  const viewedUpdates = Object.entries(grouped).filter(([_, { statuses }]) => statuses.every(s => s.isViewed));

  const resetComposer = () => {
    setCompText(''); setCompCaption(''); setCompLink('');
    setCompImage(null); setCompVideo(null);
    setCompType('text'); setCompBg('#c2410c'); setCompFont('normal');
  };

  const handlePost = async () => {
    const content = compType === 'text' ? compText.trim()
      : compType === 'link' ? compLink.trim()
        : compType === 'image' ? compImage : compVideo;
    if (!content) return;
    setPosting(true);
    try {
      await statusApi.createStatus({ userId, type: compType, content, caption: compCaption.trim() || null, bgColor: compBg, fontStyle: compFont });
      socket.emit('status_posted', { userId });
      setShowComposer(false); resetComposer(); load();
      const res = await statusApi.createStatus({ userId, type: compType, content, caption: compCaption.trim() || null, bgColor: compBg, fontStyle: compFont });
      socket.emit('status_posted', { userId, status: res?.status });
      setShowComposer(false);
      resetComposer();
      load(false);
    } catch (_) { alert('Failed to post status'); }
    finally { setPosting(false); }
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const r = Math.min(800 / img.width, 800 / img.height, 1);
        canvas.width = img.width * r; canvas.height = img.height * r;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setCompImage(canvas.toDataURL('image/jpeg', 0.82)); setCompType('image');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file); e.target.value = '';
  };

  const handleVideoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) return;
    if (file.size > 10 * 1024 * 1024) { alert('Video must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => { setCompVideo(ev.target.result); setCompType('video'); };
    reader.readAsDataURL(file); e.target.value = '';
  };

  const handleDeleteMine = async (id) => {
    try {
      await statusApi.deleteStatus(id, userId);
      socket.emit('status_deleted', { userId, statusId: id });
      setMine(p => p.filter(s => s.id !== id));
      load(false);
    } catch (_) {
      alert('Failed to delete');
    }
  };

  /* reply/reaction opens chat with that user */
  const handleReply = (targetUserId) => {
    setViewer(null);
    if (onSelectChat) onSelectChat(targetUserId);
  };

  const myAvatar = currentUser?.avatar;
  const myName = currentUser?.name || userId;

  if (loading) return (
    <div className="wa-status-screen">
      <div className="wa-inbox-loading">
        <i className="fa-solid fa-circle-notch fa-spin"></i><span>Loading statuses...</span>
      </div>
    </div>
  );

  return (
    <div className="wa-status-screen">

      {/* ── My Status row ── */}
      <div className="wa-status-my-item"
        onClick={() => mine.length > 0
          ? setViewer({ statuses: mine, userName: myName, userAvatar: myAvatar, isOwn: true })
          : setShowComposer(true)}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <StatusRing avatar={myAvatar} hasNew={mine.length > 0} />
          <span className="wa-status-add-badge"
            onClick={e => { e.stopPropagation(); setShowComposer(true); }}>+</span>
        </div>
        <div className="wa-item-center">
          <div className="wa-item-top"><span className="wa-item-name">My Status</span></div>
          <div className="wa-item-bottom">
            <span className="wa-item-msg">
              {mine.length > 0
                ? `${mine.length} update${mine.length > 1 ? 's' : ''} • Tap to view`
                : 'Tap to add status update'}
            </span>
          </div>
        </div>
        {mine.length > 0 && (
          <button className="wa-status-delete-all-btn"
            onClick={e => { e.stopPropagation(); if (window.confirm('Delete all your statuses?')) mine.forEach(s => handleDeleteMine(s.id)); }}>
            <i className="fa-solid fa-trash-can"></i>
          </button>
        )}
      </div>

      {/* ── Recent Updates (Unviewed) ── */}
      {recentUpdates.length > 0 && (
        <>
          <div className="wa-section-title">Recent Updates</div>
          {recentUpdates.map(([uid, { statuses: sts, userName, userAvatar }]) => (
            <div key={uid} className="wa-status-my-item"
              onClick={() => setViewer({ statuses: sts, userName, userAvatar, isOwn: false, ownerId: uid })}>
              <StatusRing avatar={userAvatar} hasNew={true} />
              <div className="wa-item-center">
                <div className="wa-item-top">
                  <span className="wa-item-name">{userName}</span>
                  <span className="wa-item-time">
                    {new Date(sts[sts.length - 1].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="wa-item-bottom">
                  <span className="wa-item-msg">{sts.length} update{sts.length > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Viewed Updates (Grey Ring) ── */}
      {viewedUpdates.length > 0 && (
        <>
          <div className="wa-section-title" style={{ marginTop: '14px', opacity: 0.85 }}>Viewed Updates</div>
          {viewedUpdates.map(([uid, { statuses: sts, userName, userAvatar }]) => (
            <div key={uid} className="wa-status-my-item viewed"
              style={{ opacity: 0.82 }}
              onClick={() => setViewer({ statuses: sts, userName, userAvatar, isOwn: false, ownerId: uid })}>
              <StatusRing avatar={userAvatar} hasNew={false} />
              <div className="wa-item-center">
                <div className="wa-item-top">
                  <span className="wa-item-name">{userName}</span>
                  <span className="wa-item-time">
                    {new Date(sts[sts.length - 1].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="wa-item-bottom">
                  <span className="wa-item-msg">{sts.length} update{sts.length > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Viewer ── */}
      {viewer && (
        <StatusViewer
          statuses={viewer.statuses}
          userName={viewer.userName}
          userAvatar={viewer.userAvatar}
          isOwn={viewer.isOwn}
          ownerId={viewer.isOwn ? userId : (viewer.ownerId || viewer.statuses[0]?.userId || userId)}
          viewerId={userId}
          onClose={() => {
            setViewer(null);
            load();
          }}
          onReply={handleReply}
          onStatusViewed={handleStatusViewed}
        />
      )}

      {/* ── Composer ── */}
      {showComposer && (
        <div className="wa-modal-overlay" onClick={() => { setShowComposer(false); resetComposer(); }}>
          <div className="wa-status-composer" onClick={e => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h3>Add Status</h3>
              <button className="wa-modal-close" onClick={() => { setShowComposer(false); resetComposer(); }}>✕</button>
            </div>

            {/* type tabs */}
            <div className="wa-status-type-tabs">
              {[{ v: 'text', icon: 'fa-font', label: 'Text' }, { v: 'image', icon: 'fa-image', label: 'Image' }, { v: 'video', icon: 'fa-video', label: 'Video' }, { v: 'link', icon: 'fa-link', label: 'Link' }]
                .map(({ v, icon, label }) => (
                  <button key={v} className={`wa-status-type-btn ${compType === v ? 'active' : ''}`}
                    onClick={() => { setCompType(v); setCompImage(null); setCompVideo(null); }}>
                    <i className={`fa-solid ${icon}`}></i><span>{label}</span>
                  </button>
                ))}
            </div>

            {/* preview */}
            <div className="wa-status-preview-box">
              {compType === 'text' && (
                <div className="wa-status-text-preview"
                  style={{ background: compBg, fontFamily: FONT_MAP[compFont], fontWeight: compFont === 'bold' ? 700 : 400 }}>
                  {compText || <span style={{ opacity: 0.4 }}>Your text here…</span>}
                </div>
              )}
              {compType === 'image' && compImage && <img src={compImage} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8 }} />}
              {compType === 'video' && compVideo && <video src={compVideo} controls style={{ width: '100%', maxHeight: 200, borderRadius: 8 }} />}
              {compType === 'link' && (
                <div className="wa-status-text-preview" style={{ background: compBg, fontSize: 13, wordBreak: 'break-all' }}>
                  {compLink || <span style={{ opacity: 0.4 }}>https://example.com</span>}
                </div>
              )}
              {compType === 'image' && !compImage && (
                <div style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>
                  <i className="fa-solid fa-image" style={{ fontSize: 36, display: 'block', marginBottom: 8 }}></i>Select an image
                </div>
              )}
              {compType === 'video' && !compVideo && (
                <div style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>
                  <i className="fa-solid fa-video" style={{ fontSize: 36, display: 'block', marginBottom: 8 }}></i>Select a video (max 10MB)
                </div>
              )}
            </div>

            {/* inputs */}
            <div className="wa-status-composer-inputs">
              {compType === 'text' && (
                <textarea className="wa-status-text-input" placeholder="Type your status…"
                  value={compText} onChange={e => setCompText(e.target.value)} maxLength={700} rows={3} />
              )}
              {compType === 'link' && (
                <input type="url" className="wa-inline-input" placeholder="https://example.com"
                  value={compLink} onChange={e => setCompLink(e.target.value)} style={{ marginBottom: 8 }} />
              )}
              {(compType === 'image' || compType === 'video' || compType === 'link') && (
                <input type="text" className="wa-inline-input" placeholder="Caption (optional)"
                  value={compCaption} onChange={e => setCompCaption(e.target.value)} maxLength={200} />
              )}
              {compType === 'image' && (
                <><input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
                  <button className="wa-upload-photo-btn" style={{ marginTop: 8 }} onClick={() => fileRef.current?.click()}>
                    <i className="fa-solid fa-cloud-arrow-up"></i> {compImage ? 'Change Image' : 'Upload Image'}
                  </button></>
              )}
              {compType === 'video' && (
                <><input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoFile} />
                  <button className="wa-upload-photo-btn" style={{ marginTop: 8 }} onClick={() => videoRef.current?.click()}>
                    <i className="fa-solid fa-cloud-arrow-up"></i> {compVideo ? 'Change Video' : 'Upload Video'}
                  </button></>
              )}

              {(compType === 'text' || compType === 'link') && (
                <>
                  <div className="wa-comp-section-label">BACKGROUND</div>
                  <div className="wa-status-bg-picker">
                    {BG_COLORS.map(c => (
                      <button key={c} className={`wa-status-bg-swatch ${compBg === c ? 'selected' : ''}`}
                        style={{ background: c }} onClick={() => setCompBg(c)} />
                    ))}
                  </div>
                </>
              )}
              {compType === 'text' && (
                <>
                  <div className="wa-comp-section-label">FONT</div>
                  <div className="wa-status-font-picker">
                    {FONT_STYLES.map(({ value, label }) => (
                      <button key={value} className={`wa-status-font-btn ${compFont === value ? 'active' : ''}`}
                        style={{ fontFamily: FONT_MAP[value], fontWeight: value === 'bold' ? 700 : 400 }}
                        onClick={() => setCompFont(value)}>{label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button className="wa-auth-green-btn" style={{ width: '100%', maxWidth: '100%', margin: '14px 0 0' }}
              disabled={posting
                || (compType === 'text' && !compText.trim())
                || (compType === 'link' && !compLink.trim())
                || (compType === 'image' && !compImage)
                || (compType === 'video' && !compVideo)}
              onClick={handlePost}>
              {posting
                ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Posting…</>
                : <><i className="fa-solid fa-paper-plane"></i> Post Status</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

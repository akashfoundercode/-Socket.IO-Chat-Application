import React, { useState, useEffect, useRef } from 'react';
import { statusApi, resolveMediaUrl } from '../services/api';
import { socket } from '../socket/socket';

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
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {avatar
        ? avatar.length <= 4
          ? <span style={{ fontSize: size * 0.48 }}>{avatar}</span>
          : <img src={avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : <i className="fa-solid fa-user" style={{ color: '#9ca3af', fontSize: size * 0.4 }}></i>}
    </div>
  );
}

function StatusRing({ avatar, hasNew, size = 52 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: hasNew
        ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
        : '#e9edef',
      padding: '2.5px'
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
    statusApi.getViewers(statusId, ownerId)
      .then(d => { if (d?.success) setViewers(d.viewers || []); })
      .finally(() => setLoading(false));
  }, [statusId]);

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
                <div style={{ flex: 1 }}>
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
function StatusViewer({ statuses, userName, userAvatar, isOwn, ownerId, viewerId, onClose, onReply }) {
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

  /* record view */
  useEffect(() => {
    if (!isOwn && current?.id && viewerId) {
      statusApi.viewStatus(current.id, viewerId).catch(() => { });
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
      <div className="wa-sv-card" onClick={e => e.stopPropagation()}>

        {/* progress bars */}
        <div className="wa-sv-bars">
          {statuses.map((_, i) => (
            <div key={i} className="wa-sv-bar-track">
              <div className="wa-sv-bar-fill"
                style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="wa-sv-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="wa-sv-avatar"><AvatarCircle avatar={userAvatar} size={40} /></div>
            <div>
              <div className="wa-sv-username">{userName}</div>
              <div className="wa-sv-time">
                {new Date(current.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {statuses.length > 1 && <span style={{ marginLeft: 6, opacity: 0.6 }}>{idx + 1}/{statuses.length}</span>}
              </div>
            </div>
          </div>
          <button className="wa-sv-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* content */}
        <div className="wa-sv-body">
          {current.type === 'text' && (
            <div className="wa-sv-text-content" style={{ background: current.bgColor, fontFamily, fontWeight: isBold ? 700 : 400 }}>
              {current.content}
            </div>
          )}
          {current.type === 'image' && <img src={resolveMediaUrl(current.content)} alt="" className="wa-sv-media" />}
          {current.type === 'video' && <video src={resolveMediaUrl(current.content)} autoPlay muted loop className="wa-sv-media" />}
          {current.type === 'link' && (
            <div className="wa-sv-text-content" style={{ background: current.bgColor, flexDirection: 'column', gap: 12 }}>
              <i className="fa-solid fa-link" style={{ fontSize: 28, opacity: 0.7 }}></i>
              <a href={current.content} target="_blank" rel="noopener noreferrer" className="wa-sv-link">{current.content}</a>
              {current.caption && <p style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>{current.caption}</p>}
            </div>
          )}
        </div>

        {/* caption overlay */}
        {current.caption && current.type !== 'link' && (
          <div className="wa-sv-caption">{current.caption}</div>
        )}

        {/* tap zones */}
        <div className="wa-sv-tap-prev" onClick={() => idx > 0 && setIdx(p => p - 1)} />
        <div className="wa-sv-tap-next" onClick={() => idx < statuses.length - 1 ? setIdx(p => p + 1) : onClose()} />

        {/* bottom bar */}
        <div className="wa-sv-bottom">
          {isOwn ? (
            /* owner: views count */
            <button className="wa-sv-views-btn" onClick={() => setShowViewers(v => !v)}>
              <i className="fa-solid fa-eye"></i>
              <span>{current.viewCount ?? 0} views</span>
              <i className={`fa-solid fa-chevron-${showViewers ? 'down' : 'up'}`} style={{ fontSize: 10, marginLeft: 4 }}></i>
            </button>
          ) : (
            /* viewer: reaction + reply */
            <div className="wa-sv-actions">
              {/* emoji reaction */}
              <div style={{ position: 'relative' }}>
                <button className="wa-sv-react-btn"
                  onClick={() => { setShowReactions(v => !v); setShowReply(false); }}>
                  <span style={{ fontSize: 22 }}>{myReaction || '😊'}</span>
                </button>
                {showReactions && (
                  <div className="wa-sv-emoji-tray">
                    {REACTION_EMOJIS.map(e => (
                      <button key={e} className="wa-sv-emoji-btn" onClick={() => handleReact(e)}>{e}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* reply */}
              {showReply ? (
                <div className="wa-sv-reply-box">
                  <input
                    ref={replyRef}
                    className="wa-sv-reply-input"
                    placeholder={`Reply to ${userName}...`}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                  />
                  <button className="wa-sv-reply-send" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                    {sending
                      ? <i className="fa-solid fa-circle-notch fa-spin"></i>
                      : <i className="fa-solid fa-paper-plane"></i>}
                  </button>
                  <button className="wa-sv-reply-cancel" onClick={() => { setShowReply(false); setReplyText(''); }}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              ) : (
                <button className="wa-sv-reply-btn"
                  onClick={() => { setShowReply(true); setShowReactions(false); }}>
                  <i className="fa-solid fa-reply"></i> Reply
                </button>
              )}
            </div>
          )}
        </div>

        {/* viewers panel */}
        {isOwn && showViewers && (
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
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const scrollRef = useRef(null);
  const PULL_THRESHOLD = 70;

  /* composer */
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

  const load = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const d = await statusApi.getStatuses(userId);
      if (d?.success) { setMine(d.mine || []); setContacts(d.contacts || []); }
    } catch (_) { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);

  const grouped = contacts.reduce((acc, s) => {
    if (!acc[s.userId]) acc[s.userId] = { statuses: [], userName: s.userName || s.userId, userAvatar: s.userAvatar };
    acc[s.userId].statuses.push(s);
    return acc;
  }, {});

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
    try { await statusApi.deleteStatus(id, userId); setMine(p => p.filter(s => s.id !== id)); }
    catch (_) { alert('Failed to delete'); }
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

      {/* ── Contact statuses ── */}
      {Object.keys(grouped).length > 0 && (
        <>
          <div className="wa-section-title">Recent Updates</div>
          {Object.entries(grouped).map(([uid, { statuses: sts, userName, userAvatar }]) => (
            <div key={uid} className="wa-status-my-item"
              onClick={() => setViewer({ statuses: sts, userName, userAvatar, isOwn: false, ownerId: uid })}>
              <StatusRing avatar={userAvatar} hasNew={!sts.every(s => s.isViewed)} />
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

      {Object.keys(grouped).length === 0 && mine.length === 0 && (
        <div className="wa-status-empty-text">No recent updates from your contacts</div>
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
          onClose={() => setViewer(null)}
          onReply={handleReply}
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

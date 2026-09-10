import React, { useState, useEffect, useRef } from 'react';
import { chatApi, statusApi, resolveMediaUrl } from '../services/api';
import { socket } from '../socket/socket';
import Avatar from './Avatar';
import StatusComposer from './StatusComposer';

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
  const initialIndex = (() => {
    if (isOwn) return 0;
    const firstUnviewed = statuses.findIndex(s => !s.isViewed);
    return firstUnviewed !== -1 ? firstUnviewed : 0;
  })();

  const [idx, setIdx] = useState(initialIndex);
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
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [showPrivacyContacts, setShowPrivacyContacts] = useState(false);
  const [savedContacts, setSavedContacts] = useState([]);
  const [privacyMode, setPrivacyMode] = useState('contacts');
  const [privacyAudienceIds, setPrivacyAudienceIds] = useState([]);

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

  useEffect(() => {
    let cancelled = false;
    chatApi.getContacts(userId).then((data) => {
      if (!cancelled) setSavedContacts(Array.isArray(data?.contacts) ? data.contacts : []);
    }).catch(() => {
      if (!cancelled) setSavedContacts([]);
    });
    return () => { cancelled = true; };
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

  const getPrivacyContactId = (contact) => String(contact.fullPhone || contact.phone || contact.id || '').trim();

  const togglePrivacyContact = (contactId) => {
    setPrivacyAudienceIds((previous) => previous.includes(contactId)
      ? previous.filter((id) => id !== contactId)
      : [...previous, contactId]);
  };

  const selectAllPrivacyContacts = () => {
    setPrivacyAudienceIds(savedContacts.map(getPrivacyContactId).filter(Boolean));
  };

  const choosePrivacyMode = (mode) => {
    setPrivacyMode(mode);
    setShowPrivacyMenu(false);
    setShowPrivacyContacts(mode !== 'contacts');
    if (mode === 'contacts') setPrivacyAudienceIds([]);
  };

  const openComposer = () => {
    setShowPrivacyMenu(false);
    setShowComposer(true);
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
      <div className="wa-status-my-item wa-status-own-row"
        onClick={() => mine.length > 0
          ? setViewer({ statuses: mine, userName: myName, userAvatar: myAvatar, isOwn: true })
          : openComposer()}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <StatusRing avatar={myAvatar} hasNew={mine.length > 0} />
          <span className="wa-status-add-badge"
            onClick={e => { e.stopPropagation(); openComposer(); }}>+</span>
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
        <div className="wa-status-own-actions">
          <button className="wa-status-privacy-menu-btn" title="Status privacy"
            onClick={e => { e.stopPropagation(); setShowPrivacyMenu(previous => !previous); }}>
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
          {mine.length > 0 && (
            <button className="wa-status-delete-all-btn"
              onClick={e => { e.stopPropagation(); if (window.confirm('Delete all your statuses?')) mine.forEach(s => handleDeleteMine(s.id)); }}>
              <i className="fa-solid fa-trash-can"></i>
            </button>
          )}
        </div>
        {showPrivacyMenu && (
          <div className="wa-status-privacy-menu" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => choosePrivacyMode('contacts')}>
              <i className="fa-solid fa-users"></i><span><strong>My contacts</strong><small>All saved contacts who also saved you</small></span>
              {privacyMode === 'contacts' && <i className="fa-solid fa-check"></i>}
            </button>
            <button type="button" onClick={() => choosePrivacyMode('contacts_except')}>
              <i className="fa-solid fa-user-minus"></i><span><strong>My contacts except</strong><small>Exclude selected saved contacts</small></span>
              {privacyMode === 'contacts_except' && <i className="fa-solid fa-check"></i>}
            </button>
            <button type="button" onClick={() => choosePrivacyMode('only_share')}>
              <i className="fa-solid fa-user-check"></i><span><strong>Only share with</strong><small>Share only with selected contacts</small></span>
              {privacyMode === 'only_share' && <i className="fa-solid fa-check"></i>}
            </button>
          </div>
        )}
      </div>

      {showPrivacyContacts && (
        <div className="wa-status-privacy-contacts">
          <div className="wa-status-privacy-contacts-head">
            <strong>{privacyMode === 'only_share' ? 'Only share with' : 'My contacts except'}</strong>
            <button type="button" onClick={selectAllPrivacyContacts} disabled={!savedContacts.length}>Select all</button>
          </div>
          <div className="wa-status-privacy-contact-list">
            {savedContacts.length ? savedContacts.map((contact) => {
              const contactId = getPrivacyContactId(contact);
              const selected = privacyAudienceIds.includes(contactId);
              return (
                <button type="button" key={contactId} className={selected ? 'selected' : ''} onClick={() => togglePrivacyContact(contactId)}>
                  <span className="wa-status-privacy-check">{selected && <i className="fa-solid fa-check"></i>}</span>
                  <span>{contact.customName || contact.name || contactId}</span>
                  <small>{contact.fullPhone || contact.phone || contactId}</small>
                </button>
              );
            }) : <span className="wa-status-no-audience">No saved contacts available.</span>}
          </div>
          <button type="button" className="wa-status-privacy-done" onClick={() => setShowPrivacyContacts(false)}>Done</button>
        </div>
      )}

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

      {/* ── Premium Status Composer & Studio ── */}
      {showComposer && (
        <StatusComposer
          userId={userId}
          privacyMode={privacyMode}
          audienceUserIds={privacyAudienceIds}
          onClose={() => setShowComposer(false)}
          onPosted={() => load(false)}
        />
      )}
    </div>
  );
}

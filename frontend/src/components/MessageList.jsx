import React, { useState, useEffect, useRef } from 'react';
import VoiceNotePlayer from './VoiceNotePlayer';
import { resolveMediaUrl } from '../services/api';

function MessageAvatar({ avatar, label }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarValue = String(avatar || '').trim();
  const isEmojiAvatar = avatarValue && avatarValue.length <= 4 && !avatarValue.startsWith('/') && !avatarValue.startsWith('data:') && !avatarValue.startsWith('http');

  return (
    <div className="wa-message-avatar" title={label}>
      {avatarValue && !imageFailed ? (
        isEmojiAvatar ? (
          <span className="wa-message-avatar-emoji">{avatarValue}</span>
        ) : (
          <img
            src={avatarValue}
            alt={label}
            onError={() => setImageFailed(true)}
          />
        )
      ) : (
        <i className="fa-brands fa-whatsapp" aria-label="Default avatar"></i>
      )}
    </div>
  );
}

export default function MessageList({
  messages,
  currentUserId,
  currentUserAvatar = null,
  recipientAvatar = null,
  recipientId,
  onDeleteMessage,
  onEditMessage,
  onPinMessage,
  onReplyMessage,
  onReactMessage,
  isGroup = false,
  groupDetails = null
}) {
  const bottomRef = useRef(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState(null);
  const [selectedMessageForEdit, setSelectedMessageForEdit] = useState(null);
  const [selectedMessageForHistory, setSelectedMessageForHistory] = useState(null);
  const [editText, setEditText] = useState('');
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close context menu & reactions when clicking outside
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveMenuMessageId(null);
      setActiveReactionMsgId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleScrollToMessage = (targetMsgId) => {
    if (!targetMsgId) return;
    const el = document.getElementById(`msg-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-bubble');
      setTimeout(() => {
        el.classList.remove('highlight-bubble');
      }, 1500);
    }
  };

  // Render authentic WhatsApp Ticks (Single Gray, Double Gray, Double Blue)
  const renderMessageTick = (msg) => {
    const status = msg.status || 'sent';

    if (status === 'seen') {
      return (
        <span className="wa-tick-wrap seen" title="Read / Seen (Double Blue Tick)">
          <i className="fa-solid fa-check-double"></i>
        </span>
      );
    }

    if (status === 'delivered') {
      return (
        <span className="wa-tick-wrap delivered" title="Delivered (Double Gray Tick)">
          <i className="fa-solid fa-check-double"></i>
        </span>
      );
    }

    // Default: 'sent' (Single Gray Tick)
    return (
      <span className="wa-tick-wrap sent" title="Sent (Single Gray Tick)">
        <i className="fa-solid fa-check"></i>
      </span>
    );
  };

  const handleOpenDeleteDialog = (msg, e) => {
    if (e) e.stopPropagation();
    setActiveMenuMessageId(null);
    setSelectedMessageForDelete(msg);
  };

  const handleConfirmDelete = (deleteFor) => {
    if (!selectedMessageForDelete) return;
    if (onDeleteMessage) {
      onDeleteMessage(selectedMessageForDelete.id, deleteFor);
    }
    setSelectedMessageForDelete(null);
  };

  const handleOpenEditDialog = (msg, e) => {
    if (e) e.stopPropagation();
    setActiveMenuMessageId(null);
    setSelectedMessageForEdit(msg);
    setEditText(msg.text || '');
  };

  const handleConfirmEdit = (e) => {
    if (e) e.preventDefault();
    if (!selectedMessageForEdit || !editText.trim()) return;
    if (onEditMessage) {
      onEditMessage(selectedMessageForEdit.id, editText.trim());
    }
    setSelectedMessageForEdit(null);
    setEditText('');
  };

  const handleOpenHistoryModal = (msg, e) => {
    if (e) e.stopPropagation();
    setActiveMenuMessageId(null);
    setSelectedMessageForHistory(msg);
  };

  const handleTogglePin = (msg, e) => {
    if (e) e.stopPropagation();
    onPinMessage?.(msg.id, !msg.isPinned);
    setActiveMenuMessageId(null);
  };

  const orderedMessages = [...messages].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
    return 0;
  });

  return (
    <div className="wa-messages-container">
      {/* Fullscreen Lightbox Image Viewer */}
      {lightboxImage && (
        <div className="wa-lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="wa-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="wa-lightbox-close"
              onClick={() => setLightboxImage(null)}
              title="Close"
            >
              ✕
            </button>
            <img src={resolveMediaUrl(lightboxImage)} alt="Fullscreen View" className="wa-lightbox-img" />
          </div>
        </div>
      )}

      {/* WhatsApp-Style Delete Message Confirmation Modal */}
      {selectedMessageForDelete && (
        <div
          className="wa-delete-modal-overlay"
          onClick={() => setSelectedMessageForDelete(null)}
        >
          <div
            className="wa-delete-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="wa-delete-modal-title">Delete message?</h3>
            <p className="wa-delete-modal-desc">
              {selectedMessageForDelete.from === currentUserId
                ? 'You can delete this message for everyone or just for yourself.'
                : 'You can delete this message from your device.'}
            </p>

            <div className="wa-delete-modal-actions">
              {selectedMessageForDelete.from === currentUserId && selectedMessageForDelete.type !== 'deleted' && (
                <button
                  type="button"
                  className="wa-delete-btn delete-everyone"
                  onClick={() => handleConfirmDelete('everyone')}
                >
                  <i className="fa-solid fa-trash-can"></i>
                  <span>Delete for everyone</span>
                </button>
              )}

              <button
                type="button"
                className="wa-delete-btn delete-me"
                onClick={() => handleConfirmDelete('me')}
              >
                <i className="fa-regular fa-trash-can"></i>
                <span>Delete for me</span>
              </button>

              <button
                type="button"
                className="wa-delete-btn cancel"
                onClick={() => setSelectedMessageForDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp-Style Edit Message Modal */}
      {selectedMessageForEdit && (
        <div
          className="wa-delete-modal-overlay"
          onClick={() => setSelectedMessageForEdit(null)}
        >
          <div
            className="wa-edit-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wa-edit-modal-header">
              <h3>
                <i className="fa-solid fa-pen-to-square" style={{ color: '#f97316', marginRight: '8px' }}></i>
                Edit message
              </h3>
              <button
                type="button"
                className="wa-modal-close-icon"
                onClick={() => setSelectedMessageForEdit(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmEdit} className="wa-edit-modal-form">
              <div className="wa-edit-input-wrap">
                <textarea
                  className="wa-edit-textarea"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  placeholder="Edit your message..."
                  autoFocus
                />
              </div>

              <div className="wa-edit-modal-footer">
                <button
                  type="button"
                  className="wa-edit-cancel-btn"
                  onClick={() => setSelectedMessageForEdit(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wa-edit-save-btn"
                  disabled={!editText.trim() || editText.trim() === selectedMessageForEdit.text}
                >
                  <i className="fa-solid fa-check"></i>
                  <span>Save changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp-Style Edit History Modal (View Previous & Current text) */}
      {selectedMessageForHistory && (
        <div
          className="wa-delete-modal-overlay"
          onClick={() => setSelectedMessageForHistory(null)}
        >
          <div
            className="wa-history-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wa-history-modal-header">
              <h3>
                <i className="fa-solid fa-clock-rotate-left" style={{ color: '#f97316', marginRight: '8px' }}></i>
                Edit History
              </h3>
              <button
                type="button"
                className="wa-modal-close-icon"
                onClick={() => setSelectedMessageForHistory(null)}
              >
                ✕
              </button>
            </div>

            <div className="wa-history-modal-body">
              {/* Previous / Original Message */}
              <div className="wa-history-item original">
                <div className="wa-history-label">
                  <i className="fa-regular fa-clock"></i>
                  <span>Original message:</span>
                </div>
                <div className="wa-history-bubble original-bubble">
                  {selectedMessageForHistory.originalText || selectedMessageForHistory.text}
                </div>
              </div>

              {/* Current / Edited Message */}
              <div className="wa-history-item current">
                <div className="wa-history-label">
                  <i className="fa-solid fa-pen"></i>
                  <span>Edited message:</span>
                </div>
                <div className="wa-history-bubble current-bubble">
                  {selectedMessageForHistory.text}
                </div>
              </div>
            </div>

            <div className="wa-history-modal-footer">
              <button
                type="button"
                className="wa-history-close-btn"
                onClick={() => setSelectedMessageForHistory(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Encryption Security Notice */}
      <div className="wa-security-notice">
        <i className="fa-solid fa-lock"></i>
        <span>Messages are end-to-end encrypted. No one outside of this chat can read them.</span>
      </div>

      {!recipientId ? (
        <div className="wa-empty-chat-state">
          <div className="wa-empty-icon">
            <i className="fa-solid fa-comments"></i>
          </div>
          <h4>No Chat Selected</h4>
          <p>Tap the address book icon below to enter a recipient's phone number.</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="wa-empty-chat-state">
          <div className="wa-empty-icon">
            <i className="fa-regular fa-paper-plane"></i>
          </div>
          <h4>Say Hello to {recipientId}</h4>
          <p>Send a real-time message or share a photo to start the conversation.</p>
        </div>
      ) : (
        orderedMessages.map((msg, index) => {
          const fromId = String(msg.from || '').trim();
          const myId = String(currentUserId || '').trim();
          const isSent = fromId === myId ||
            fromId === myId.replace(/^\+/, '') ||
            `+${fromId}` === myId ||
            fromId === `+${myId.replace(/^\+/, '')}`;
          const isDeleted = msg.type === 'deleted';
          const isCall = !isDeleted && msg.type === 'call';
          const isEdited = Boolean(msg.editedAt || msg.originalText);
          const time = msg.createdAt
            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const isVoice = !isDeleted && msg.type === 'voice' && Boolean(msg.mediaUrl);
          const isImage = !isDeleted && !isVoice && (msg.type === 'image' || Boolean(msg.mediaUrl));
          const isLocation = !isDeleted && msg.type === 'location';
          const isStatusReaction = !isDeleted && msg.type === 'status_reaction';
          const isStatusReply = !isDeleted && msg.type === 'status_reply';
          const isStatusTag = isStatusReaction || isStatusReply;
          const hasReplyQuote = Boolean(msg.replyToId || msg.replyToText);
          const groupSender = isGroup
            ? groupDetails?.members?.find((member) => String(member.userId) === fromId)
            : null;
          const messageAvatar = isSent ? currentUserAvatar : (groupSender?.avatar || recipientAvatar);
          const messageAvatarLabel = isSent ? 'You' : (groupSender?.name || recipientId);

          let reactionsObj = {};
          if (msg.reactions) {
            try {
              reactionsObj = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions;
            } catch (e) {
              reactionsObj = {};
            }
          }
          const hasReactions = reactionsObj && typeof reactionsObj === 'object' && Object.keys(reactionsObj).length > 0;

          // Safe text extraction — prevent [object Object]
          const rawText = msg.text;
          const msgText = rawText && typeof rawText === 'object' ? JSON.stringify(rawText) : String(rawText || '');
          let locationData = null;
          if (isLocation && msg.text) {
            try {
              locationData = JSON.parse(msg.text);
            } catch (e) {
              locationData = { latitude: 0, longitude: 0, title: 'Location' };
            }
          }

          let statusData = null;
          if (isStatusTag) {
            try {
              if (typeof msg.text === 'string' && msg.text.startsWith('{')) {
                statusData = JSON.parse(msg.text);
              } else if (typeof msg.text === 'object' && msg.text !== null) {
                statusData = msg.text;
              }
            } catch (e) {
              statusData = null;
            }
          }

          let callData = null;
          if (isCall) {
            try {
              callData = typeof msg.text === 'string' ? JSON.parse(msg.text) : msg.text;
            } catch (e) {
              callData = { callType: 'voice', status: 'completed', duration: 0, memberNames: [] };
            }
          }

          return (
            <div key={msg.id || index} className={`wa-message-row ${isGroup ? 'group-message-row' : ''} ${isSent ? 'sent' : 'received'}`}>
              {isGroup && !isSent && (
                <MessageAvatar avatar={messageAvatar} label={messageAvatarLabel} />
              )}

              <div className={`wa-bubble-wrap ${isSent ? 'sent' : 'received'} ${msg.isPinned ? 'pinned-message-wrap' : ''}`}>
                <div
                  id={`msg-${msg.id}`}
                  className={`wa-bubble ${isSent ? 'sent' : 'received'} ${isLocation ? 'location-bubble' : ''} ${isStatusTag ? 'status-tag-bubble' : ''} ${isDeleted ? 'deleted-bubble' : ''} ${msg.isPinned ? 'pinned-bubble' : ''} ${activeMenuMessageId === msg.id ? 'menu-open' : ''}`}
                  onDoubleClick={() => !isDeleted && onReplyMessage?.(msg)}
                >
                  {isGroup && !isSent && (
                    <div className="wa-group-sender-name">
                      {groupSender?.name || fromId}
                    </div>
                  )}

                  {msg.isPinned && (
                    <div className="wa-pinned-message-label">
                      <i className="fa-solid fa-thumbtack"></i>
                      <span>Pinned</span>
                    </div>
                  )}

                  {/* Quick Reaction Bar Popup (Floating Emoji Picker) */}
                  {activeReactionMsgId === msg.id && (
                    <div className="wa-quick-reaction-bar" onClick={(e) => e.stopPropagation()}>
                      {QUICK_EMOJIS.map((emoji) => {
                        const isMyReaction = reactionsObj?.[emoji]?.includes?.(String(currentUserId));
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={`wa-quick-reaction-btn ${isMyReaction ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReactMessage?.(msg.id, emoji);
                              setActiveReactionMsgId(null);
                            }}
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Message Action Dropdown Chevron & Hover Quick Actions */}
                  {!isDeleted && (
                    <div className="wa-bubble-actions">
                      <button
                        type="button"
                        className="wa-bubble-menu-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMessageId((prev) => (prev === msg.id ? null : msg.id));
                          setActiveReactionMsgId(null);
                        }}
                        title="Message options"
                      >
                        <i className="fa-solid fa-chevron-down"></i>
                      </button>

                      {activeMenuMessageId === msg.id && (
                        <div
                          className="wa-bubble-dropdown-menu"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* React Option */}
                          <button
                            type="button"
                            className="wa-dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReactionMsgId(msg.id);
                              setActiveMenuMessageId(null);
                            }}
                          >
                            <i className="fa-regular fa-face-smile"></i>
                            <span>React</span>
                          </button>

                          {/* Reply Option for All Messages */}
                          <button
                            type="button"
                            className="wa-dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReplyMessage?.(msg);
                              setActiveMenuMessageId(null);
                            }}
                          >
                            <i className="fa-solid fa-reply"></i>
                            <span>Reply</span>
                          </button>

                          <button
                            type="button"
                            className="wa-dropdown-item"
                            onClick={(e) => handleTogglePin(msg, e)}
                          >
                            <i className="fa-solid fa-thumbtack"></i>
                            <span>{msg.isPinned ? 'Unpin message' : 'Pin message'}</span>
                          </button>

                          {/* Edit Option for Sent Text Messages */}
                          {isSent && !isLocation && !isImage && !isStatusReaction && !isStatusReply && (
                            <button
                              type="button"
                              className="wa-dropdown-item edit"
                              onClick={(e) => handleOpenEditDialog(msg, e)}
                            >
                              <i className="fa-regular fa-pen-to-square"></i>
                              <span>Edit message</span>
                            </button>
                          )}

                          {/* View History if edited */}
                          {isEdited && (
                            <button
                              type="button"
                              className="wa-dropdown-item history"
                              onClick={(e) => handleOpenHistoryModal(msg, e)}
                            >
                              <i className="fa-solid fa-clock-rotate-left"></i>
                              <span>View edit history</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="wa-dropdown-item delete"
                            onClick={(e) => handleOpenDeleteDialog(msg, e)}
                          >
                            <i className="fa-regular fa-trash-can"></i>
                            <span>Delete message</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hover Quick Actions Bar */}
                  {!isDeleted && (
                    <div className="wa-bubble-hover-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="wa-hover-action-btn"
                        title="React"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReactionMsgId((prev) => (prev === msg.id ? null : msg.id));
                          setActiveMenuMessageId(null);
                        }}
                      >
                        <i className="fa-regular fa-face-smile"></i>
                      </button>
                      <button
                        type="button"
                        className="wa-hover-action-btn"
                        title="Reply"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReplyMessage?.(msg);
                        }}
                      >
                        <i className="fa-solid fa-reply"></i>
                      </button>
                    </div>
                  )}

                  {/* Reply Quote Header Banner (WhatsApp style quote snippet) */}
                  {hasReplyQuote && !isDeleted && (
                    <div
                      className="wa-message-reply-quote"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScrollToMessage(msg.replyToId);
                      }}
                      title="Click to jump to quoted message"
                    >
                      <div className="wa-reply-quote-bar"></div>
                      <div className="wa-reply-quote-content">
                        <div className="wa-reply-quote-author">
                          {msg.replyToSender
                            ? (String(msg.replyToSender) === String(currentUserId) ? 'You' : msg.replyToSender)
                            : 'Message'}
                        </div>
                        <div className="wa-reply-quote-snippet">
                          {msg.replyToText || 'Original message'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Tag Card */}
                  {isStatusTag && statusData && (
                    <div className="wa-status-tag-card">
                      <div className="wa-status-tag-preview">
                        <div className="wa-status-tag-header">
                          <i className="fa-solid fa-circle-notch"></i>
                          <span>Status update</span>
                        </div>
                        {statusData.mediaUrl ? (
                          <img src={resolveMediaUrl(statusData.mediaUrl)} alt="Status Thumbnail" className="wa-status-tag-thumb" />
                        ) : (
                          <div
                            className="wa-status-tag-text-bg"
                            style={{ backgroundColor: statusData.bgColor || '#00a884' }}
                          >
                            <span>{statusData.textSnippet || 'Status'}</span>
                          </div>
                        )}
                      </div>
                      {isStatusReaction && (
                        <div className="wa-status-tag-reaction-badge">
                          <span>Reacted: {statusData.emoji || '❤️'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image / Media Display */}
                  {isImage && (
                    <div className="wa-bubble-media" onClick={() => setLightboxImage(resolveMediaUrl(msg.mediaUrl))}>
                      <img
                        src={resolveMediaUrl(msg.mediaUrl)}
                        alt="Photo"
                        className="wa-media-img"
                        loading="lazy"
                        onError={(e) => {
                          const currentSrc = e.currentTarget.src || '';
                          const fallbackHost = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'https://whatsapp.siberiancrane.tech';
                          if (msg.mediaUrl && fallbackHost && !currentSrc.startsWith(fallbackHost)) {
                            const clean = msg.mediaUrl.startsWith('/') ? msg.mediaUrl : `/${msg.mediaUrl}`;
                            e.currentTarget.src = `${fallbackHost.replace(/\/$/, '')}${clean}`;
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Voice Note Player Component */}
                  {isVoice && (
                    <div className="wa-voice-note-wrapper">
                      <VoiceNotePlayer
                        mediaUrl={msg.mediaUrl}
                        isSent={isSent}
                        senderAvatar={messageAvatar}
                        senderName={messageAvatarLabel}
                      />
                    </div>
                  )}

                  {isCall && (
                    <div
                      className={`wa-call-message ${
                        callData?.status === 'not_accepted' ||
                        callData?.status === 'missed' ||
                        (isGroup && callData?.joinedCount <= 1 && callData?.status !== 'completed')
                          ? 'missed'
                          : ''
                      }`}
                    >
                      <i className={`fa-solid ${callData?.callType === 'video' ? 'fa-video' : 'fa-phone'}`}></i>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '500' }}>
                          {isGroup ? (
                            callData?.status === 'not_accepted' ||
                            callData?.status === 'missed' ||
                            (callData?.joinedCount <= 1 && callData?.status !== 'completed')
                              ? 'Group voice call • Not accepted'
                              : `Group voice call • ${callData?.joinedCount || 2} joined`
                          ) : callData?.status === 'missed' ? (
                            `Missed ${callData?.callType === 'video' ? 'video' : 'voice'} call`
                          ) : callData?.status === 'declined' ? (
                            `${callData?.callType === 'video' ? 'Video' : 'Voice'} call declined`
                          ) : (
                            `${callData?.callType === 'video' ? 'Video' : 'Voice'} call ended`
                          )}
                          {callData?.duration > 0 && (
                            <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.85 }}>
                              ({Math.floor(callData.duration / 60)}:{String(callData.duration % 60).padStart(2, '0')})
                            </span>
                          )}
                        </span>
                        {isGroup && Array.isArray(callData?.memberNames) && callData.memberNames.length > 0 && (
                          <small className="wa-group-call-members" style={{ fontSize: '11px', opacity: 0.75 }}>
                            {callData.memberNames.slice(0, 4).join(', ')}
                          </small>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Location Map Display */}
                  {isLocation && locationData && (
                    <div className="wa-location-bubble-content">
                      <div className="wa-loc-bubble-map">
                        <iframe
                          title="Shared Location"
                          className="wa-loc-mini-map"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationData.longitude - 0.005}%2C${locationData.latitude - 0.003}%2C${locationData.longitude + 0.005}%2C${locationData.latitude + 0.003}&layer=mapnik&marker=${locationData.latitude}%2C${locationData.longitude}`}
                        />
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${locationData.latitude},${locationData.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wa-loc-bubble-info"
                      >
                        <div className="wa-loc-bubble-icon">
                          <i className="fa-solid fa-location-dot"></i>
                        </div>
                        <div>
                          <div className="wa-loc-bubble-title">{locationData.title || 'Location'}</div>
                          <div className="wa-loc-bubble-link">Tap to open in Google Maps</div>
                        </div>
                      </a>
                    </div>
                  )}

                  {/* Message Text Content */}
                  {!isVoice && !isCall && !isLocation && (!isStatusTag || !statusData) && (
                    <div className="wa-bubble-inline-text">
                      <div className={`wa-bubble-text ${isDeleted ? 'deleted-text' : ''}`}>
                        {isDeleted && <i className="fa-solid fa-ban" style={{ marginRight: '6px', opacity: 0.7 }}></i>}
                        {msgText}
                      </div>

                      <div className="wa-bubble-meta">
                        {isEdited && !isDeleted && <span className="wa-edited-label">edited</span>}
                        <span className="wa-msg-time">{time}</span>
                        {isSent && !isDeleted && renderMessageTick(msg)}
                      </div>
                    </div>
                  )}

                  {(!isVoice && !isLocation && (!isStatusTag || !statusData)) || isDeleted ? null : (
                    <div className="wa-bubble-meta">
                      {isEdited && !isDeleted && <span className="wa-edited-label">edited</span>}
                      <span className="wa-msg-time">{time}</span>
                      {isSent && !isDeleted && renderMessageTick(msg)}
                    </div>
                  )}

                  {/* WhatsApp Floating Reaction Pill Badges */}
                  {hasReactions && (
                    <div className="wa-bubble-reactions-pill">
                      {Object.entries(reactionsObj).map(([emoji, reactors]) => {
                        const count = Array.isArray(reactors) ? reactors.length : 1;
                        const hasMyReaction = Array.isArray(reactors) && reactors.includes(String(currentUserId));
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={`wa-reaction-item ${hasMyReaction ? 'my-reaction' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReactMessage?.(msg.id, emoji);
                            }}
                            title={hasMyReaction ? `You reacted with ${emoji}` : `${count} reaction(s)`}
                          >
                            <span className="wa-reaction-emoji">{emoji}</span>
                            {count > 1 && <span className="wa-reaction-count">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {isGroup && isSent && (
                <MessageAvatar avatar={messageAvatar} label={messageAvatarLabel} />
              )}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}


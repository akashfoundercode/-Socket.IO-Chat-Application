import React, { useState, useEffect, useRef } from 'react';

export default function MessageList({
  messages,
  currentUserId,
  recipientId,
  onDeleteMessage,
  onEditMessage
}) {
  const bottomRef = useRef(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState(null);
  const [selectedMessageForEdit, setSelectedMessageForEdit] = useState(null);
  const [selectedMessageForHistory, setSelectedMessageForHistory] = useState(null);
  const [editText, setEditText] = useState('');
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveMenuMessageId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

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
            <img src={lightboxImage} alt="Fullscreen View" className="wa-lightbox-img" />
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
                <i className="fa-solid fa-pen-to-square" style={{ color: '#008069', marginRight: '8px' }}></i>
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
                <i className="fa-solid fa-clock-rotate-left" style={{ color: '#008069', marginRight: '8px' }}></i>
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
        messages.map((msg, index) => {
          const isSent = msg.from === currentUserId;
          const isDeleted = msg.type === 'deleted';
          const isEdited = Boolean(msg.editedAt || msg.originalText);
          const time = msg.createdAt
            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const isImage = !isDeleted && (msg.type === 'image' || Boolean(msg.mediaUrl));
          const isLocation = !isDeleted && msg.type === 'location';

          let locationData = null;
          if (isLocation && msg.text) {
            try {
              locationData = JSON.parse(msg.text);
            } catch (e) {
              locationData = { latitude: 0, longitude: 0, title: 'Location' };
            }
          }

          return (
            <div
              key={msg.id || index}
              className={`wa-bubble ${isSent ? 'sent' : 'received'} ${isLocation ? 'location-bubble' : ''} ${isDeleted ? 'deleted-bubble' : ''}`}
            >
              {/* Message Action Dropdown Chevron */}
              {!isDeleted && (
                <div className="wa-bubble-actions">
                  <button
                    type="button"
                    className="wa-bubble-menu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuMessageId((prev) => (prev === msg.id ? null : msg.id));
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
                      {/* Edit Option for Sent Text Messages */}
                      {isSent && !isLocation && !isImage && (
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

              {/* A. Deleted Message Representation */}
              {isDeleted ? (
                <div className="wa-bubble-deleted-text">
                  <i className="fa-solid fa-ban"></i>
                  <span>{isSent ? 'You deleted this message' : 'This message was deleted'}</span>
                </div>
              ) : (
                <>
                  {/* B. Photo Attachment */}
                  {isImage && msg.mediaUrl && (
                    <div
                      className="wa-bubble-image-wrap"
                      onClick={() => setLightboxImage(msg.mediaUrl)}
                      title="Click to view full photo"
                    >
                      <img src={msg.mediaUrl} alt="Photo" className="wa-bubble-img" />
                    </div>
                  )}

                  {/* C. 📍 GPS Location Card Bubble */}
                  {isLocation && locationData && (
                    <div className="wa-bubble-location-card">
                      <div className="wa-location-bubble-map-wrap">
                        <iframe
                          title="Pinned Location Map"
                          className="wa-location-bubble-map"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationData.longitude - 0.005}%2C${locationData.latitude - 0.003}%2C${locationData.longitude + 0.005}%2C${locationData.latitude + 0.003}&layer=mapnik&marker=${locationData.latitude}%2C${locationData.longitude}`}
                        />
                        <a
                          href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wa-location-map-clickable-cover"
                          title="Open full map in Google Maps"
                        >
                          <div className="wa-location-pin-icon">
                            <i className="fa-solid fa-location-dot"></i>
                          </div>
                        </a>
                      </div>

                      <div className="wa-location-bubble-footer">
                        <div className="wa-location-bubble-title">
                          <i className="fa-solid fa-location-crosshairs" style={{ color: '#008069' }}></i>
                          <span>{locationData.title || 'Shared Location'}</span>
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wa-location-open-link"
                        >
                          <span>Open in Google Maps</span>
                          <i className="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* D. Text Message or Caption */}
                  {!isLocation && msg.text && (
                    <div className={isImage ? 'wa-bubble-caption' : 'wa-bubble-text'}>
                      {msg.text}
                    </div>
                  )}
                </>
              )}

              {/* Time & Delivery Ticks & (Edited) Tag */}
              <div className="wa-bubble-meta">
                {isEdited && !isDeleted && (
                  <button
                    type="button"
                    className="wa-edited-badge"
                    onClick={(e) => handleOpenHistoryModal(msg, e)}
                    title="Click to view original message / edit history"
                  >
                    <i className="fa-solid fa-pen-fancy" style={{ fontSize: '9px', marginRight: '2px' }}></i>
                    <span>Edited</span>
                  </button>
                )}
                <span className="wa-bubble-time">{time}</span>
                {isSent && !isDeleted && renderMessageTick(msg)}
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}


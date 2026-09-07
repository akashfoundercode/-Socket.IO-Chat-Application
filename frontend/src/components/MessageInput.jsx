import React, { useState, useRef } from 'react';
import EmojiPicker from './EmojiPicker';

export default function MessageInput({
  recipientId,
  onRecipientChange,
  onSendMessage,
  onTyping,
  isBlockedByMe,
  isBlockedByThem,
  onUnblock
}) {
  const [text, setText] = useState('');
  const [showRecipientInput, setShowRecipientInput] = useState(!recipientId);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Image sharing states
  const [pendingImage, setPendingImage] = useState(null);
  const [imageCaption, setImageCaption] = useState('');
  const [showImagePreview, setShowImagePreview] = useState(false);

  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const isBlocked = isBlockedByMe || isBlockedByThem;

  // Debounced Typing emitter
  const handleTextChange = (e) => {
    if (isBlocked) return;
    const val = e.target.value;
    setText(val);

    if (onTyping) {
      if (val.trim()) {
        onTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          onTyping(false);
        }, 2500);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        onTyping(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isBlocked) return;
    const trimmed = text.trim();
    if (trimmed && recipientId.trim()) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (onTyping) onTyping(false);
      onSendMessage(recipientId.trim(), trimmed, 'text', null);
      setText('');
      setShowEmojiPicker(false);
    }
  };

  const handleSelectEmoji = (emoji) => {
    if (isBlocked) return;
    setText((prev) => prev + emoji);
  };

  // When image is picked from file dialog
  const handleImageSelected = (e) => {
    if (isBlocked) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Optimize & resize for crisp messaging
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPendingImage(dataUrl);
        setImageCaption('');
        setShowImagePreview(true);
        setShowEmojiPicker(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  // Send Image with optional caption
  const handleSendImage = () => {
    if (isBlocked || !pendingImage || !recipientId.trim()) return;
    onSendMessage(recipientId.trim(), imageCaption.trim(), 'image', pendingImage);
    setPendingImage(null);
    setImageCaption('');
    setShowImagePreview(false);
  };

  return (
    <div className="wa-bottom-bar">
      {/* Hidden File Input for Image Attachment */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
        style={{ display: 'none' }}
        onChange={handleImageSelected}
      />

      {/* Image Send Preview Modal */}
      {showImagePreview && pendingImage && !isBlocked && (
        <div className="wa-image-preview-modal">
          <div className="wa-image-preview-header">
            <button
              type="button"
              className="wa-image-preview-close"
              onClick={() => {
                setShowImagePreview(false);
                setPendingImage(null);
                setImageCaption('');
              }}
              title="Cancel"
            >
              ✕
            </button>
            <span>Send Photo to {recipientId}</span>
            <div style={{ width: '24px' }}></div>
          </div>

          <div className="wa-image-preview-body">
            <img src={pendingImage} alt="Preview" className="wa-preview-display-img" />
          </div>

          <div className="wa-image-preview-footer">
            <div className="wa-caption-input-wrap">
              <i className="fa-regular fa-face-smile" style={{ color: '#8696a0' }}></i>
              <input
                type="text"
                className="wa-caption-input"
                placeholder="Add a caption..."
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendImage();
                  }
                }}
              />
            </div>

            <button
              type="button"
              className="wa-preview-send-btn"
              onClick={handleSendImage}
              title="Send Photo"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Categorized Full Emoji Picker */}
      {showEmojiPicker && !isBlocked && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Top Recipient Changer Bar */}
      {(!recipientId || showRecipientInput) && !isBlocked && (
        <div className="wa-recipient-bar">
          <label htmlFor="recipient">To:</label>
          <input
            id="recipient"
            type="text"
            placeholder="Recipient phone e.g. +919876543210"
            value={recipientId}
            onChange={(e) => onRecipientChange(e.target.value)}
            autoFocus
          />
          {recipientId && (
            <button
              type="button"
              className="wa-recipient-done-btn"
              onClick={() => setShowRecipientInput(false)}
            >
              OK
            </button>
          )}
        </div>
      )}

      {/* If Blocked, Display WhatsApp style Block Notice Bar */}
      {isBlocked ? (
        <div className="wa-blocked-bar">
          {isBlockedByMe ? (
            <div className="wa-blocked-content">
              <span>You blocked this contact.</span>
              <button
                type="button"
                className="wa-unblock-link-btn"
                onClick={() => onUnblock && onUnblock(recipientId)}
              >
                Tap to unblock
              </button>
            </div>
          ) : (
            <div className="wa-blocked-content">
              <span>You cannot send messages to this contact because you have been blocked.</span>
            </div>
          )}
        </div>
      ) : (
        /* WhatsApp Message Input Row */
        <form className="wa-input-row" onSubmit={handleSubmit}>
          <div className="wa-input-capsule">
            <button
              type="button"
              className={`wa-capsule-icon ${showEmojiPicker ? 'active' : ''}`}
              title="Emoji Keyboard"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
            >
              <i className={showEmojiPicker ? 'fa-solid fa-keyboard' : 'fa-regular fa-face-smile'}></i>
            </button>

            <input
              type="text"
              className="wa-main-input"
              placeholder={recipientId ? 'Message' : 'Set recipient first'}
              value={text}
              onChange={handleTextChange}
              disabled={!recipientId.trim()}
            />

            <button
              type="button"
              className="wa-capsule-icon"
              title="Attach Photo / Image"
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="fa-solid fa-paperclip"></i>
            </button>

            <button
              type="button"
              className="wa-capsule-icon"
              title="Change recipient"
              onClick={() => setShowRecipientInput((prev) => !prev)}
            >
              <i className="fa-solid fa-address-book"></i>
            </button>
          </div>

          <button
            type="submit"
            className="wa-send-mic-btn"
            disabled={!recipientId.trim() || !text.trim()}
            title="Send"
          >
            {text.trim() ? (
              <i className="fa-solid fa-paper-plane"></i>
            ) : (
              <i className="fa-solid fa-microphone"></i>
            )}
          </button>
        </form>
      )}
    </div>
  );
}



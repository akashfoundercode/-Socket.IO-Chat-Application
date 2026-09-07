import React, { useState } from 'react';
import EmojiPicker from './EmojiPicker';

export default function MessageInput({ recipientId, onRecipientChange, onSendMessage }) {
  const [text, setText] = useState('');
  const [showRecipientInput, setShowRecipientInput] = useState(!recipientId);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed && recipientId.trim()) {
      onSendMessage(recipientId.trim(), trimmed);
      setText('');
      setShowEmojiPicker(false);
    }
  };

  const handleSelectEmoji = (emoji) => {
    setText((prev) => prev + emoji);
  };

  return (
    <div className="wa-bottom-bar">
      {/* WhatsApp Categorized Full Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Top Recipient Changer Bar */}
      {(!recipientId || showRecipientInput) && (
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

      {/* WhatsApp Message Input Row */}
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
            onChange={(e) => setText(e.target.value)}
            disabled={!recipientId.trim()}
          />

          <button
            type="button"
            className="wa-capsule-icon"
            title="Change recipient"
            onClick={() => setShowRecipientInput((prev) => !prev)}
          >
            <i className="fa-solid fa-address-book"></i>
          </button>

          <button type="button" className="wa-capsule-icon" title="Attach">
            <i className="fa-solid fa-paperclip"></i>
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
    </div>
  );
}


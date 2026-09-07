import React, { useEffect, useRef } from 'react';

export default function MessageList({ messages, currentUserId, recipientId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  return (
    <div className="wa-messages-container">
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
          <p>Send a real-time message to start the conversation.</p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isSent = msg.from === currentUserId;
          const time = msg.createdAt
            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={msg.id || index}
              className={`wa-bubble ${isSent ? 'sent' : 'received'}`}
            >
              <div className="wa-bubble-text">{msg.text}</div>
              <div className="wa-bubble-meta">
                <span className="wa-bubble-time">{time}</span>
                {isSent && renderMessageTick(msg)}
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

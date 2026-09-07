import React, { useState, useEffect } from 'react';
import { chatApi } from '../services/api';

const COUNTRY_OPTIONS = [
  { code: '+91', name: 'India', flag: '🇮🇳', digits: 10 },
  { code: '+1', name: 'USA/Canada', flag: '🇺🇸', digits: 10 },
  { code: '+44', name: 'UK', flag: '🇬🇧', digits: 10 },
  { code: '+971', name: 'UAE', flag: '🇦🇪', digits: 9 },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', digits: 9 },
  { code: '+61', name: 'Australia', flag: '🇦🇺', digits: 9 },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', digits: 10 },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩', digits: 10 },
  { code: '+977', name: 'Nepal', flag: '🇳🇵', digits: 10 },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', digits: 8 },
];

export default function ChatList({
  userId,
  currentUser,
  activeChat,
  onlineUsers,
  typingUsers,
  onSelectChat,
  onOpenProfile,
  onLogout,
  recentMessages
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Helper to check if a contact is online
  const isUserOnline = (phoneId) => {
    if (!onlineUsers || !phoneId) return false;
    const clean = String(phoneId).trim();
    const withPlus = clean.startsWith('+') ? clean : `+${clean}`;
    const withoutPlus = clean.replace(/^\+/, '');
    return onlineUsers.has(clean) || onlineUsers.has(withPlus) || onlineUsers.has(withoutPlus);
  };

  // Helper to check if a contact is typing
  const isContactTyping = (phoneId) => {
    if (!typingUsers || !phoneId) return false;
    const clean = String(phoneId).trim();
    const withPlus = clean.startsWith('+') ? clean : `+${clean}`;
    const withoutPlus = clean.replace(/^\+/, '');
    return typingUsers.has(clean) || typingUsers.has(withPlus) || typingUsers.has(withoutPlus);
  };

  // New Chat Form State
  const [newCountryCode, setNewCountryCode] = useState('+91');
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [modalError, setModalError] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');

  const selectedCountry = COUNTRY_OPTIONS.find((c) => c.code === newCountryCode) || COUNTRY_OPTIONS[0];

  // 1. Fetch active conversations
  const fetchConversations = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await chatApi.getConversations(userId);
      if (data && data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [userId, recentMessages]);

  // 2. Search Database by Phone Number
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearchingDb(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingDb(true);
        const data = await chatApi.searchUsers(trimmed, userId);
        if (data && data.success && Array.isArray(data.users)) {
          setSearchResults(data.users);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearchingDb(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, userId]);

  // 3. Add / Start New Chat
  const handleStartNewChat = async (e) => {
    e.preventDefault();
    setModalError('');

    const cleanPhone = newPhone.replace(/\D/g, '');
    if (!cleanPhone) {
      setModalError('Phone number is required');
      return;
    }

    if (selectedCountry.digits && cleanPhone.length !== selectedCountry.digits) {
      setModalError(`Please enter ${selectedCountry.digits} digits for ${selectedCountry.name}`);
      return;
    }

    setAddingContact(true);
    try {
      const data = await chatApi.addContact(newCountryCode, cleanPhone, newName);
      const fullPhone = data.contact?.fullPhone || `${newCountryCode}${cleanPhone}`;

      setShowNewChatModal(false);
      setNewPhone('');
      setNewName('');
      onSelectChat(fullPhone);
    } catch (err) {
      setModalError(err.message || 'Could not start chat');
    } finally {
      setAddingContact(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const phone = (c.fullPhone || c.phone || c.id || '').toLowerCase();
    return phone.includes(q);
  });

  return (
    <div className="wa-inbox-screen">
      {/* WhatsApp Top Header Bar */}
      <div className="wa-inbox-header">
        <div
          className="wa-header-user-profile"
          onClick={onOpenProfile}
          title="My Profile & Settings"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div className="wa-avatar" style={{ width: '36px', height: '36px', fontSize: '18px' }}>
            {currentUser?.avatar ? (
              currentUser.avatar.length <= 4 ? (
                <span>{currentUser.avatar}</span>
              ) : (
                <img
                  src={currentUser.avatar}
                  alt="My Avatar"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              )
            ) : (
              <i className="fa-solid fa-user"></i>
            )}
          </div>
          <div className="wa-inbox-user-name" style={{ fontWeight: '600', fontSize: '15px', color: '#ffffff' }}>
            {currentUser?.name || 'WhatsApp'}
          </div>
        </div>

        <div className="wa-inbox-actions">
          <button
            type="button"
            className="wa-inbox-icon"
            title="Start New Chat"
            onClick={() => setShowNewChatModal(true)}
          >
            <i className="fa-solid fa-message"></i>
          </button>
          <button
            type="button"
            className="wa-inbox-icon"
            title="Search"
            onClick={() => {
              const el = document.getElementById('chat-search');
              el?.focus();
            }}
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
          <div className="wa-menu-anchor">
            <button
              type="button"
              className="wa-inbox-icon"
              title="Menu"
              onClick={() => setShowMenu((prev) => !prev)}
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>

            {showMenu && (
              <div className="wa-dropdown-menu">
                <div
                  className="wa-menu-user-info"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setShowMenu(false);
                    onOpenProfile();
                  }}
                  title="View Profile"
                >
                  <div className="wa-menu-user-label">Profile / My Number</div>
                  <div className="wa-menu-user-phone">{userId}</div>
                </div>
                <div className="wa-menu-divider"></div>
                <button
                  type="button"
                  className="wa-menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenProfile();
                  }}
                >
                  <i className="fa-solid fa-gear"></i> Settings / Profile
                </button>
                <button
                  type="button"
                  className="wa-menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    setShowNewChatModal(true);
                  }}
                >
                  <i className="fa-solid fa-user-plus"></i> New Chat
                </button>
                <button
                  type="button"
                  className="wa-menu-item logout"
                  onClick={() => {
                    setShowMenu(false);
                    onLogout();
                  }}
                >
                  <i className="fa-solid fa-right-from-bracket"></i> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Tabs Bar */}
      <div className="wa-tabs-bar">
        <button
          type="button"
          className={`wa-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          CHATS
          {conversations.length > 0 && (
            <span className="wa-tab-badge">{conversations.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`wa-tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          STATUS
        </button>
        <button
          type="button"
          className={`wa-tab-btn ${activeTab === 'calls' ? 'active' : ''}`}
          onClick={() => setActiveTab('calls')}
        >
          CALLS
        </button>
      </div>

      {/* Search Bar */}
      <div className="wa-search-bar-wrap">
        <div className="wa-search-bar">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            id="chat-search"
            type="text"
            placeholder="Search mobile number (+91...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="wa-search-clear"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Chat List Body */}
      <div className="wa-chat-items-list">
        {/* --- SEARCH RESULTS SECTION --- */}
        {searchQuery.trim() ? (
          <div className="wa-search-results-section">
            <div className="wa-section-title">
              <span>Database Number Match</span>
              {isSearchingDb && <i className="fa-solid fa-circle-notch fa-spin"></i>}
            </div>

            {searchResults.length > 0 ? (
              searchResults.map((user) => {
                const phoneDisplay = user.fullPhone || user.phone || user.id;
                const displayName = user.name || phoneDisplay;
                const online = isUserOnline(phoneDisplay);
                return (
                  <div
                    key={user.id}
                    className="wa-chat-item-row search-match"
                    onClick={() => onSelectChat(phoneDisplay, user)}
                  >
                    <div className="wa-item-avatar search-avatar" style={{ position: 'relative' }}>
                      {user.avatar ? (
                        user.avatar.length <= 4 ? (
                          <span style={{ fontSize: '22px', lineHeight: 1 }}>{user.avatar}</span>
                        ) : (
                          <img
                            src={user.avatar}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        )
                      ) : (
                        <i className="fa-solid fa-user"></i>
                      )}
                      {online && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            width: '10px',
                            height: '10px',
                            backgroundColor: '#25d366',
                            borderRadius: '50%',
                            border: '2px solid #ffffff'
                          }}
                          title="Online"
                        />
                      )}
                    </div>
                    <div className="wa-item-center">
                      <div className="wa-item-top">
                        <span className="wa-item-name">{displayName}</span>
                        <span className="wa-search-tag">Start Chat</span>
                      </div>
                      <div className="wa-item-bottom">
                        <span className="wa-item-msg">
                          {user.name && user.name !== phoneDisplay ? `${phoneDisplay} • ` : ''}
                          {user.about || 'Available'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : !isSearchingDb ? (
              <div
                className="wa-search-no-match"
                onClick={() => {
                  let num = searchQuery.trim();
                  if (!num.startsWith('+')) num = `+91${num.replace(/\D/g, '')}`;
                  onSelectChat(num);
                }}
              >
                <i className="fa-solid fa-paper-plane"></i>
                <div>
                  <strong>Chat with "{searchQuery.trim()}"</strong>
                  <p>Tap here to start chatting with this mobile number</p>
                </div>
              </div>
            ) : null}

            {/* Existing matching chats */}
            {filteredConversations.length > 0 && (
              <>
                <div className="wa-section-title">Existing Chats</div>
                {filteredConversations.map((item) => {
                  const phoneDisplay = item.fullPhone || item.phone || item.id;
                  const displayName = item.name || phoneDisplay;
                  const online = isUserOnline(phoneDisplay);
                  const isActive = activeChat && (
                    activeChat === phoneDisplay ||
                    activeChat === item.phone ||
                    activeChat === item.fullPhone ||
                    activeChat === item.id
                  );
                  return (
                    <div
                      key={item.id}
                      className={`wa-chat-item-row ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectChat(phoneDisplay, item)}
                    >
                      <div className="wa-item-avatar" style={{ position: 'relative' }}>
                        {item.avatar ? (
                          item.avatar.length <= 4 ? (
                            <span style={{ fontSize: '22px', lineHeight: 1 }}>{item.avatar}</span>
                          ) : (
                            <img
                              src={item.avatar}
                              alt="Avatar"
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          )
                        ) : (
                          <i className="fa-solid fa-user"></i>
                        )}
                        {online && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '2px',
                              right: '2px',
                              width: '10px',
                              height: '10px',
                              backgroundColor: '#25d366',
                              borderRadius: '50%',
                              border: '2px solid #ffffff'
                            }}
                            title="Online"
                          />
                        )}
                      </div>
                      <div className="wa-item-center">
                        <div className="wa-item-top">
                          <span className="wa-item-name">{displayName}</span>
                          {item.lastMessageAt && (
                            <span className="wa-item-time">
                              {new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="wa-item-bottom">
                          <span className="wa-item-msg">{item.lastMessage || 'Tap to chat'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          /* --- NORMAL CONVERSATIONS LIST --- */
          loading && conversations.length === 0 ? (
            <div className="wa-inbox-loading">
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              <span>Loading chats...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="wa-inbox-empty">
              <div className="wa-empty-icon-circle">
                <i className="fa-solid fa-comments"></i>
              </div>
              <h4>No conversations yet</h4>
              <p>Type any mobile number in the search bar above or tap 💬 below to start chatting!</p>
            </div>
          ) : (
            conversations.map((item) => {
              const phoneDisplay = item.fullPhone || item.phone || item.id;
              const displayName = item.name || phoneDisplay;
              const isDeletedMsg = item.lastMessageType === 'deleted';
              const isLocationMsg = !isDeletedMsg && item.lastMessageType === 'location';
              const isImageMsg = !isDeletedMsg && item.lastMessageType === 'image';
              const lastMsg = isDeletedMsg
                ? '🚫 This message was deleted'
                : isLocationMsg
                  ? '📍 Location'
                  : isImageMsg
                    ? '📷 Photo'
                    : item.lastMessage || 'Tap to chat';
              const online = isUserOnline(phoneDisplay);
              const isActive = activeChat && (
                activeChat === phoneDisplay ||
                activeChat === item.phone ||
                activeChat === item.fullPhone ||
                activeChat === item.id
              );
              const time = item.lastMessageAt
                ? new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={item.id}
                  className={`wa-chat-item-row ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectChat(phoneDisplay, item)}
                >
                  <div className="wa-item-avatar" style={{ position: 'relative' }}>
                    {item.avatar ? (
                      item.avatar.length <= 4 ? (
                        <span style={{ fontSize: '22px', lineHeight: 1 }}>{item.avatar}</span>
                      ) : (
                        <img
                          src={item.avatar}
                          alt="Avatar"
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      )
                    ) : (
                      <i className="fa-solid fa-user"></i>
                    )}
                    {online && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '2px',
                          right: '2px',
                          width: '10px',
                          height: '10px',
                          backgroundColor: '#25d366',
                          borderRadius: '50%',
                          border: '2px solid #ffffff'
                        }}
                        title="Online"
                      />
                    )}
                  </div>
                  <div className="wa-item-center">
                    <div className="wa-item-top">
                      <span className="wa-item-name">{displayName}</span>
                      {time && <span className="wa-item-time">{time}</span>}
                    </div>
                    <div className="wa-item-bottom">
                      {isContactTyping(phoneDisplay) ? (
                        <span className="wa-item-typing">
                          typing<span className="wa-typing-dots"><span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span>
                        </span>
                      ) : (
                        <span className="wa-item-msg">
                          {isLocationMsg && <i className="fa-solid fa-location-dot" style={{ color: '#008069', marginRight: '4px' }}></i>}
                          {isImageMsg && <i className="fa-solid fa-camera" style={{ color: '#8696a0', marginRight: '4px' }}></i>}
                          {lastMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Floating Action Button (Start New Chat) */}
      <button
        type="button"
        className="wa-fab-btn"
        title="Start New Chat"
        onClick={() => setShowNewChatModal(true)}
      >
        <i className="fa-solid fa-message"></i>
      </button>

      {/* Modal: Start Chat / Add Contact */}
      {showNewChatModal && (
        <div className="wa-modal-overlay" onClick={() => setShowNewChatModal(false)}>
          <div className="wa-new-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h3>Start New Chat</h3>
              <button
                type="button"
                className="wa-modal-close"
                onClick={() => {
                  setShowNewChatModal(false);
                  setModalError('');
                }}
              >
                ✕
              </button>
            </div>

            {modalError && <div className="wa-auth-error">{modalError}</div>}

            <form onSubmit={handleStartNewChat} className="wa-modal-form">
              <label>Select Country & Mobile Number:</label>
              <div className="phone-row" style={{ marginBottom: '10px' }}>
                <select
                  className="country-code-input"
                  value={newCountryCode}
                  onChange={(e) => setNewCountryCode(e.target.value)}
                  style={{ width: '110px' }}
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  className="phone-input"
                  placeholder={`${selectedCountry.digits} digits mobile`}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, selectedCountry.digits))}
                  autoFocus
                  required
                />
              </div>

              <label>Contact Name (Optional):</label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ marginBottom: '14px' }}
              />

              <button
                type="submit"
                className="wa-auth-green-btn"
                style={{ width: '100%', maxWidth: '100%', margin: '0' }}
                disabled={addingContact || !newPhone.trim()}
              >
                {addingContact ? 'Adding & Opening...' : 'Start Chatting'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

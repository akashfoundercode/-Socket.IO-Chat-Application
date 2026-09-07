import React, { useState, useEffect, useCallback } from 'react';
import { socket } from './socket/socket';
import { profileApi } from './services/api';
import JoinModal from './components/JoinModal';
import ChatList from './components/ChatList';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import ProfileSettings from './components/ProfileSettings';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('wa_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeChat, setActiveChat] = useState(null); // recipient phone e.g. "+919876543210"
  const [recipientProfile, setRecipientProfile] = useState(null);
  const [currentView, setCurrentView] = useState('inbox'); // 'inbox' | 'chat' | 'profile'
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [recentMessageEvent, setRecentMessageEvent] = useState(null);

  const userId = currentUser ? (currentUser.fullPhone || currentUser.id) : '';

  // Handle Socket Events & Real-Time Presence & Ticks
  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      if (userId) {
        socket.emit('join', userId);
      }
    }

    function onDisconnect() {
      setIsConnected(false);
      setOnlineUsers(new Set());
    }

    function onJoined(joinedId) {
      console.log('Joined socket room as:', joinedId);
    }

    function onConversationHistory(history) {
      setMessages(Array.isArray(history) ? history : []);
    }

    // Online users list
    function onOnlineUsers(list) {
      const set = new Set();
      (list || []).forEach((u) => {
        const clean = String(u || '').trim();
        if (clean) {
          set.add(clean);
          set.add(clean.startsWith('+') ? clean : `+${clean}`);
          set.add(clean.replace(/^\+/, ''));
        }
      });
      setOnlineUsers(set);
    }

    // Single user status change (Online / Offline)
    function onUserStatus({ userId: targetId, isOnline }) {
      if (!targetId) return;
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        const clean = String(targetId).trim();
        const withPlus = clean.startsWith('+') ? clean : `+${clean}`;
        const withoutPlus = clean.replace(/^\+/, '');
        if (isOnline) {
          updated.add(clean);
          updated.add(withPlus);
          updated.add(withoutPlus);
        } else {
          updated.delete(clean);
          updated.delete(withPlus);
          updated.delete(withoutPlus);
        }
        return updated;
      });
    }

    // Incoming message for recipient
    function onMessageReceived(msg) {
      setRecentMessageEvent(msg);

      if (activeChat && (msg.from === activeChat || msg.to === activeChat)) {
        // If recipient is currently inside this chat, mark as seen immediately
        socket.emit('mark_seen', { otherUserId: activeChat });
        setMessages((prev) => [...prev, { ...msg, status: 'seen' }]);
      }
    }

    // Outgoing message confirmation for sender
    function onMessageSaved(msg) {
      setRecentMessageEvent(msg);
      if (activeChat && (msg.from === activeChat || msg.to === activeChat)) {
        setMessages((prev) => [...prev, msg]);
      }
    }

    // Real-time Double Blue Tick update (when recipient opens chat)
    function onMessagesSeen(payload) {
      setMessages((prev) =>
        prev.map((m) => (m.from === userId ? { ...m, status: 'seen' } : m))
      );
    }

    // Real-time Double Gray Tick update (when recipient comes online)
    function onMessagesDelivered(payload) {
      setMessages((prev) =>
        prev.map((m) =>
          m.from === userId && m.status === 'sent' ? { ...m, status: 'delivered' } : m
        )
      );
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('joined', onJoined);
    socket.on('online_users', onOnlineUsers);
    socket.on('user_status', onUserStatus);
    socket.on('conversation_history', onConversationHistory);
    socket.on('message_received', onMessageReceived);
    socket.on('message_saved', onMessageSaved);
    socket.on('messages_seen', onMessagesSeen);
    socket.on('messages_delivered', onMessagesDelivered);

    if (socket.connected && userId) {
      socket.emit('join', userId);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('joined', onJoined);
      socket.off('online_users', onOnlineUsers);
      socket.off('user_status', onUserStatus);
      socket.off('conversation_history', onConversationHistory);
      socket.off('message_received', onMessageReceived);
      socket.off('message_saved', onMessageSaved);
      socket.off('messages_seen', onMessagesSeen);
      socket.off('messages_delivered', onMessagesDelivered);
    };
  }, [userId, activeChat]);

  // Load conversation and fetch recipient profile when activeChat changes
  useEffect(() => {
    if (activeChat && userId) {
      setMessages([]);
      socket.emit('loadConversation', activeChat);
      socket.emit('check_user_status', activeChat);
      setCurrentView('chat');

      // Fetch recipient's latest profile (Name, Avatar, About, Avatar Privacy)
      profileApi.getProfile(activeChat, userId)
        .then((data) => {
          if (data && data.success && data.user) {
            setRecipientProfile(data.user);
          }
        })
        .catch((err) => {
          console.error('Failed to load recipient profile:', err);
        });
    } else if (currentView === 'chat') {
      socket.emit('close_chat');
      setCurrentView('inbox');
      setRecipientProfile(null);
    }
  }, [activeChat, userId]);

  // Calculate if activeChat recipient is actually online
  const isRecipientOnline = Boolean(
    activeChat && (
      onlineUsers.has(activeChat) ||
      onlineUsers.has(activeChat.startsWith('+') ? activeChat : `+${activeChat}`) ||
      onlineUsers.has(activeChat.replace(/^\+/, ''))
    )
  );

  // Login Success
  const handleLoginSuccess = (id, userObj) => {
    const user = userObj || { id, fullPhone: id };
    localStorage.setItem('wa_session', JSON.stringify(user));
    setCurrentUser(user);
    socket.emit('join', id);
    setActiveChat(null);
    setRecipientProfile(null);
    setCurrentView('inbox');
  };

  // Open Chat
  const handleSelectChat = (recipientPhone, contactObj = null) => {
    if (contactObj) {
      setRecipientProfile(contactObj);
    }
    setActiveChat(recipientPhone);
    setCurrentView('chat');
  };

  // Back button in 1-on-1 Chat -> Return to ChatList
  const handleBackToChatList = () => {
    socket.emit('close_chat');
    setActiveChat(null);
    setRecipientProfile(null);
    setMessages([]);
    setCurrentView('inbox');
  };

  // Open Profile Settings
  const handleOpenProfile = () => {
    setCurrentView('profile');
  };

  // Back from Profile Settings
  const handleBackFromProfile = () => {
    setCurrentView('inbox');
  };

  // Explicit Logout
  const handleLogout = () => {
    socket.emit('logout');
    socket.emit('close_chat');
    localStorage.removeItem('wa_session');
    setCurrentUser(null);
    setActiveChat(null);
    setRecipientProfile(null);
    setMessages([]);
    setCurrentView('inbox');
  };

  // Send Message (Text or Image Media)
  const handleSendMessage = useCallback((to, text, type = 'text', mediaUrl = null) => {
    socket.emit('message', { to, text, type, mediaUrl });
  }, []);

  return (
    <div className="wa-app-root">
      {/* 1. SCREEN 1: LOGIN / OTP (If not logged in) */}
      {!currentUser ? (
        <JoinModal onJoin={handleLoginSuccess} isConnected={isConnected} />
      ) : (
        /* 2. AUTHENTICATED MOBILE SMARTPHONE FRAME */
        <div className="wa-phone-frame">
          {/* Top Speaker / Notch */}
          <div className="wa-phone-notch">
            <div className="wa-phone-speaker"></div>
            <div className="wa-phone-camera"></div>
          </div>

          {/* VIEW A: PROFILE / SETTINGS SCREEN */}
          {currentView === 'profile' ? (
            <ProfileSettings
              userId={userId}
              onBack={handleBackFromProfile}
              onProfileUpdated={(updated) => {
                const merged = { ...currentUser, ...updated };
                setCurrentUser(merged);
                localStorage.setItem('wa_session', JSON.stringify(merged));
              }}
            />
          ) : /* VIEW B: 1-ON-1 ACTIVE CONVERSATION */
            activeChat ? (
              <>
                <ChatHeader
                  userId={userId}
                  recipientId={activeChat}
                  recipientName={recipientProfile?.name}
                  recipientAvatar={recipientProfile?.avatar}
                  recipientAbout={recipientProfile?.about}
                  isRecipientOnline={isRecipientOnline}
                  isConnected={isConnected}
                  onBack={handleBackToChatList}
                />

                <MessageList
                  messages={messages}
                  currentUserId={userId}
                  recipientId={activeChat}
                />

                <MessageInput
                  recipientId={activeChat}
                  onRecipientChange={setActiveChat}
                  onSendMessage={handleSendMessage}
                />
              </>
            ) : (
              /* VIEW C: CHATS LIST INBOX */
              <ChatList
                userId={userId}
                onlineUsers={onlineUsers}
                onSelectChat={handleSelectChat}
                onOpenProfile={handleOpenProfile}
                onLogout={handleLogout}
                recentMessages={recentMessageEvent}
              />
            )}

          {/* Bottom Home Indicator Bar */}
          <div className="wa-phone-home-indicator"></div>
        </div>
      )}
    </div>
  );
}

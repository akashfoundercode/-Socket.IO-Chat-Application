import React, { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from './socket/socket';
import { profileApi, blockApi } from './services/api';
import JoinModal from './components/JoinModal';
import ChatList from './components/ChatList';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import ProfileSettings from './components/ProfileSettings';
import CallModal from './components/CallModal';
import { startIncomingRingtone, startOutgoingDialTone, stopCallSounds } from './utils/callSounds';
import './App.css';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

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
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [recentMessageEvent, setRecentMessageEvent] = useState(null);

  // Block & Privacy States for active conversation
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [blockedByMeUsers, setBlockedByMeUsers] = useState(new Set());

  // Calling & Media Stream States
  const [callState, setCallState] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const userId = currentUser ? (currentUser.fullPhone || currentUser.id) : '';

  // Cleanup helper for Calling
  const cleanupCall = useCallback(() => {
    stopCallSounds();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn('Error closing peer connection:', e);
      }
      peerConnectionRef.current = null;
    }

    setCallState(null);
  }, []);

  // Handle Socket Events & Real-Time Presence, Ticks, Typing, Calling
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
      setTypingUsers(new Set());
      cleanupCall();
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

    // Real-Time Typing indicator from peer
    function onTyping({ from, isTyping }) {
      if (!from) return;
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        const clean = String(from).trim();
        const withPlus = clean.startsWith('+') ? clean : `+${clean}`;
        const withoutPlus = clean.replace(/^\+/, '');
        if (isTyping) {
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

    // WebRTC Calling Socket Handlers
    function onIncomingCall({ from, callerName, callerAvatar, callType, offer }) {
      setCallState({
        isIncoming: true,
        isAccepted: false,
        callType: callType || 'voice',
        peerId: from,
        peerName: callerName || from,
        peerAvatar: callerAvatar || null,
        offer: offer || null
      });
      startIncomingRingtone();
    }

    async function onCallAccepted({ from, answer }) {
      stopCallSounds();
      setCallState((prev) => (prev ? { ...prev, isAccepted: true } : null));

      if (peerConnectionRef.current && answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.warn('Error setting remote description on call_accepted:', err);
        }
      }
    }

    function onCallRejected({ reason }) {
      alert(`Call ended: ${reason || 'Declined'}`);
      cleanupCall();
    }

    function onCallEnded() {
      cleanupCall();
    }

    async function onIceCandidate({ candidate }) {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Error adding ICE candidate:', err);
        }
      }
    }

    // Real-Time Cross-User Profile Update Sync
    function onUserProfileChanged(updatedUser) {
      if (!updatedUser?.userId) return;
      const targetId = String(updatedUser.userId).trim();

      if (
        activeChat &&
        (activeChat === targetId ||
          activeChat === `+${targetId}` ||
          activeChat === targetId.replace(/^\+/, ''))
      ) {
        setRecipientProfile((prev) => ({
          ...prev,
          name: updatedUser.name || prev?.name,
          about: updatedUser.about || prev?.about,
          avatar: updatedUser.avatar !== undefined ? updatedUser.avatar : prev?.avatar,
          avatarPrivacy: updatedUser.avatarPrivacy || prev?.avatarPrivacy
        }));
      }

      setRecentMessageEvent({ type: 'profile_sync', timestamp: Date.now() });
    }

    // Real-time Block / Unblock Synchronization
    function onUserBlocked({ targetUserId, byMe }) {
      const clean = String(targetUserId || '').trim();
      if (byMe) {
        setBlockedByMeUsers((prev) => new Set(prev).add(clean));
      }
      if (
        activeChat &&
        (activeChat === clean ||
          activeChat === `+${clean}` ||
          activeChat === clean.replace(/^\+/, ''))
      ) {
        if (byMe) {
          setIsBlockedByMe(true);
        } else {
          setIsBlockedByThem(true);
        }
        setRecipientProfile((prev) => (prev ? { ...prev, avatar: null, about: '' } : prev));
      }
      setRecentMessageEvent({ type: 'block_sync', timestamp: Date.now() });
    }

    function onUserUnblocked({ targetUserId, byMe }) {
      const clean = String(targetUserId || '').trim();
      if (byMe) {
        setBlockedByMeUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(clean);
          updated.delete(clean.startsWith('+') ? clean : `+${clean}`);
          updated.delete(clean.replace(/^\+/, ''));
          return updated;
        });
      }
      if (
        activeChat &&
        (activeChat === clean ||
          activeChat === `+${clean}` ||
          activeChat === clean.replace(/^\+/, ''))
      ) {
        if (byMe) {
          setIsBlockedByMe(false);
        } else {
          setIsBlockedByThem(false);
        }
        profileApi.getProfile(activeChat, userId).then((data) => {
          if (data?.success && data?.user) {
            setRecipientProfile(data.user);
          }
        });
      }
      setRecentMessageEvent({ type: 'unblock_sync', timestamp: Date.now() });
    }

    function onMessageError({ message }) {
      alert(message || 'Failed to send message');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('joined', onJoined);
    socket.on('online_users', onOnlineUsers);
    socket.on('user_status', onUserStatus);
    socket.on('typing', onTyping);
    socket.on('user_profile_changed', onUserProfileChanged);
    socket.on('user_blocked', onUserBlocked);
    socket.on('user_unblocked', onUserUnblocked);
    socket.on('message_error', onMessageError);
    socket.on('conversation_history', onConversationHistory);
    socket.on('message_received', onMessageReceived);
    socket.on('message_saved', onMessageSaved);
    socket.on('messages_seen', onMessagesSeen);
    socket.on('messages_delivered', onMessagesDelivered);

    socket.on('incoming_call', onIncomingCall);
    socket.on('call_accepted', onCallAccepted);
    socket.on('call_rejected', onCallRejected);
    socket.on('call_ended', onCallEnded);
    socket.on('ice_candidate', onIceCandidate);

    if (socket.connected && userId) {
      socket.emit('join', userId);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('joined', onJoined);
      socket.off('online_users', onOnlineUsers);
      socket.off('user_status', onUserStatus);
      socket.off('typing', onTyping);
      socket.off('user_profile_changed', onUserProfileChanged);
      socket.off('user_blocked', onUserBlocked);
      socket.off('user_unblocked', onUserUnblocked);
      socket.off('message_error', onMessageError);
      socket.off('conversation_history', onConversationHistory);
      socket.off('message_received', onMessageReceived);
      socket.off('message_saved', onMessageSaved);
      socket.off('messages_seen', onMessagesSeen);
      socket.off('messages_delivered', onMessagesDelivered);

      socket.off('incoming_call', onIncomingCall);
      socket.off('call_accepted', onCallAccepted);
      socket.off('call_rejected', onCallRejected);
      socket.off('call_ended', onCallEnded);
      socket.off('ice_candidate', onIceCandidate);
    };
  }, [userId, activeChat, cleanupCall]);

  // Load conversation and fetch recipient profile & block status when activeChat changes
  useEffect(() => {
    if (activeChat && userId) {
      setMessages([]);
      setIsBlockedByMe(false);
      setIsBlockedByThem(false);
      socket.emit('loadConversation', activeChat);
      socket.emit('check_user_status', activeChat);
      setCurrentView('chat');

      // Fetch recipient's latest profile (Name, Avatar, About, Avatar Privacy, Block state)
      profileApi.getProfile(activeChat, userId)
        .then((data) => {
          if (data && data.success && data.user) {
            setRecipientProfile(data.user);
            setIsBlockedByMe(Boolean(data.user.isBlockedByMe));
            setIsBlockedByThem(Boolean(data.user.isBlockedByThem));
          }
        })
        .catch((err) => {
          console.error('Failed to load recipient profile:', err);
        });

      // Explicit check block status
      blockApi.getBlockStatus(userId, activeChat)
        .then((data) => {
          if (data && data.success) {
            setIsBlockedByMe(Boolean(data.isBlockedByMe));
            setIsBlockedByThem(Boolean(data.isBlockedByThem));
          }
        })
        .catch((err) => {
          console.error('Failed to get block status:', err);
        });
    } else if (currentView === 'chat') {
      socket.emit('close_chat');
      setCurrentView('inbox');
      setRecipientProfile(null);
      setIsBlockedByMe(false);
      setIsBlockedByThem(false);
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

  // Calculate if activeChat recipient is typing
  const isRecipientTyping = Boolean(
    activeChat && (
      typingUsers.has(activeChat) ||
      typingUsers.has(activeChat.startsWith('+') ? activeChat : `+${activeChat}`) ||
      typingUsers.has(activeChat.replace(/^\+/, ''))
    )
  );

  // 1. Initiate Outgoing Call (Voice / Video)
  const handleStartCall = async (callType) => {
    if (!activeChat) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', { to: activeChat, candidate: event.candidate });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      startOutgoingDialTone();

      socket.emit('call_user', {
        to: activeChat,
        callerName: currentUser?.name || userId,
        callerAvatar: currentUser?.avatar || null,
        callType,
        offer
      });

      setCallState({
        isIncoming: false,
        isAccepted: false,
        callType,
        peerId: activeChat,
        peerName: recipientProfile?.name || activeChat,
        peerAvatar: recipientProfile?.avatar || null
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      alert('Could not access microphone or camera. Please check browser permissions.');
      cleanupCall();
    }
  };

  // 2. Accept Incoming Call
  const handleAcceptCall = async () => {
    if (!callState || !callState.peerId) return;
    stopCallSounds();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callState.callType === 'video'
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', { to: callState.peerId, candidate: event.candidate });
        }
      };

      if (callState.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callState.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer_call', { to: callState.peerId, answer });
      }

      setCallState((prev) => (prev ? { ...prev, isAccepted: true } : null));
    } catch (err) {
      console.error('Failed to accept call:', err);
      alert('Could not access microphone or camera. Call declined.');
      handleRejectCall();
    }
  };

  // 3. Reject Incoming Call
  const handleRejectCall = () => {
    if (callState?.peerId) {
      socket.emit('reject_call', { to: callState.peerId, reason: 'Declined' });
    }
    cleanupCall();
  };

  // 4. End Active Call
  const handleEndCall = () => {
    if (callState?.peerId) {
      socket.emit('end_call', { to: callState.peerId });
    }
    cleanupCall();
  };

  // 5. Emit Typing Indicator
  const handleTyping = useCallback(
    (isTyping) => {
      if (activeChat) {
        socket.emit('typing', { to: activeChat, isTyping });
      }
    },
    [activeChat]
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

  // Block & Unblock Contact Actions
  const handleBlockUser = async (targetId) => {
    const cleanTarget = String(targetId || activeChat || '').trim();
    if (!cleanTarget || !userId) return;

    try {
      await blockApi.blockUser(userId, cleanTarget);
      socket.emit('block_user', { targetUserId: cleanTarget });
      setIsBlockedByMe(true);
      setRecipientProfile((prev) => (prev ? { ...prev, avatar: null, about: '' } : prev));
      setRecentMessageEvent({ type: 'block_sync', timestamp: Date.now() });
    } catch (err) {
      console.error('Failed to block user:', err);
      alert(err.message || 'Failed to block contact');
    }
  };

  const handleUnblockUser = async (targetId) => {
    const cleanTarget = String(targetId || activeChat || '').trim();
    if (!cleanTarget || !userId) return;

    try {
      await blockApi.unblockUser(userId, cleanTarget);
      socket.emit('unblock_user', { targetUserId: cleanTarget });
      setIsBlockedByMe(false);
      profileApi.getProfile(cleanTarget, userId).then((data) => {
        if (data?.success && data?.user) {
          setRecipientProfile(data.user);
        }
      });
      setRecentMessageEvent({ type: 'unblock_sync', timestamp: Date.now() });
    } catch (err) {
      console.error('Failed to unblock user:', err);
      alert(err.message || 'Failed to unblock contact');
    }
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
    <div className={`wa-app-root ${currentUser ? 'is-logged-in' : 'is-logged-out'}`}>
      {/* Background Top Strip for Desktop/Web */}
      <div className="wa-web-top-strip"></div>

      {/* Call Modal / Overlay (Active, Incoming, Video, Voice) */}
      {callState && (
        <CallModal
          callState={callState}
          onAcceptCall={handleAcceptCall}
          onRejectCall={handleRejectCall}
          onEndCall={handleEndCall}
          localStream={localStream}
          remoteStream={remoteStream}
        />
      )}

      {/* 1. SCREEN 1: LOGIN / OTP (If not logged in) */}
      {!currentUser ? (
        <JoinModal onJoin={handleLoginSuccess} isConnected={isConnected} />
      ) : (
        /* 2. AUTHENTICATED RESPONSIVE CONTAINER (Desktop / Tablet / Mobile) */
        <div
          className={`wa-main-container ${activeChat ? 'has-active-chat' : 'no-active-chat'
            } ${currentView === 'profile' ? 'is-profile-view' : ''}`}
        >
          {/* A. LEFT SIDEBAR PANE (Profile Settings OR Chat List) */}
          <aside className="wa-sidebar-pane">
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
            ) : (
              <ChatList
                userId={userId}
                currentUser={currentUser}
                activeChat={activeChat}
                onlineUsers={onlineUsers}
                typingUsers={typingUsers}
                onSelectChat={handleSelectChat}
                onOpenProfile={handleOpenProfile}
                onLogout={handleLogout}
                recentMessages={recentMessageEvent}
              />
            )}
          </aside>

          {/* B. RIGHT MAIN CHAT PANE (Active Conversation OR WhatsApp Web Welcome) */}
          <main className="wa-chat-pane">
            {activeChat ? (
              <div className="wa-active-chat-wrapper">
                <ChatHeader
                  userId={userId}
                  recipientId={activeChat}
                  recipientName={recipientProfile?.name}
                  recipientAvatar={recipientProfile?.avatar}
                  recipientAbout={recipientProfile?.about}
                  isRecipientOnline={isRecipientOnline}
                  isConnected={isConnected}
                  isTyping={isRecipientTyping}
                  isBlockedByMe={isBlockedByMe}
                  isBlockedByThem={isBlockedByThem}
                  onStartCall={handleStartCall}
                  onBack={handleBackToChatList}
                  onBlock={handleBlockUser}
                  onUnblock={handleUnblockUser}
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
                  onTyping={handleTyping}
                  isBlockedByMe={isBlockedByMe}
                  isBlockedByThem={isBlockedByThem}
                  onUnblock={handleUnblockUser}
                />
              </div>
            ) : (
              /* WhatsApp Web Welcome / Empty Screen */
              <div className="wa-web-welcome-screen">
                <div className="wa-welcome-content">
                  <div className="wa-welcome-illustration">
                    <div className="wa-welcome-icon-circle">
                      <i className="fa-brands fa-whatsapp"></i>
                    </div>
                  </div>
                  <h2 className="wa-welcome-title">WhatsApp Web</h2>
                  <p className="wa-welcome-text">
                    Send and receive messages without keeping your phone online.
                    <br />
                    Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
                  </p>
                  <div className="wa-welcome-divider"></div>
                  <div className="wa-welcome-encryption">
                    <i className="fa-solid fa-lock"></i>
                    <span>End-to-end encrypted</span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

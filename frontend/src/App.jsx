import React, { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from './socket/socket';
import { profileApi, blockApi, chatApi, agoraApi } from './services/api';
import agoraService from './services/agoraService';
import JoinModal from './components/JoinModal';
import ChatList from './components/ChatList';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import ProfileSettings from './components/ProfileSettings';
import CallModal from './components/CallModal';
import { startIncomingRingtone, startOutgoingDialTone, stopCallSounds, playMessageNotification } from './utils/callSounds';
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

  const [activeChat, setActiveChat] = useState(() => {
    try { return localStorage.getItem('wa_active_chat') || null; } catch { return null; }
  });
  const [recipientProfile, setRecipientProfile] = useState(null);
  const [currentView, setCurrentView] = useState(() => {
    try { return localStorage.getItem('wa_active_chat') ? 'chat' : 'inbox'; } catch { return 'inbox'; }
  });
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [groupDetails, setGroupDetails] = useState(null);
  const [groupTypingUsers, setGroupTypingUsers] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [recentMessageEvent, setRecentMessageEvent] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem('wa_theme') || 'orange');

  const themes = {
    green: { '--wa-green': '#00a884', '--wa-green-dark': '#008069', '--wa-green-header': '#008069', '--wa-green-hover': '#06b995', '--wa-online': '#25d366', '--wa-soft-bg': '#e6f7f2', '--wa-hover-bg': '#e6f7f2', '--wa-hover-text': '#064e3b', '--wa-chat-bg': '#efeae2', '--wa-outgoing-bubble': '#d9fdd3', '--wa-accent-light': '#f0fdf4', '--wa-accent-border': '#d1fae5', '--wa-accent-deep': '#064e3b', '--wa-header-gradient': 'linear-gradient(160deg,#0b4d3b 0%,#008069 55%,#00a884 100%)', '--wa-theme-badge': '#dcfce7', '--wa-theme-badge-text': '#166534' },
    orange: { '--wa-green': '#f97316', '--wa-green-dark': '#c2410c', '--wa-green-header': '#ea580c', '--wa-green-hover': '#fb923c', '--wa-online': '#f97316', '--wa-soft-bg': '#fff0e1', '--wa-hover-bg': '#fff7ed', '--wa-hover-text': '#7c2d12', '--wa-chat-bg': '#fff7ed', '--wa-outgoing-bubble': '#ffedd5', '--wa-accent-light': '#fff7ed', '--wa-accent-border': '#fed7aa', '--wa-accent-deep': '#7c2d12', '--wa-header-gradient': 'linear-gradient(160deg,#7c2d12 0%,#ea580c 55%,#f97316 100%)', '--wa-theme-badge': '#ffedd5', '--wa-theme-badge-text': '#9a3412' },
    blue: { '--wa-green': '#168aad', '--wa-green-dark': '#126782', '--wa-green-header': '#126782', '--wa-green-hover': '#2aa9cf', '--wa-online': '#168aad', '--wa-soft-bg': '#e4f4f8', '--wa-hover-bg': '#edf7fa', '--wa-hover-text': '#164e63', '--wa-chat-bg': '#edf7fa', '--wa-outgoing-bubble': '#d9f1f8', '--wa-accent-light': '#f0f9ff', '--wa-accent-border': '#bae6fd', '--wa-accent-deep': '#164e63', '--wa-header-gradient': 'linear-gradient(160deg,#0c4a6e 0%,#126782 55%,#168aad 100%)', '--wa-theme-badge': '#dbeafe', '--wa-theme-badge-text': '#1e40af' },
    charcoal: { '--wa-green': '#64748b', '--wa-green-dark': '#334155', '--wa-green-header': '#334155', '--wa-green-hover': '#7c8da3', '--wa-online': '#64748b', '--wa-soft-bg': '#e8edf2', '--wa-hover-bg': '#eef1f4', '--wa-hover-text': '#1e293b', '--wa-chat-bg': '#eef1f4', '--wa-outgoing-bubble': '#e2e8f0', '--wa-accent-light': '#f8fafc', '--wa-accent-border': '#cbd5e1', '--wa-accent-deep': '#1e293b', '--wa-header-gradient': 'linear-gradient(160deg,#0f172a 0%,#334155 55%,#64748b 100%)', '--wa-theme-badge': '#e2e8f0', '--wa-theme-badge-text': '#334155' }
  };

  const handleThemeChange = useCallback((nextTheme) => {
    if (!themes[nextTheme]) return;
    setTheme(nextTheme);
    localStorage.setItem('wa_theme', nextTheme);
  }, []);

  // Block & Privacy States for active conversation
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [blockedByMeUsers, setBlockedByMeUsers] = useState(new Set());

  // Agora Calling & Media States
  const [callState, setCallState] = useState(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState(null);
  const [remoteVideoTracks, setRemoteVideoTracks] = useState({});
  const [callLogsTrigger, setCallLogsTrigger] = useState(0);
  const [remotePeerMediaStatus, setRemotePeerMediaStatus] = useState({ isMuted: false, isVideoOff: false });
  const [callParticipants, setCallParticipants] = useState([]);
  const [speakingVolumes, setSpeakingVolumes] = useState({});
  const callUserMetadataRef = useRef(new Map());
  const isEndingCallRef = useRef(false);
  const callStateRef = useRef(callState);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const userId = currentUser ? (currentUser.fullPhone || currentUser.id) : '';

  // Cleanup helper for Agora Calling
  const cleanupCall = useCallback(() => {
    isEndingCallRef.current = false;
    stopCallSounds();
    agoraService.leaveChannel();
    setLocalVideoTrack(null);
    setRemoteVideoTrack(null);
    setRemoteVideoTracks({});
    setCallParticipants([]);
    setSpeakingVolumes({});
    setCallState(null);
    setIsCallMinimized(false);
    callUserMetadataRef.current.clear();
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

    function onGroupHistory(history) {
      setMessages(Array.isArray(history) ? history : []);
    }

    function onGroupDetails(group) {
      setGroupDetails(group || null);
    }

    function onGroupCreated({ group }) {
      if (group && group.id) {
        socket.emit('join_group_room', group.id);
      }
    }

    function onGroupMessageReceived(message) {
      const isCurrentGroup = activeChat === `group:${message.groupId}`;
      // Auto-detect system messages if type is missing
      const normalizedMessage = message.type ? message : {
        ...message,
        type: (typeof message.text === 'string' && message.text.startsWith('{') && (() => { try { return JSON.parse(message.text)?.action; } catch (e) { return false; } })()) ? 'system' : (message.type || 'text')
      };
      if (!isCurrentGroup || document.hidden) {
        if (normalizedMessage.type !== 'system') playMessageNotification();
      }
      if (activeChat === `group:${message.groupId}`) {
        setMessages((prev) => [...prev, normalizedMessage]);
      }
      setRecentMessageEvent({ type: 'group_message', timestamp: Date.now() });
    }

    function onGroupReactionUpdated({ messageId, reactions }) {
      setMessages((prev) => prev.map((message) => (
        String(message.id) === String(messageId) ? { ...message, reactions } : message
      )));
    }

    function onGroupTyping({ from, isTyping }) {
      setGroupTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(String(from));
        else next.delete(String(from));
        return next;
      });
    }

    function onGroupMemberRemoved({ groupId, memberId }) {
      const cleanMemberId = String(memberId || '').replace(/^\+/, '');
      const cleanMyId = String(userId || '').replace(/^\+/, '');
      if (activeChat === `group:${groupId}` && cleanMemberId === cleanMyId) {
        setActiveChat(null);
        setGroupDetails(null);
        setMessages([]);
        setCurrentView('inbox');
        try { localStorage.removeItem('wa_active_chat'); } catch { }
      }
      setRecentMessageEvent({ type: 'group_member_removed', groupId, memberId, timestamp: Date.now() });
    }

    function onGroupMemberLeft({ groupId, userId: leftUserId }) {
      const cleanLeftId = String(leftUserId || '').replace(/^\+/, '');
      const cleanMyId = String(userId || '').replace(/^\+/, '');
      if (activeChat === `group:${groupId}` && cleanLeftId === cleanMyId) {
        setActiveChat(null);
        setGroupDetails(null);
        setMessages([]);
        setCurrentView('inbox');
        try { localStorage.removeItem('wa_active_chat'); } catch { }
      }
      setRecentMessageEvent({ type: 'group_member_left', groupId, userId: leftUserId, timestamp: Date.now() });
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

      const cleanMsgFrom = String(msg.from || '').replace(/\D/g, '');
      const cleanActive = String(activeChat || '').replace(/\D/g, '');
      const isGroup = String(activeChat || '').startsWith('group:');

      const isCurrentChat = Boolean(
        activeChat &&
        !isGroup &&
        cleanActive &&
        cleanMsgFrom &&
        cleanMsgFrom === cleanActive
      );

      if (!isCurrentChat || document.hidden) {
        playMessageNotification();
      }

      if (isCurrentChat) {
        // If recipient is currently inside this chat, mark as seen immediately
        socket.emit('mark_seen', { otherUserId: activeChat });
        setMessages((prev) => [...prev, { ...msg, status: 'seen' }]);
      }
    }

    // Outgoing message confirmation for sender
    function onMessageSaved(msg) {
      setRecentMessageEvent(msg);
      const cleanActive = String(activeChat || '').replace(/\D/g, '');
      const cleanFrom = String(msg.from || '').replace(/\D/g, '');
      const cleanTo = String(msg.to || '').replace(/\D/g, '');
      if (activeChat && (cleanFrom === cleanActive || cleanTo === cleanActive)) {
        setMessages((prev) => [...prev, msg]);
      }
    }

    // Real-time Double Blue Tick update (when recipient opens chat)
    function onMessagesSeen(payload) {
      const cleanSeenBy = String(payload?.seenBy || payload?.conversationWith || '').replace(/\D/g, '');
      const cleanActive = String(activeChat || '').replace(/\D/g, '');

      // Only update ticks if the currently open chat is with the user who viewed the messages
      if (cleanSeenBy && cleanActive && cleanSeenBy === cleanActive) {
        setMessages((prev) =>
          prev.map((m) => {
            const cleanMsgFrom = String(m.from || '').replace(/\D/g, '');
            const cleanSelf = String(userId || '').replace(/\D/g, '');
            if (cleanMsgFrom === cleanSelf && m.status !== 'seen') {
              return { ...m, status: 'seen' };
            }
            return m;
          })
        );
      }
    }

    // Real-time Double Gray Tick update (when recipient comes online)
    function onMessagesDelivered(payload) {
      const cleanDeliveredTo = String(payload?.to || payload?.recipientId || '').replace(/\D/g, '');
      const cleanActive = String(activeChat || '').replace(/\D/g, '');

      if (!cleanDeliveredTo || (cleanActive && cleanDeliveredTo === cleanActive)) {
        setMessages((prev) =>
          prev.map((m) => {
            const cleanMsgFrom = String(m.from || '').replace(/\D/g, '');
            const cleanSelf = String(userId || '').replace(/\D/g, '');
            if (cleanMsgFrom === cleanSelf && m.status === 'sent') {
              return { ...m, status: 'delivered' };
            }
            return m;
          })
        );
      }
    }

    // Real-time Message Deleted Handler (Delete for everyone / Delete for me)
    function onMessageDeleted({ messageId, deleteFor, message }) {
      if (deleteFor === 'everyone') {
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id) === String(messageId)
              ? { ...m, type: 'deleted', text: 'This message was deleted', mediaUrl: null }
              : m
          )
        );
      } else {
        // Delete for me: remove message from local state
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
      }
      setRecentMessageEvent({ type: 'message_deleted', messageId, timestamp: Date.now() });
    }

    // Real-time Message Edited Handler
    function onMessageEdited(updatedMsg) {
      if (!updatedMsg || !updatedMsg.id) return;
      setMessages((prev) =>
        prev.map((m) => (String(m.id) === String(updatedMsg.id) ? { ...m, ...updatedMsg } : m))
      );
      setRecentMessageEvent({ type: 'message_edited', message: updatedMsg, timestamp: Date.now() });
    }

    function onMessagePinUpdated(updatedMsg) {
      if (!updatedMsg || !updatedMsg.id) return;
      setMessages((prev) =>
        prev.map((m) => (String(m.id) === String(updatedMsg.id) ? { ...m, ...updatedMsg } : m))
      );
      setRecentMessageEvent({ type: 'message_pin_updated', message: updatedMsg, timestamp: Date.now() });
    }

    // Real-time 1-on-1 Message Reaction Handler
    function onMessageReactionUpdated({ messageId, reactions }) {
      setMessages((prev) =>
        prev.map((m) => (String(m.id) === String(messageId) ? { ...m, reactions } : m))
      );
    }

    // Real-time Conversation Deleted Handler (Swipe to Delete)
    function onConversationDeleted({ otherUserId }) {
      if (
        activeChat &&
        (activeChat === otherUserId ||
          activeChat === String(otherUserId).replace(/^\+/, '') ||
          activeChat === `+${String(otherUserId).replace(/^\+/, '')}`)
      ) {
        setActiveChat(null);
        setRecipientProfile(null);
        setMessages([]);
        setCurrentView('inbox');
      }
      setRecentMessageEvent({ type: 'conversation_deleted', otherUserId, timestamp: Date.now() });
    }

    // Real-time Contact Renamed Handler (Private Alias)
    function onContactRenamed({ contactId, customName }) {
      if (
        activeChat &&
        (activeChat === contactId ||
          activeChat === String(contactId).replace(/^\+/, '') ||
          activeChat === `+${String(contactId).replace(/^\+/, '')}`)
      ) {
        setRecipientProfile((prev) => {
          if (!prev) return prev;
          const newDisplayName = customName || prev.profileName || prev.fullPhone || contactId;
          return { ...prev, name: newDisplayName, customName: customName || null };
        });
      }
      setRecentMessageEvent({ type: 'contact_renamed', contactId, customName, timestamp: Date.now() });
    }

    // Agora Calling Socket Handlers
    function onIncomingCall({ from, callerName, callerAvatar, callType, channelName }) {
      setCallState({
        isIncoming: true,
        isAccepted: false,
        isRinging: true,
        callType: callType || 'voice',
        channelName: channelName || null,
        peerId: from,
        peerName: callerName || from,
        peerAvatar: callerAvatar || null
      });

      // Acknowledge to caller that device received signal and is ringing
      socket.emit('call_ringing', { to: from, channelName });
      startIncomingRingtone();
    }

    function onIncomingGroupCall({ from, groupId, groupName, groupAvatar, callerName, callerAvatar, callType, channelName, agoraUid }) {
      setCallState({
        isIncoming: true,
        isAccepted: false,
        isRinging: true,
        callType: callType || 'voice',
        channelName: channelName || null,
        peerId: `group:${groupId}`,
        groupId: String(groupId),
        callerId: from,
        peerName: groupName || 'Group Call',
        callerName: callerName || from,
        peerAvatar: groupAvatar || callerAvatar || null
      });
      // Store caller metadata
      const callerMeta = {
        userId: from,
        name: callerName || from,
        avatar: callerAvatar || groupAvatar || null
      };
      callUserMetadataRef.current.set(String(from), callerMeta);
      if (agoraUid) {
        callUserMetadataRef.current.set(String(agoraUid), callerMeta);
      }
      // An incoming participant must remain outside Agora until they accept.
      setCallParticipants([]);
      startIncomingRingtone();
    }

    function onCallWaiting({ from, callerName, callerAvatar, callType, channelName }) {
      setCallState({
        isIncoming: true,
        isAccepted: false,
        isCallWaiting: true,
        callType: callType || 'voice',
        channelName: channelName || null,
        peerId: from,
        peerName: callerName || from,
        peerAvatar: callerAvatar || null
      });
      startIncomingRingtone();
    }

    function onCallWaitingResponse({ message }) {
      setCallState((prev) => (prev ? { ...prev, isCallWaiting: true, isRinging: false } : null));
    }

    function onCallRinging({ from }) {
      setCallState((prev) => (prev ? { ...prev, isRinging: true, isCallWaiting: false } : null));
    }

    async function onCallAccepted({ from, channelName }) {
      stopCallSounds();
      setCallState((prev) => (prev ? { ...prev, isAccepted: true, isRinging: false } : null));
    }

    function onCallRejected({ reason }) {
      alert(`Call ended: ${reason || 'Declined'}`);
      cleanupCall();
    }

    function onCallEnded() {
      cleanupCall();
    }

    function onCallLogUpdated() {
      setCallLogsTrigger((prev) => prev + 1);
    }

    function onCallMediaStatus({ isMuted, isVideoOff }) {
      setRemotePeerMediaStatus({ isMuted: Boolean(isMuted), isVideoOff: Boolean(isVideoOff) });
    }

    function onGroupCallAccepted(data) {
      // This event is broadcast to the group. Only an already-running caller
      // should transition because another member accepted; ringing members
      // must keep waiting for their own explicit Accept/Join action.
      setCallState((prev) => (
        prev && !prev.isIncoming
          ? (() => {
            stopCallSounds();
            return { ...prev, isAccepted: true, isRinging: false };
          })()
          : prev
      ));
      if (data && data.from) {
        const metadata = {
          userId: data.from,
          name: data.name || data.from,
          avatar: data.avatar || null
        };
        callUserMetadataRef.current.set(String(data.from), metadata);
        if (data.agoraUid) {
          callUserMetadataRef.current.set(String(data.agoraUid), metadata);
        }
        // Update existing participant in list if present
        setCallParticipants((prev) =>
          prev.map((p) => {
            const isMatch = (data.agoraUid && (String(p.uid) === String(data.agoraUid) || String(p.agoraUid) === String(data.agoraUid))) || p.userId === data.from;
            if (isMatch) {
              return { ...p, name: data.name || p.name, avatar: data.avatar || p.avatar, userId: data.from };
            }
            return p;
          })
        );
      }
    }

    function onGroupCallUserJoined(data) {
      if (data && data.from) {
        const metadata = {
          userId: data.from,
          name: data.name || data.from,
          avatar: data.avatar || null
        };
        callUserMetadataRef.current.set(String(data.from), metadata);
        if (data.agoraUid) {
          callUserMetadataRef.current.set(String(data.agoraUid), metadata);
        }
        // Update existing participant in list if present
        setCallParticipants((prev) =>
          prev.map((p) => {
            const isMatch = (data.agoraUid && (String(p.uid) === String(data.agoraUid) || String(p.agoraUid) === String(data.agoraUid))) || p.userId === data.from;
            if (isMatch) {
              return { ...p, name: data.name || p.name, avatar: data.avatar || p.avatar, userId: data.from };
            }
            return p;
          })
        );
      }
    }

    function onGroupCallUserLeft({ from }) {
      setRemoteVideoTracks((prev) => {
        const next = { ...prev };
        delete next[from];
        delete next[String(from)];
        return next;
      });
      setCallParticipants((prev) => {
        const remaining = prev.filter((p) => p.userId !== from && p.uid !== from);
        if (callStateRef.current?.isAccepted && remaining.length === 0 && !isEndingCallRef.current) {
          console.log('[Socket] Last remote participant left group call, ending call');
          isEndingCallRef.current = true;
          setTimeout(() => {
            handleEndCall();
          }, 250);
        }
        return remaining;
      });
    }

    function onGroupCallPeerMediaStatus({ from, isMuted, isVideoOff }) {
      setCallParticipants((prev) =>
        prev.map((p) =>
          p.userId === from || p.uid === from ? { ...p, isMuted: Boolean(isMuted), isVideoOff: Boolean(isVideoOff) } : p
        )
      );
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
        setRecipientProfile((prev) => {
          if (!prev) return prev;
          const currentDisplayName = prev.customName || prev.fullPhone || prev.phone || activeChat;
          return {
            ...prev,
            name: currentDisplayName,
            profileName: updatedUser.profileName || updatedUser.name || prev.profileName,
            about: updatedUser.about !== undefined ? updatedUser.about : prev.about,
            avatar: updatedUser.avatar !== undefined ? updatedUser.avatar : prev.avatar,
            avatarPrivacy: updatedUser.avatarPrivacy || prev.avatarPrivacy
          };
        });
      }

      setGroupDetails((prev) => {
        if (!prev?.members) return prev;
        const normalizedTarget = targetId.replace(/^\+/, '');
        const hasMember = prev.members.some((member) => (
          String(member.userId).replace(/^\+/, '') === normalizedTarget ||
          String(member.fullPhone || '').replace(/^\+/, '') === normalizedTarget
        ));
        if (!hasMember) return prev;
        return {
          ...prev,
          members: prev.members.map((member) => {
            const memberId = String(member.userId).replace(/^\+/, '');
            const memberPhone = String(member.fullPhone || '').replace(/^\+/, '');
            if (memberId !== normalizedTarget && memberPhone !== normalizedTarget) return member;
            return {
              ...member,
              name: updatedUser.profileName || updatedUser.name || member.name,
              avatar: updatedUser.avatar !== undefined ? updatedUser.avatar : member.avatar
            };
          })
        };
      });

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
    socket.on('group_history', onGroupHistory);
    socket.on('group_details', onGroupDetails);
    socket.on('group_created', onGroupCreated);
    socket.on('group_member_removed', onGroupMemberRemoved);
    socket.on('group_member_left', onGroupMemberLeft);
    socket.on('group_message_received', onGroupMessageReceived);
    socket.on('group_reaction_updated', onGroupReactionUpdated);
    socket.on('group_typing', onGroupTyping);
    socket.on('message_received', onMessageReceived);
    socket.on('message_saved', onMessageSaved);
    socket.on('message_reaction_updated', onMessageReactionUpdated);
    socket.on('messages_seen', onMessagesSeen);
    socket.on('messages_delivered', onMessagesDelivered);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('message_edited', onMessageEdited);
    socket.on('message_pin_updated', onMessagePinUpdated);
    socket.on('conversation_deleted', onConversationDeleted);
    socket.on('contact_renamed', onContactRenamed);

    socket.on('incoming_call', onIncomingCall);
    socket.on('incoming_group_call', onIncomingGroupCall);
    socket.on('call_waiting', onCallWaiting);
    socket.on('call_waiting_response', onCallWaitingResponse);
    socket.on('call_ringing', onCallRinging);
    socket.on('call_accepted', onCallAccepted);
    socket.on('call_rejected', onCallRejected);
    socket.on('call_ended', onCallEnded);
    socket.on('call_log_updated', onCallLogUpdated);
    socket.on('call_media_status', onCallMediaStatus);
    socket.on('group_call_accepted', onGroupCallAccepted);
    socket.on('group_call_user_joined', onGroupCallUserJoined);
    socket.on('group_call_user_left', onGroupCallUserLeft);
    socket.on('group_call_peer_media_status', onGroupCallPeerMediaStatus);
    socket.on('group_call_ended', onCallEnded);

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
      socket.off('group_history', onGroupHistory);
      socket.off('group_details', onGroupDetails);
      socket.off('group_created', onGroupCreated);
      socket.off('group_member_removed', onGroupMemberRemoved);
      socket.off('group_member_left', onGroupMemberLeft);
      socket.off('group_message_received', onGroupMessageReceived);
      socket.off('group_reaction_updated', onGroupReactionUpdated);
      socket.off('group_typing', onGroupTyping);
      socket.off('message_received', onMessageReceived);
      socket.off('message_saved', onMessageSaved);
      socket.off('message_reaction_updated', onMessageReactionUpdated);
      socket.off('messages_seen', onMessagesSeen);
      socket.off('messages_delivered', onMessagesDelivered);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('message_edited', onMessageEdited);
      socket.off('message_pin_updated', onMessagePinUpdated);
      socket.off('conversation_deleted', onConversationDeleted);
      socket.off('contact_renamed', onContactRenamed);

      socket.off('incoming_call', onIncomingCall);
      socket.off('incoming_group_call', onIncomingGroupCall);
      socket.off('call_waiting', onCallWaiting);
      socket.off('call_waiting_response', onCallWaitingResponse);
      socket.off('call_ringing', onCallRinging);
      socket.off('call_accepted', onCallAccepted);
      socket.off('call_rejected', onCallRejected);
      socket.off('call_ended', onCallEnded);
      socket.off('call_log_updated', onCallLogUpdated);
      socket.off('call_media_status', onCallMediaStatus);
      socket.off('group_call_accepted', onGroupCallAccepted);
      socket.off('group_call_user_joined', onGroupCallUserJoined);
      socket.off('group_call_user_left', onGroupCallUserLeft);
      socket.off('group_call_peer_media_status', onGroupCallPeerMediaStatus);
      socket.off('group_call_ended', onCallEnded);
    };
  }, [userId, activeChat, cleanupCall]);

  // Load conversation and fetch recipient profile & block status when activeChat changes
  useEffect(() => {
    if (activeChat && userId) {
      setMessages([]);
      setReplyingTo(null);
      setGroupDetails(null);
      setGroupTypingUsers(new Set());
      setIsBlockedByMe(false);
      setIsBlockedByThem(false);
      setCurrentView('chat');

      if (String(activeChat).startsWith('group:')) {
        socket.emit('loadGroup', activeChat);
        return;
      }

      socket.emit('loadConversation', activeChat);
      socket.emit('check_user_status', activeChat);

      // Fast HTTP fetch for past messages
      chatApi.getChatHistory(userId, activeChat)
        .then((data) => {
          if (data && data.success && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        })
        .catch(() => { });

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

  // 1. Initiate Outgoing Call (Voice / Video with Agora RTC)
  const handleStartCall = async (callType, targetPeer = null) => {
    const peer = targetPeer || activeChat;
    if (!peer) return;
    const isGroupCall = String(peer).startsWith('group:');
    const groupId = isGroupCall ? String(peer).replace(/^group:/, '') : null;

    if (targetPeer && targetPeer !== activeChat) {
      setActiveChat(targetPeer);
    }

    // Generate unique Agora channel name for this call session
    const cleanPeer = isGroupCall ? `group_${groupId}` : peer.replace(/\D/g, '');
    const cleanSelf = String(userId || '').replace(/\D/g, '');
    const channelName = `call_${cleanSelf}_${cleanPeer}_${Date.now()}`;

    startOutgoingDialTone();

    // Signal incoming call to remote peer via Socket.IO
    if (isGroupCall) {
      socket.emit('group_call_user', {
        groupId,
        callerName: currentUser?.name || userId,
        callerAvatar: currentUser?.avatar || null,
        callType,
        channelName
      });
    } else {
      socket.emit('call_user', {
        to: peer,
        callerName: currentUser?.name || userId,
        callerAvatar: currentUser?.avatar || null,
        callType,
        channelName
      });
    }

    // Reset call participants list - local user is always represented via isSelf in CallModal
    setCallParticipants([]);

    // Pre-populate user metadata
    callUserMetadataRef.current.clear();
    callUserMetadataRef.current.set(String(userId), {
      userId,
      name: currentUser?.name || currentUser?.fullPhone || 'You',
      avatar: currentUser?.avatar || null
    });
    if (isGroupCall && groupDetails?.members) {
      groupDetails.members.forEach((m) => {
        const mId = m.userId || m.fullPhone || m.id;
        if (mId) {
          callUserMetadataRef.current.set(String(mId), {
            userId: mId,
            name: m.name || m.fullPhone || mId,
            avatar: m.avatar || null
          });
        }
      });
    }

    setCallState({
      isIncoming: false,
      isAccepted: false,
      isRinging: false,
      callType,
      channelName,
      peerId: peer,
      groupId,
      peerName: isGroupCall ? (groupDetails?.name || 'Group') : ((targetPeer && targetPeer === peer ? targetPeer : recipientProfile?.name) || peer),
      peerAvatar: recipientProfile?.avatar || null
    });

    try {
      // Fetch dynamic RTC Token from Backend
      const tokenRes = await agoraApi.getToken(channelName);
      const appId = tokenRes?.appId || import.meta.env.VITE_AGORA_APP_ID;
      const token = tokenRes?.token;

      if (appId && token) {
        // Join Agora RTC Channel & Publish Camera/Mic Tracks
        const { uid: joinedUid, localVideoTrack: lvTrack } = await agoraService.joinChannel({
          appId,
          channelName,
          token,
          callType,
          onVolumeIndicator: (volumes) => {
            const volMap = {};
            if (Array.isArray(volumes)) {
              volumes.forEach((v) => {
                volMap[v.uid] = v.level;
                if (v.uid === 0) volMap['self'] = v.level;
              });
            }
            setSpeakingVolumes(volMap);
          },
          onUserJoined: (user) => {
            console.log('[Agora] Remote user joined channel:', user.uid);
            setCallParticipants((prev) => {
              const strUid = String(user.uid);
              const meta = callUserMetadataRef.current.get(strUid) ||
                (groupDetails?.members?.find((m) => String(m.userId).replace(/\D/g, '') === strUid.replace(/\D/g, '')));
              const existingIndex = prev.findIndex((p) => String(p.agoraUid || p.uid) === strUid);
              const participantObj = {
                uid: user.uid,
                agoraUid: user.uid,
                userId: meta?.userId || strUid,
                name: meta?.name || meta?.profileName || `Participant ${user.uid}`,
                avatar: meta?.avatar || null,
                isSelf: false,
                isMuted: false,
                volume: 0
              };
              if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = { ...next[existingIndex], ...participantObj };
                return next;
              }
              return [...prev, participantObj];
            });
          },
          onRemoteUserPublished: (user, mediaType) => {
            if (mediaType === 'video' && user.videoTrack) {
              setRemoteVideoTrack(user.videoTrack);
              setRemoteVideoTracks((prev) => ({
                ...prev,
                [user.uid]: user.videoTrack,
                [String(user.uid)]: user.videoTrack
              }));
            }
            setCallParticipants((prev) => {
              const strUid = String(user.uid);
              const meta = callUserMetadataRef.current.get(strUid) ||
                (groupDetails?.members?.find((m) => String(m.userId).replace(/\D/g, '') === strUid.replace(/\D/g, '')));
              const existingIndex = prev.findIndex((p) => String(p.agoraUid || p.uid) === strUid);
              const participantObj = {
                uid: user.uid,
                agoraUid: user.uid,
                userId: meta?.userId || strUid,
                name: meta?.name || meta?.profileName || `Participant ${user.uid}`,
                avatar: meta?.avatar || null,
                isSelf: false,
                isMuted: false,
                volume: 0
              };
              if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = { ...next[existingIndex], ...participantObj };
                return next;
              }
              return [...prev, participantObj];
            });
          },
          onRemoteUserUnpublished: (user, mediaType) => {
            if (mediaType === 'video') {
              setRemoteVideoTrack((prev) => (prev === user.videoTrack ? null : prev));
              setRemoteVideoTracks((prev) => {
                const next = { ...prev };
                delete next[user.uid];
                delete next[String(user.uid)];
                return next;
              });
            }
          },
          onUserLeft: (user) => {
            console.log('[Agora] Remote user left call:', user);
            setRemoteVideoTracks((prev) => {
              const next = { ...prev };
              delete next[user.uid];
              delete next[String(user.uid)];
              return next;
            });
            setCallParticipants((prev) => {
              const remaining = prev.filter((p) => String(p.agoraUid || p.uid) !== String(user.uid));
              if (callStateRef.current?.isAccepted && remaining.length === 0 && !isEndingCallRef.current) {
                console.log('[Agora] Only 1 active participant remaining, auto ending call');
                isEndingCallRef.current = true;
                setTimeout(() => {
                  handleEndCall();
                }, 250);
              }
              return remaining;
            });
            if (!isGroupCall) {
              cleanupCall();
            }
          }
        });

        if (isGroupCall && joinedUid) {
          socket.emit('group_call_user_joined', {
            groupId,
            channelName,
            agoraUid: joinedUid,
            userName: currentUser?.name || userId,
            userAvatar: currentUser?.avatar || null
          });
        }

        setLocalVideoTrack(lvTrack || null);
      }
    } catch (err) {
      console.warn('[Agora] Outgoing media setup notice:', err.message);
    }
  };

  // 2. Accept Incoming Call (Agora RTC)
  const handleAcceptCall = async () => {
    if (!callState || !callState.peerId) return;
    stopCallSounds();

    const channelName = callState.channelName;
    if (!channelName) {
      console.error('Channel name is missing for this call');
      handleRejectCall();
      return;
    }

    // Immediately update call state to accepted
    setCallState((prev) => (prev ? { ...prev, isAccepted: true, isRinging: false } : null));

    // Reset callParticipants so only actual joined Agora remote users are in the list
    setCallParticipants([]);

    // Populate metadata
    callUserMetadataRef.current.clear();
    callUserMetadataRef.current.set(String(userId), {
      userId,
      name: currentUser?.name || currentUser?.fullPhone || 'You',
      avatar: currentUser?.avatar || null
    });
    if (callState.callerId) {
      callUserMetadataRef.current.set(String(callState.callerId), {
        userId: callState.callerId,
        name: callState.callerName || callState.callerId,
        avatar: callState.peerAvatar || null
      });
    }
    if (callState.groupId && groupDetails?.members) {
      groupDetails.members.forEach((m) => {
        const mId = m.userId || m.fullPhone || m.id;
        if (mId) {
          callUserMetadataRef.current.set(String(mId), {
            userId: mId,
            name: m.name || m.fullPhone || mId,
            avatar: m.avatar || null
          });
        }
      });
    }

    try {
      // Fetch dynamic RTC Token from Backend
      const tokenRes = await agoraApi.getToken(channelName);
      const appId = tokenRes?.appId || import.meta.env.VITE_AGORA_APP_ID;
      const token = tokenRes?.token;

      if (appId && token) {
        // Join Agora RTC Channel & Publish Camera/Mic Tracks
        const { uid: joinedUid, localVideoTrack: lvTrack } = await agoraService.joinChannel({
          appId,
          channelName,
          token,
          callType: callState.callType,
          onVolumeIndicator: (volumes) => {
            const volMap = {};
            if (Array.isArray(volumes)) {
              volumes.forEach((v) => {
                volMap[v.uid] = v.level;
                if (v.uid === 0) volMap['self'] = v.level;
              });
            }
            setSpeakingVolumes(volMap);
          },
          onUserJoined: (user) => {
            console.log('[Agora] Remote user joined channel:', user.uid);
            setCallParticipants((prev) => {
              const strUid = String(user.uid);
              const meta = callUserMetadataRef.current.get(strUid) ||
                (groupDetails?.members?.find((m) => String(m.userId).replace(/\D/g, '') === strUid.replace(/\D/g, '')));
              const existingIndex = prev.findIndex((p) => String(p.agoraUid || p.uid) === strUid);
              const participantObj = {
                uid: user.uid,
                agoraUid: user.uid,
                userId: meta?.userId || strUid,
                name: meta?.name || meta?.profileName || `Participant ${user.uid}`,
                avatar: meta?.avatar || null,
                isSelf: false,
                isMuted: false,
                volume: 0
              };
              if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = { ...next[existingIndex], ...participantObj };
                return next;
              }
              return [...prev, participantObj];
            });
          },
          onRemoteUserPublished: (user, mediaType) => {
            if (mediaType === 'video' && user.videoTrack) {
              setRemoteVideoTrack(user.videoTrack);
              setRemoteVideoTracks((prev) => ({
                ...prev,
                [user.uid]: user.videoTrack,
                [String(user.uid)]: user.videoTrack
              }));
            }
            setCallParticipants((prev) => {
              const strUid = String(user.uid);
              const meta = callUserMetadataRef.current.get(strUid) ||
                (groupDetails?.members?.find((m) => String(m.userId).replace(/\D/g, '') === strUid.replace(/\D/g, '')));
              const existingIndex = prev.findIndex((p) => String(p.agoraUid || p.uid) === strUid);
              const participantObj = {
                uid: user.uid,
                agoraUid: user.uid,
                userId: meta?.userId || strUid,
                name: meta?.name || meta?.profileName || `Participant ${user.uid}`,
                avatar: meta?.avatar || null,
                isSelf: false,
                isMuted: false,
                volume: 0
              };
              if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = { ...next[existingIndex], ...participantObj };
                return next;
              }
              return [...prev, participantObj];
            });
          },
          onRemoteUserUnpublished: (user, mediaType) => {
            if (mediaType === 'video') {
              setRemoteVideoTrack((prev) => (prev === user.videoTrack ? null : prev));
              setRemoteVideoTracks((prev) => {
                const next = { ...prev };
                delete next[user.uid];
                delete next[String(user.uid)];
                return next;
              });
            }
          },
          onUserLeft: (user) => {
            console.log('[Agora] Remote user left call:', user);
            setRemoteVideoTracks((prev) => {
              const next = { ...prev };
              delete next[user.uid];
              delete next[String(user.uid)];
              return next;
            });
            setCallParticipants((prev) => {
              const remaining = prev.filter((p) => String(p.agoraUid || p.uid) !== String(user.uid));
              if (callStateRef.current?.isAccepted && remaining.length === 0 && !isEndingCallRef.current) {
                console.log('[Agora] Only 1 active participant remaining, auto ending call');
                isEndingCallRef.current = true;
                setTimeout(() => {
                  handleEndCall();
                }, 250);
              }
              return remaining;
            });
            if (!callState?.groupId) {
              cleanupCall();
            }
          }
        });

        if (callState.groupId) {
          socket.emit('group_call_response', {
            groupId: callState.groupId,
            channelName,
            accepted: true,
            userName: currentUser?.name || userId,
            userAvatar: currentUser?.avatar || null,
            agoraUid: joinedUid
          });
          socket.emit('group_call_user_joined', {
            groupId: callState.groupId,
            channelName,
            agoraUid: joinedUid,
            userName: currentUser?.name || userId,
            userAvatar: currentUser?.avatar || null
          });
        } else {
          socket.emit('answer_call', { to: callState.peerId, channelName });
        }

        setLocalVideoTrack(lvTrack || null);
      }
    } catch (err) {
      console.warn('[Agora] Incoming media setup notice:', err.message);
    }
  };

  // 3. Reject Incoming Call
  const handleRejectCall = () => {
    if (callState?.peerId) {
      if (callState.groupId) {
        socket.emit('group_call_response', {
          groupId: callState.groupId,
          channelName: callState.channelName,
          accepted: false,
          userName: currentUser?.name || userId
        });
      } else {
        socket.emit('reject_call', {
          to: callState.peerId,
          channelName: callState.channelName,
          reason: 'Declined'
        });
      }
    }
    cleanupCall();
  };

  // 4. End Active Call
  const handleEndCall = () => {
    isEndingCallRef.current = true;
    if (callState?.peerId) {
      if (callState.groupId) {
        socket.emit('group_call_leave', { groupId: callState.groupId, channelName: callState.channelName });
      } else {
        socket.emit('end_call', {
          to: callState.peerId,
          channelName: callState.channelName
        });
      }
    }
    cleanupCall();
  };

  // 5. Mute Audio Control
  const handleToggleMute = (isMuted) => {
    agoraService.toggleAudio(isMuted);
    if (callState?.groupId) {
      socket.emit('group_call_media_status', { groupId: callState.groupId, isMuted, isVideoOff: false });
    } else if (callState?.peerId) {
      socket.emit('call_media_status', { to: callState.peerId, isMuted, isVideoOff: false });
    }
  };

  // 6. Toggle Video Camera Control
  const handleToggleVideo = (isVideoDisabled) => {
    agoraService.toggleVideo(isVideoDisabled);
    if (callState?.groupId) {
      socket.emit('group_call_media_status', { groupId: callState.groupId, isMuted: false, isVideoOff: isVideoDisabled });
    } else if (callState?.peerId) {
      socket.emit('call_media_status', { to: callState.peerId, isMuted: false, isVideoOff: isVideoDisabled });
    }
  };

  // 5. Emit Typing Indicator
  const handleTyping = useCallback(
    (isTyping) => {
      if (activeChat) {
        if (String(activeChat).startsWith('group:')) {
          socket.emit('group_typing', { groupId: activeChat, isTyping });
        } else {
          socket.emit('typing', { to: activeChat, isTyping });
        }
      }
    },
    [activeChat]
  );

  const normalizeChatKey = (value) => {
    if (!value) return '';
    const text = String(value).trim();
    if (text.startsWith('group:')) return `group:${String(text).replace(/^group:/, '')}`;
    return String(text).replace(/\D/g, '');
  };

  const handleDraftChange = useCallback((chatKey, value) => {
    const key = normalizeChatKey(chatKey);
    setDrafts((prev) => {
      const next = { ...prev };
      const draftValue = String(value || '').trim();
      if (!draftValue) {
        delete next[key];
      } else {
        next[key] = draftValue;
      }
      return next;
    });
  }, []);

  const getGroupId = (groupId) => String(groupId || '').replace(/^group:/, '');

  const handleUpdateGroup = async (groupId, changes) => {
    const data = await chatApi.updateGroup(getGroupId(groupId), userId, changes);
    if (data?.group) setGroupDetails(data.group);
  };

  const handleAddGroupMember = async (groupId, memberId) => {
    const data = await chatApi.addGroupMember(getGroupId(groupId), userId, memberId);
    if (data?.group) setGroupDetails(data.group);
  };

  const handleUpdateGroupMemberRole = async (groupId, memberId, role) => {
    const data = await chatApi.updateGroupMemberRole(getGroupId(groupId), userId, memberId, role);
    if (data?.group) setGroupDetails(data.group);
  };

  const handleRemoveGroupMember = async (groupId, memberId) => {
    try {
      const data = await chatApi.removeGroupMember(getGroupId(groupId), userId, memberId);
      if (data?.group) setGroupDetails(data.group);
      setRecentMessageEvent({ type: 'conversation_refresh', timestamp: Date.now() });
    } catch (err) {
      console.error('Failed to remove group member:', err);
    }
  };

  const handleLeaveGroup = async (groupId) => {
    const rawGroupId = getGroupId(groupId);
    try {
      await chatApi.leaveGroup(rawGroupId, userId);
    } catch (err) {
      console.error('Failed to leave group on server:', err);
    } finally {
      socket.emit('leave_group_room', rawGroupId);
      setActiveChat(null);
      setGroupDetails(null);
      setMessages([]);
      setCurrentView('inbox');
      setRecentMessageEvent({ type: 'conversation_refresh', timestamp: Date.now() });
    }
  };

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
    try { localStorage.setItem('wa_active_chat', recipientPhone); } catch { }
    if (userId && recipientPhone) {
      chatApi.markSeen(userId, recipientPhone).catch(() => { });
      socket.emit('mark_seen', { otherUserId: recipientPhone });
    }
  };

  const handleJoinGroupInvite = (groupId, inviteUrl) => {
    if (!groupId || !userId) return;
    const via = inviteUrl && inviteUrl.includes('via=qr') ? 'qr' : 'link';
    chatApi.joinGroupByInvite(groupId, userId, via)
      .then((data) => {
        if (data?.group?.id) {
          if (data.alreadyMember) {
            window.alert(`Already in group: ${data.group.name || 'this group'}`);
          }
          handleSelectChat(`group:${data.group.id}`, { ...data.group, isGroup: true, groupId: data.group.id });
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch((error) => window.alert(error.message || 'Could not join group'));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupId = params.get('joinGroup');
    const via = params.get('via') === 'qr' ? 'qr' : 'link';
    if (!groupId || !userId) return;
    chatApi.joinGroupByInvite(groupId, userId, via)
      .then((data) => {
        if (data?.group?.id) {
          if (data.alreadyMember) {
            window.alert(`Already in group: ${data.group.name || 'this group'}`);
          }
          window.history.replaceState({}, '', window.location.pathname);
          handleSelectChat(`group:${data.group.id}`, { ...data.group, isGroup: true, groupId: data.group.id });
        }
      })
      .catch((error) => window.alert(error.message || 'Could not join group'));
  }, [userId]);

  const isActiveGroup = String(activeChat || '').startsWith('group:');
  const activeGroupMember = groupDetails?.members?.find((member) => (
    String(member.userId) === String(userId) ||
    String(member.fullPhone || '').replace(/^\+/, '') === String(userId).replace(/^\+/, '')
  ));
  const canSendGroupMessages = !isActiveGroup || groupDetails?.messagePermission !== 'admins' || activeGroupMember?.role === 'admin';

  // Back button in 1-on-1 Chat -> Return to ChatList
  const handleBackToChatList = () => {
    socket.emit('close_chat');
    setActiveChat(null);
    setRecipientProfile(null);
    setMessages([]);
    setCurrentView('inbox');
    try { localStorage.removeItem('wa_active_chat'); } catch { }
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

  // Rename Contact / Custom Alias (Only visible to current user)
  const handleRenameContact = async (contactId, customName) => {
    const cleanContact = String(contactId || activeChat || '').trim();
    if (!cleanContact || !userId) return;

    try {
      await chatApi.renameContact(userId, cleanContact, customName);
      socket.emit('rename_contact', { contactId: cleanContact, customName });
      setRecipientProfile((prev) => {
        if (!prev) return prev;
        const newDisplayName = customName || prev.profileName || prev.fullPhone || cleanContact;
        return { ...prev, name: newDisplayName, customName: customName || null };
      });
      setRecentMessageEvent({ type: 'contact_renamed', contactId: cleanContact, customName, timestamp: Date.now() });
    } catch (err) {
      console.error('Failed to rename contact:', err);
      alert(err.message || 'Failed to save contact name');
    }
  };

  // Explicit Logout
  const handleLogout = () => {
    socket.emit('logout');
    socket.emit('close_chat');
    localStorage.removeItem('wa_session');
    localStorage.removeItem('wa_active_chat');
    setCurrentUser(null);
    setActiveChat(null);
    setRecipientProfile(null);
    setMessages([]);
    setCurrentView('inbox');
  };

  // Delete Message Handler
  const handleDeleteMessage = useCallback(
    (messageId, deleteFor = 'everyone') => {
      if (!messageId) return;
      socket.emit('delete_message', {
        messageId,
        deleteFor,
        to: activeChat
      });
    },
    [activeChat]
  );

  // Edit Message Handler
  const handleEditMessage = useCallback(
    (messageId, newText) => {
      if (!messageId || !newText) return;
      socket.emit('edit_message', {
        messageId,
        text: newText,
        to: activeChat
      });
    },
    [activeChat]
  );

  const handlePinMessage = useCallback(
    (messageId, pinned) => {
      if (!messageId || !activeChat) return;
      const isGroup = String(activeChat).startsWith('group:');
      socket.emit('pin_message', {
        messageId,
        pinned,
        to: isGroup ? null : activeChat,
        groupId: isGroup ? activeChat : null
      });
    },
    [activeChat]
  );

  // Send Message (Text, Image Media, Voice Note, Location)
  const handleSendMessage = useCallback((to, text, type = 'text', mediaUrl = null, extra = {}) => {
    if (String(to).startsWith('group:')) {
      socket.emit('group_message', {
        groupId: to,
        text,
        type,
        mediaUrl,
        replyToId: extra.replyToId || null,
        replyToText: extra.replyToText || null,
        replyToSender: extra.replyToSender || null,
        mentions: extra.mentions || []
      });
      return;
    }
    socket.emit('message', {
      to,
      text,
      type,
      mediaUrl,
      replyToId: extra.replyToId || null,
      replyToText: extra.replyToText || null,
      replyToSender: extra.replyToSender || null
    });
  }, []);

  const handleReactMessage = useCallback((messageId, emoji) => {
    if (String(activeChat || '').startsWith('group:')) {
      socket.emit('group_reaction', { groupId: activeChat, messageId, emoji });
    } else {
      socket.emit('message_reaction', { to: activeChat, messageId, emoji });
    }
  }, [activeChat]);

  return (
    <div className={`wa-app-root ${currentUser ? 'is-logged-in' : 'is-logged-out'}`} style={themes[theme]}>
      {/* Background Top Strip for Desktop/Web */}
      <div className="wa-web-top-strip"></div>

      {/* Minimized Floating Call Bar/Pill (Active in background) */}
      {callState && isCallMinimized && (
        <div
          className="wa-floating-call-pill"
          onClick={() => setIsCallMinimized(false)}
          title="Click to return to call"
        >
          <div className="wa-call-pill-pulse" />
          <div className="wa-call-pill-icon">
            <i className={`fa-solid ${callState.callType === 'video' ? 'fa-video' : 'fa-phone'}`} />
          </div>
          <div className="wa-call-pill-info">
            <span className="wa-call-pill-title">{callState.peerName || callState.peerId || 'In Call'}</span>
            <span className="wa-call-pill-sub">Tap to open call</span>
          </div>
          <button
            type="button"
            className="wa-call-pill-btn expand"
            onClick={(e) => {
              e.stopPropagation();
              setIsCallMinimized(false);
            }}
            title="Expand call screen"
          >
            <i className="fa-solid fa-up-right-and-down-left-from-center" />
          </button>
          <button
            type="button"
            className="wa-call-pill-btn hangup"
            onClick={(e) => {
              e.stopPropagation();
              handleEndCall();
            }}
            title="End call"
          >
            <i className="fa-solid fa-phone-slash" />
          </button>
        </div>
      )}

      {/* Call Modal / Overlay (Active, Incoming, Video, Voice - Agora RTC) */}
      {callState && !isCallMinimized && (
        <CallModal
          callState={callState}
          onAcceptCall={handleAcceptCall}
          onRejectCall={handleRejectCall}
          onEndCall={handleEndCall}
          onMinimize={() => setIsCallMinimized(true)}
          localVideoTrack={localVideoTrack}
          remoteVideoTrack={remoteVideoTrack}
          remoteVideoTracks={remoteVideoTracks}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          participants={callParticipants}
          speakingVolumes={speakingVolumes}
          currentUserId={userId}
          currentUser={currentUser}
        />
      )}

      {/* 1. SCREEN 1: LOGIN / OTP (If not logged in) */}
      {!currentUser ? (
        <JoinModal onJoin={handleLoginSuccess} isConnected={isConnected} theme={theme} themeVars={themes[theme]} onThemeChange={handleThemeChange} />
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
                onDeleteChat={handleBackToChatList}
                onOpenProfile={handleOpenProfile}
                onLogout={handleLogout}
                onStartCall={handleStartCall}
                callLogsTrigger={callLogsTrigger}
                recentMessages={recentMessageEvent}
                drafts={drafts}
                theme={theme}
                onThemeChange={handleThemeChange}
                onJoinGroupInvite={handleJoinGroupInvite}
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
                  recipientProfile={recipientProfile}
                  recipientAvatar={recipientProfile?.avatar}
                  recipientAbout={recipientProfile?.about}
                  isRecipientOnline={isRecipientOnline}
                  isConnected={isConnected}
                  isTyping={isRecipientTyping}
                  onlineUsers={onlineUsers}
                  isBlockedByMe={isBlockedByMe}
                  isBlockedByThem={isBlockedByThem}
                  onStartCall={handleStartCall}
                  onBack={handleBackToChatList}
                  onBlock={handleBlockUser}
                  onUnblock={handleUnblockUser}
                  onRenameContact={handleRenameContact}
                  isGroup={String(activeChat).startsWith('group:')}
                  groupDetails={groupDetails}
                  onUpdateGroup={handleUpdateGroup}
                  onAddGroupMember={handleAddGroupMember}
                  onUpdateGroupMemberRole={handleUpdateGroupMemberRole}
                  onRemoveGroupMember={handleRemoveGroupMember}
                  onLeaveGroup={handleLeaveGroup}
                />

                <MessageList
                  messages={messages}
                  currentUserId={userId}
                  currentUserAvatar={currentUser?.avatar}
                  recipientAvatar={recipientProfile?.avatar}
                  recipientId={activeChat}
                  onDeleteMessage={handleDeleteMessage}
                  onEditMessage={handleEditMessage}
                  onPinMessage={handlePinMessage}
                  isGroup={String(activeChat).startsWith('group:')}
                  groupDetails={groupDetails}
                  onReactMessage={handleReactMessage}
                  onReplyMessage={setReplyingTo}
                />

                <MessageInput
                  recipientId={activeChat}
                  onRecipientChange={setActiveChat}
                  onSendMessage={handleSendMessage}
                  onTyping={handleTyping}
                  isBlockedByMe={isBlockedByMe}
                  isBlockedByThem={isBlockedByThem}
                  onUnblock={handleUnblockUser}
                  groupId={String(activeChat).startsWith('group:') ? activeChat : null}
                  groupMembers={groupDetails?.members || []}
                  canSendMessages={canSendGroupMessages}
                  replyTo={replyingTo}
                  onClearReply={() => setReplyingTo(null)}
                  onDraftChange={handleDraftChange}
                  draftValue={drafts[normalizeChatKey(activeChat)] || ''}
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

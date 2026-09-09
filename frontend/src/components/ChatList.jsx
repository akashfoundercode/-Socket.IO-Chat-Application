import React, { useState, useEffect, useRef } from 'react';
import { chatApi, callApi } from '../services/api';
import { socket } from '../socket/socket';
import StatusTab from './StatusTab';
import QrScanner from 'qr-scanner';
import Avatar from './Avatar';

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
  onDeleteChat,
  onOpenProfile,
  onLogout,
  onStartCall,
  callLogsTrigger,
  recentMessages,
  drafts = {},
  theme = 'orange',
  onThemeChange,
  onJoinGroupInvite
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const groupAvatarInputRef = useRef(null);
  const [groupMemberQuery, setGroupMemberQuery] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupMemberResults, setGroupMemberResults] = useState([]);
  const [isSearchingGroupMembers, setIsSearchingGroupMembers] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const conversationsOwnerRef = useRef('');
  const menuRef = useRef(null);
  const qrVideoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const qrFileInputRef = useRef(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScanError, setQrScanError] = useState('');

  const confirmQrJoin = (scannedUrl) => {
    const url = new URL(scannedUrl);
    const groupId = url.searchParams.get('joinGroup');
    const groupName = url.searchParams.get('groupName') || 'this group';
    if (!groupId) throw new Error('Invalid invite');

    setShowQrScanner(false);
    const shouldJoin = window.confirm(`Join group "${groupName}"?\n\nPress OK to join this group.`);
    if (shouldJoin) {
      onJoinGroupInvite?.(groupId, scannedUrl);
    }
  };

  useEffect(() => {
    if (!showQrScanner || !qrVideoRef.current) return undefined;
    const scanner = new QrScanner(qrVideoRef.current, (result) => {
      const scannedUrl = typeof result === 'string' ? result : result?.data;
      try {
        confirmQrJoin(scannedUrl);
      } catch {
        setQrScanError('This QR is not a valid group invitation.');
      }
    }, { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true });
    qrScannerRef.current = scanner;
    scanner.start().catch(() => setQrScanError('Camera permission is required.'));
    return () => {
      scanner.stop();
      scanner.destroy();
      qrScannerRef.current = null;
    };
  }, [showQrScanner, onJoinGroupInvite]);

  const handleQrImageScan = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setQrScanError('');
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      const scannedUrl = typeof result === 'string' ? result : result?.data;
      confirmQrJoin(scannedUrl);
    } catch {
      setQrScanError('This QR is not a valid group invitation.');
    }
    event.target.value = '';
  };

  // Call Logs state
  const [callLogs, setCallLogs] = useState([]);
  const [callLogsLoading, setCallLogsLoading] = useState(false);

  // Swipe-to-Delete state
  const [swipedId, setSwipedId] = useState(null);
  const [dragState, setDragState] = useState({
    id: null,
    startX: 0,
    startY: 0,
    currentOffset: 0,
    isDragging: false,
    isHorizontal: false
  });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    item: null,
    isDeleting: false
  });

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

  const sortConversationsByRecent = (items = []) => {
    return [...items].sort((a, b) => {
      const aTime = a?.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b?.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
  };

  // 1. Fetch active conversations
  const fetchConversations = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [data, groupData] = await Promise.all([
        chatApi.getConversations(userId),
        chatApi.getGroups(userId).catch(() => ({ groups: [] }))
      ]);
      if (data && data.success && Array.isArray(data.conversations)) {
        const seen = new Set();
        const unique = [];
        const activeKey = activeChat ? String(activeChat).replace(/\D/g, '') : '';
        data.conversations.forEach((c) => {
          const key = (c.fullPhone || c.phone || c.id || '').replace(/\D/g, '');
          if (!seen.has(key)) {
            seen.add(key);
            if (activeKey && key === activeKey) {
              unique.push({ ...c, unreadCount: 0 });
            } else {
              unique.push(c);
            }
          }
        });
        const groups = Array.isArray(groupData?.groups) ? groupData.groups : [];
        const latestConversations = sortConversationsByRecent([...groups, ...unique]);
        setConversations((previous) => {
          if (conversationsOwnerRef.current !== userId) {
            conversationsOwnerRef.current = userId;
            return latestConversations;
          }

          const latestKeys = new Set(latestConversations.map((conversation) => {
            if (conversation.isGroup) return String(conversation.id);
            return String(conversation.fullPhone || conversation.phone || conversation.id || '').replace(/\D/g, '');
          }));
          const previouslyVisible = previous.filter((conversation) => {
            const key = conversation.isGroup
              ? String(conversation.id)
              : String(conversation.fullPhone || conversation.phone || conversation.id || '').replace(/\D/g, '');
            return key && !latestKeys.has(key);
          });
          return sortConversationsByRecent([...latestConversations, ...previouslyVisible]);
        });
      } else {
        setConversations((previous) => previous);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations((previous) => previous);
    } finally {
      setLoading(false);
    }
  };

  // Helper to open chat and immediately clear unread badge
  const handleSelectUser = (phoneDisplay, item = null) => {
    if (!phoneDisplay) return;
    setSearchQuery('');
    setSearchResults([]);
    const isGroup = Boolean(item?.isGroup || String(phoneDisplay).startsWith('group:'));
    if (isGroup) {
      const cleanGroupId = String(phoneDisplay).replace(/^group:/, '');
      setConversations((prev) =>
        prev.map((c) => {
          if (c.isGroup && (String(c.id) === String(phoneDisplay) || String(c.groupId) === cleanGroupId)) {
            return { ...c, unreadCount: 0 };
          }
          return c;
        })
      );
      if (userId) {
        chatApi.markGroupSeen(cleanGroupId, userId).catch(() => { });
        socket.emit('mark_group_seen', { groupId: cleanGroupId });
      }
      onSelectChat?.(phoneDisplay, item);
      return;
    }
    const cleanTarget = String(phoneDisplay).replace(/\D/g, '');

    // 1. Optimistically clear unread count immediately from conversation list
    setConversations((prev) =>
      prev.map((c) => {
        const cKey = (c.fullPhone || c.phone || c.id || '').replace(/\D/g, '');
        if (
          (cKey && cleanTarget && cKey === cleanTarget) ||
          c.id === item?.id ||
          c.fullPhone === phoneDisplay ||
          c.phone === phoneDisplay
        ) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      })
    );

    // 2. Mark seen in database and notify socket server
    if (userId) {
      chatApi.markSeen(userId, phoneDisplay).catch(() => { });
      socket.emit('mark_seen', { otherUserId: phoneDisplay });
    }

    // 3. Trigger parent onSelectChat
    if (onSelectChat) {
      onSelectChat(phoneDisplay, item);
    }
  };

  const handleGroupAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setGroupAvatar(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const memberIds = selectedGroupMembers.map((member) => member.fullPhone || member.phone || member.id);
    if (!groupName.trim() || memberIds.length === 0) {
      setModalError('Group name and at least one member are required');
      return;
    }
    setCreatingGroup(true);
    setModalError('');
    try {
      const data = await chatApi.createGroup(userId, groupName.trim(), memberIds, groupAvatar);
      const group = data.group;
      setShowGroupModal(false);
      setGroupName('');
      setGroupAvatar(null);
      setGroupMemberQuery('');
      setSelectedGroupMembers([]);
      setGroupMemberResults([]);
      if (group) {
        const groupItem = {
          ...group,
          id: `group:${group.id}`,
          groupId: group.id,
          name: group.name,
          avatar: group.avatar || groupAvatar || null,
          isGroup: true,
          unreadCount: 0,
          lastMessage: null
        };
        setConversations((prev) => sortConversationsByRecent([
          groupItem,
          ...prev.filter((c) => String(c.id) !== String(groupItem.id) && String(c.groupId) !== String(group.id))
        ]));
        socket.emit('join_group_room', group.id);
        handleSelectUser(`group:${group.id}`, groupItem);
      }
      fetchConversations();
    } catch (err) {
      setModalError(err.message || 'Could not create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Clear unread count when activeChat changes
  useEffect(() => {
    if (activeChat) {
      const isGroup = String(activeChat).startsWith('group:');
      const cleanGroupId = isGroup ? String(activeChat).replace(/^group:/, '') : '';
      const activeKey = String(activeChat).replace(/\D/g, '');
      setConversations((prev) =>
        prev.map((c) => {
          if (isGroup) {
            if (c.isGroup && (String(c.id) === String(activeChat) || String(c.groupId) === cleanGroupId)) {
              return { ...c, unreadCount: 0 };
            }
          } else {
            const cKey = (c.fullPhone || c.phone || c.id || '').replace(/\D/g, '');
            if (cKey && activeKey && cKey === activeKey && (c.unreadCount || 0) > 0) {
              return { ...c, unreadCount: 0 };
            }
          }
          return c;
        })
      );
    }
  }, [activeChat]);

  // Fetch Call Logs
  const fetchCallLogs = async () => {
    if (!userId) return;
    try {
      setCallLogsLoading(true);
      const data = await callApi.getCallLogs(userId);
      if (data && data.success && Array.isArray(data.calls)) {
        setCallLogs(data.calls);
      } else {
        setCallLogs([]);
      }
    } catch (err) {
      console.error('Failed to load call logs:', err);
    } finally {
      setCallLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => fetchConversations();
    const handleGroupCreated = ({ group }) => {
      if (group && group.id) {
        socket.emit('join_group_room', group.id);
        const groupItem = {
          ...group,
          id: `group:${group.id}`,
          groupId: group.id,
          name: group.name,
          isGroup: true,
          unreadCount: 0,
          lastMessage: null
        };
        setConversations((prev) => sortConversationsByRecent([
          groupItem,
          ...prev.filter((c) => String(c.id) !== String(groupItem.id) && String(c.groupId) !== String(group.id))
        ]));
      }
      fetchConversations();
    };
    const handleGroupDetails = (group) => {
      if (!group?.id) return;
      const groupId = String(group.id).replace(/^group:/, '');
      setConversations((prev) => sortConversationsByRecent(prev.map((conversation) => (
        conversation.isGroup && String(conversation.groupId || conversation.id).replace(/^group:/, '') === groupId
          ? { ...conversation, ...group, id: `group:${groupId}`, groupId, isGroup: true }
          : conversation
      ))));
      fetchConversations();
    };
    const onSeen = ({ seenBy, conversationWith }) => {
      const key = String(seenBy || conversationWith || '').replace(/\D/g, '');
      if (key) {
        setConversations((prev) =>
          prev.map((c) => {
            const cKey = (c.fullPhone || c.phone || c.id || '').replace(/\D/g, '');
            if (cKey === key) {
              return { ...c, unreadCount: 0 };
            }
            return c;
          })
        );
      }
    };
    socket.on('message_received', refresh);
    socket.on('message_saved', refresh);
    socket.on('group_created', handleGroupCreated);
    socket.on('group_details', handleGroupDetails);
    socket.on('group_message_received', refresh);
    socket.on('conversation_refresh', refresh);
    socket.on('messages_seen', onSeen);
    return () => {
      socket.off('message_received', refresh);
      socket.off('message_saved', refresh);
      socket.off('group_created', handleGroupCreated);
      socket.off('group_details', handleGroupDetails);
      socket.off('group_message_received', refresh);
      socket.off('conversation_refresh', refresh);
      socket.off('messages_seen', onSeen);
    };
  }, [userId, activeChat]);

  useEffect(() => {
    if (userId) {
      fetchCallLogs();
    }
  }, [userId, callLogsTrigger, activeTab]);

  const handleDeleteCallLog = async (callId) => {
    if (!callId || !userId) return;
    try {
      await callApi.deleteCallLog(callId, userId);
      setCallLogs((prev) => prev.filter((c) => c.id !== callId));
    } catch (err) {
      console.error('Failed to delete call log:', err);
    }
  };

  const handleClearCallLogs = async () => {
    if (!userId || !window.confirm('Clear all call history logs?')) return;
    try {
      await callApi.clearCallLogs(userId);
      setCallLogs([]);
    } catch (err) {
      console.error('Failed to clear call logs:', err);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatCallTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const missedCallsCount = callLogs.filter(
    (c) => c.direction === 'missed' || c.rawStatus === 'missed'
  ).length;

  // Close any swiped item when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (!e.target.closest('.wa-swipe-item-container') && !e.target.closest('.wa-delete-chat-modal')) {
        setSwipedId(null);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('touchstart', handleGlobalClick);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('touchstart', handleGlobalClick);
    };
  }, []);

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

  useEffect(() => {
    const trimmed = groupMemberQuery.trim();
    if (!showGroupModal || !trimmed) {
      setGroupMemberResults([]);
      setIsSearchingGroupMembers(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingGroupMembers(true);
      try {
        const data = await chatApi.searchUsers(trimmed, userId);
        const selectedIds = new Set(selectedGroupMembers.map((member) => String(member.id)));
        setGroupMemberResults((data?.users || []).filter((member) => !selectedIds.has(String(member.id))));
      } catch (error) {
        setGroupMemberResults([]);
      } finally {
        setIsSearchingGroupMembers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [groupMemberQuery, showGroupModal, userId, selectedGroupMembers]);

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
      handleSelectUser(fullPhone);
    } catch (err) {
      setModalError(err.message || 'Could not start chat');
    } finally {
      setAddingContact(false);
    }
  };

  // 4. Swipe Gestures Handling (Touch & Mouse Drag)
  const handleTouchStart = (e, item) => {
    const touch = e.touches[0];
    const isCurrentlySwiped = swipedId === item.id;
    if (swipedId && swipedId !== item.id) {
      setSwipedId(null);
    }
    setDragState({
      id: item.id,
      startX: touch.clientX,
      startY: touch.clientY,
      currentOffset: isCurrentlySwiped ? -80 : 0,
      isDragging: true,
      isHorizontal: false
    });
  };

  const handleTouchMove = (e, item) => {
    if (!dragState.isDragging || dragState.id !== item.id) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - dragState.startX;
    const diffY = touch.clientY - dragState.startY;

    if (!dragState.isHorizontal) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 6) {
        setDragState((prev) => ({ ...prev, isHorizontal: true }));
      } else if (Math.abs(diffY) > 8) {
        setDragState((prev) => ({ ...prev, isDragging: false }));
        return;
      }
    }

    if (dragState.isHorizontal) {
      const base = swipedId === item.id ? -80 : 0;
      const rawOffset = base + diffX;
      // Clamp between -100px and 0px
      const clamped = Math.min(0, Math.max(-100, rawOffset));
      setDragState((prev) => ({ ...prev, currentOffset: clamped }));
    }
  };

  const handleTouchEnd = (e, item) => {
    if (dragState.id !== item.id) return;
    if (dragState.isHorizontal) {
      if (dragState.currentOffset < -40) {
        setSwipedId(item.id);
      } else {
        setSwipedId(null);
      }
    }
    setDragState({
      id: null,
      startX: 0,
      startY: 0,
      currentOffset: 0,
      isDragging: false,
      isHorizontal: false
    });
  };

  // Toggle slide manually on desktop / button click
  const handleToggleSwipe = (e, item) => {
    e.stopPropagation();
    if (swipedId === item.id) {
      setSwipedId(null);
    } else {
      setSwipedId(item.id);
    }
  };

  // Delete Conversation Flow
  const handleOpenDeleteModal = (e, item) => {
    e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      item,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.item || !userId) return;
    const item = deleteModal.item;
    const targetPhone = item.fullPhone || item.phone || item.id;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      // 1. API Call
      await chatApi.deleteConversation(targetPhone, userId);

      // 2. Socket Event
      socket.emit('delete_conversation', { otherUserId: targetPhone });

      // 3. Optimistic Local State Update
      setConversations((prev) =>
        prev.filter((c) => c.id !== item.id && c.fullPhone !== targetPhone && c.phone !== targetPhone)
      );

      // 4. Notify parent if active chat was deleted
      if (
        activeChat &&
        (activeChat === targetPhone ||
          activeChat === String(targetPhone).replace(/^\+/, '') ||
          activeChat === `+${String(targetPhone).replace(/^\+/, '')}` ||
          activeChat === item.id)
      ) {
        if (onDeleteChat) {
          onDeleteChat(targetPhone);
        }
      }

      setSwipedId(null);
      setDeleteModal({ isOpen: false, item: null, isDeleting: false });
    } catch (err) {
      console.error('Failed to delete chat:', err);
      alert(err.message || 'Could not delete conversation');
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const normalizeConversationKey = (value) => {
    if (!value) return '';
    const text = String(value).trim();
    if (text.startsWith('group:')) return `group:${String(text).replace(/^group:/, '')}`;
    return String(text).replace(/\D/g, '');
  };

  const getDraftForConversation = (item) => {
    if (!item) return '';
    const key = item.isGroup ? `group:${String(item.id || item.groupId || '').replace(/^group:/, '')}` : normalizeConversationKey(item.fullPhone || item.phone || item.id || '');
    return drafts[key] || '';
  };

  const orderedConversations = [...conversations].sort((a, b) => {
    const aDraft = getDraftForConversation(a);
    const bDraft = getDraftForConversation(b);
    if (aDraft && !bDraft) return -1;
    if (!aDraft && bDraft) return 1;
    const aTime = a?.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b?.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });

  const visibleConversations = activeTab === 'groups'
    ? orderedConversations.filter((item) => item.isGroup)
    : orderedConversations;

  const existingConversationKeys = React.useMemo(() => {
    const set = new Set();
    conversations.forEach((c) => {
      if (c.id) set.add(String(c.id).toLowerCase());
      if (c.phone) set.add(String(c.phone).toLowerCase());
      if (c.fullPhone) set.add(String(c.fullPhone).toLowerCase());
      const clean = (c.fullPhone || c.phone || c.id || '').replace(/\D/g, '');
      if (clean) {
        set.add(clean);
        if (clean.length === 12 && clean.startsWith('91')) {
          set.add(clean.slice(2));
        } else if (clean.length === 10) {
          set.add(`91${clean}`);
        }
      }
    });
    return set;
  }, [conversations]);

  const filteredConversations = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleConversations;
    const cleanQ = q.replace(/\D/g, '');
    return visibleConversations.filter((c) => {
      const phone = String(c.fullPhone || c.phone || c.id || '').toLowerCase();
      const name = String(c.name || '').toLowerCase();
      const cleanPhone = phone.replace(/\D/g, '');
      if (name.includes(q) || phone.includes(q)) return true;
      if (cleanQ && cleanPhone && (cleanPhone.includes(cleanQ) || cleanQ.includes(cleanPhone))) return true;
      return false;
    });
  }, [visibleConversations, searchQuery]);

  const newSearchResults = React.useMemo(() => {
    return searchResults.filter((user) => {
      const rawId = String(user.id || '').toLowerCase();
      const rawPhone = String(user.phone || '').toLowerCase();
      const rawFull = String(user.fullPhone || '').toLowerCase();
      const clean = (user.fullPhone || user.phone || user.id || '').replace(/\D/g, '');

      if (existingConversationKeys.has(rawId)) return false;
      if (rawPhone && existingConversationKeys.has(rawPhone)) return false;
      if (rawFull && existingConversationKeys.has(rawFull)) return false;
      if (clean && existingConversationKeys.has(clean)) return false;
      return true;
    });
  }, [searchResults, existingConversationKeys]);

  const formatConversationPreview = (item, draftText = '') => {
    if (draftText) return `Draft: ${draftText}`;
    if (!item) return '';

    const msgType = item.lastMessageType;
    const rawMsg = item.lastMessage;
    const isGroup = Boolean(item.isGroup);

    if (msgType === 'deleted') return '🚫 This message was deleted';
    if (msgType === 'location') return '📍 Location';
    if (msgType === 'image') return '📷 Photo';
    if (msgType === 'video') return '🎥 Video';
    if (msgType === 'voice' || msgType === 'audio') return '🎤 Voice message';

    // Helper to parse JSON safely if rawMsg is a JSON string or object
    let parsedObj = null;
    if (rawMsg && typeof rawMsg === 'object') {
      parsedObj = rawMsg;
    } else if (typeof rawMsg === 'string' && rawMsg.trim().startsWith('{')) {
      try {
        parsedObj = JSON.parse(rawMsg.trim());
      } catch (e) {
        parsedObj = null;
      }
    }

    // Check if it's a Call message (by type or parsed JSON)
    if (msgType === 'call' || (parsedObj && (parsedObj.callType || parsedObj.joinedCount !== undefined))) {
      const callData = parsedObj || {};
      const isVid = callData.callType === 'video';
      const callIcon = isVid ? '🎥' : '📞';
      const callLabel = isVid ? 'Video call' : 'Voice call';
      if (isGroup) {
        const jCount = Number(callData.joinedCount || (callData.memberNames?.length || 0));
        if (callData.status === 'not_accepted' || callData.status === 'missed' || (jCount <= 1 && callData.status !== 'completed')) {
          return `${callIcon} ${callLabel} • Not accepted`;
        }
        if (jCount > 1) {
          return `${callIcon} ${callLabel} • ${jCount} participants`;
        }
        return `${callIcon} ${callLabel} ended`;
      } else {
        if (callData.status === 'missed') return `${callIcon} Missed ${callLabel.toLowerCase()}`;
        if (callData.status === 'declined') return `${callIcon} ${callLabel} declined`;
        return `${callIcon} ${callLabel} ended`;
      }
    }

    // Check if it's a System message (by type or parsed JSON with action)
    if (msgType === 'system' || (parsedObj && parsedObj.action)) {
      const d = parsedObj || {};
      const action = d.action || '';
      if (action === 'leave_group') return `${d.name || d.userId || 'Someone'} left`;
      if (action === 'add_member') return `${d.actorName || 'Admin'} added ${d.targetName || 'a member'}`;
      if (action === 'remove_member') return `${d.targetName || 'A member'} was removed`;
      if (action === 'create_group') return `Group created`;
      if (action === 'join_link' || action === 'join_qr') return `${d.name || d.userId || 'Someone'} joined`;
      return 'Group updated';
    }

    // Check if it's a Status Reaction
    if (msgType === 'status_reaction' || (parsedObj && parsedObj.reaction)) {
      const emoji = (parsedObj && parsedObj.reaction) || (typeof rawMsg === 'string' ? rawMsg : '❤️');
      return `${emoji} Reacted to status`;
    }

    // Check if it's a Status Reply
    if (msgType === 'status_reply' || (parsedObj && parsedObj.replyText !== undefined)) {
      const reply = (parsedObj && parsedObj.replyText) || (typeof rawMsg === 'string' ? rawMsg : '');
      return reply ? `↩ Status: ${reply}` : '↩ Replied to status';
    }

    // If parsedObj was some other JSON object that wasn't caught, avoid printing raw JSON
    if (parsedObj && typeof parsedObj === 'object') {
      return isGroup ? `${item.memberCount || 0} members` : 'Tap to chat';
    }

    if (typeof rawMsg === 'string' && rawMsg.trim()) {
      return rawMsg;
    }

    return isGroup ? `${item.memberCount || 0} members` : 'Tap to chat';
  };

  const renderConversationItem = (item) => {
    const isGroup = Boolean(item.isGroup);
    const phoneDisplay = item.fullPhone || item.phone || item.id;
    const displayName = item.name || phoneDisplay;
    const isDeletedMsg = item.lastMessageType === 'deleted';
    const isLocationMsg = !isDeletedMsg && item.lastMessageType === 'location';
    const isImageMsg = !isDeletedMsg && item.lastMessageType === 'image';
    const draftText = getDraftForConversation(item);
    const lastMsg = formatConversationPreview(item, draftText);
    const online = !isGroup && isUserOnline(phoneDisplay);
    const isActive =
      activeChat &&
      (activeChat === phoneDisplay ||
        activeChat === item.phone ||
        activeChat === item.fullPhone ||
        activeChat === item.id);
    const time = item.lastMessageAt
      ? new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <div className="wa-swipe-item-container" key={item.id}>
        {/* Swipe Delete Action (revealed on slide left) */}
        <div className="wa-swipe-actions">
          <button
            type="button"
            className="wa-swipe-delete-btn"
            title="Delete Chat"
            onClick={(e) => handleOpenDeleteModal(e, item)}
          >
            <i className="fa-solid fa-trash-can"></i>
            <span>Delete</span>
          </button>
        </div>

        {/* Foreground Sliding Chat Row */}
        <div
          className={`wa-chat-item-row wa-swipeable-row ${isActive ? 'active' : ''} ${swipedId === item.id ? 'is-swiped' : ''
            }`}
          style={{
            transform: `translateX(${dragState.id === item.id
              ? `${dragState.currentOffset}px`
              : swipedId === item.id
                ? '-80px'
                : '0px'
              })`,
            transition:
              dragState.id === item.id && dragState.isDragging
                ? 'none'
                : 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)'
          }}
          onTouchStart={(e) => handleTouchStart(e, item)}
          onTouchMove={(e) => handleTouchMove(e, item)}
          onTouchEnd={(e) => handleTouchEnd(e, item)}
          onClick={() => {
            if (swipedId === item.id) {
              setSwipedId(null);
              return;
            }
            handleSelectUser(phoneDisplay, item);
          }}
        >
          <Avatar
            src={item.avatar}
            isGroup={isGroup}
            name={displayName}
            size={46}
            showOnline={!isGroup && online}
            isOnline={online}
          />
          <div className="wa-item-center">
            <div className="wa-item-top">
              <span className={`wa-item-name ${item.unreadCount > 0 ? 'unread' : ''}`}>{displayName}</span>
              {isGroup && <span className="wa-group-tag">Groups</span>}
              {draftText && <span className="wa-draft-tag">Draft</span>}
              {time && (
                <span className={`wa-item-time ${item.unreadCount > 0 ? 'unread' : ''}`}>{time}</span>
              )}
            </div>
            <div className="wa-item-bottom">
              {isGroup ? (
                <span className="wa-item-msg">{lastMsg || `${item.memberCount || 0} members`}</span>
              ) : isContactTyping(phoneDisplay) ? (
                <span className="wa-item-typing">
                  typing
                  <span className="wa-typing-dots">
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                  </span>
                </span>
              ) : (
                <span className={`wa-item-msg ${item.unreadCount > 0 ? 'unread' : ''}`}>
                  {isLocationMsg && (
                    <i className="fa-solid fa-location-dot" style={{ color: '#f97316', marginRight: '4px' }}></i>
                  )}
                  {isImageMsg && (
                    <i className="fa-solid fa-camera" style={{ color: '#8696a0', marginRight: '4px' }}></i>
                  )}
                  {lastMsg}
                </span>
              )}
              {item.unreadCount > 0 && (
                <span
                  className="wa-unread-badge"
                  title={`${item.unreadCount} new unread message${item.unreadCount > 1 ? 's' : ''}`}
                >
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </span>
              )}
            </div>
          </div>

          {/* Desktop / Touch Slide Trigger Chevron */}
          <div
            className="wa-row-slide-trigger"
            onClick={(e) => handleToggleSwipe(e, item)}
            title="Slide to delete"
          >
            <i className={`fa-solid ${swipedId === item.id ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </div>
        </div>
      </div>
    );
  };

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
          <Avatar
            src={currentUser?.avatar}
            name={currentUser?.name || 'My Profile'}
            size={36}
          />
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
            title="Create Group"
            onClick={() => setShowGroupModal(true)}
          >
            <i className="fa-solid fa-users"></i>
          </button>
          <button
            type="button"
            className="wa-inbox-icon"
            title="Scan Group QR"
            onClick={() => { setQrScanError(''); setShowQrScanner(true); }}
          >
            <i className="fa-solid fa-qrcode"></i>
          </button>
          <input ref={qrFileInputRef} type="file" accept="image/*" onChange={handleQrImageScan} hidden />
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
          <div className="wa-menu-anchor" ref={menuRef}>
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
                    setShowGroupModal(true);
                  }}
                >
                  <i className="fa-solid fa-users"></i> New Group
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
                <div className="wa-theme-picker">
                  <div className="wa-theme-picker-label">Theme</div>
                  <div className="wa-theme-swatches">
                    {[
                      ['green', '#008f72'],
                      ['orange', '#ea580c'],
                      ['blue', '#126782'],
                      ['charcoal', '#334155']
                    ].map(([name, color]) => (
                      <button
                        key={name}
                        type="button"
                        className={`wa-theme-swatch ${theme === name ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        title={`${name} theme`}
                        aria-label={`${name} theme`}
                        onClick={() => onThemeChange?.(name)}
                      />
                    ))}
                  </div>
                </div>
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

      {showQrScanner && (
        <div className="wa-qr-scanner-overlay" onClick={() => setShowQrScanner(false)}>
          <div className="wa-qr-scanner-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Scan group QR</h3>
            <video ref={qrVideoRef} className="wa-qr-scanner-video" muted playsInline />
            {qrScanError && <small className="wa-qr-scan-error">{qrScanError}</small>}
            <button type="button" className="wa-group-invite-btn secondary" onClick={() => qrFileInputRef.current?.click()}>
              <i className="fa-regular fa-image"></i> Upload QR image
            </button>
            <button type="button" className="wa-group-invite-btn secondary" onClick={() => setShowQrScanner(false)}>Close</button>
          </div>
        </div>
      )}

      {/* WhatsApp Tabs Bar */}
      <div className="wa-tabs-bar">
        <button
          type="button"
          className={`wa-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          CHATS
          {conversations.some((c) => (c.unreadCount || 0) > 0) ? (
            <span className="wa-tab-badge unread-pill">
              {conversations.reduce((acc, c) => acc + (Number(c.unreadCount) || 0), 0)}
            </span>
          ) : conversations.length > 0 ? (
            <span className="wa-tab-badge">{conversations.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`wa-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          GROUPS
          {visibleConversations.filter((c) => c.isGroup).length > 0 ? (
            <span className="wa-tab-badge unread-pill">
              {visibleConversations.filter((c) => c.isGroup).length}
            </span>
          ) : null}
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
          {missedCallsCount > 0 ? (
            <span className="wa-tab-badge missed-pill" title={`${missedCallsCount} Missed Call${missedCallsCount > 1 ? 's' : ''}`}>
              {missedCallsCount}
            </span>
          ) : callLogs.length > 0 ? (
            <span className="wa-tab-badge">{callLogs.length}</span>
          ) : null}
        </button>
      </div>

      {/* Search Bar */}
      <div className="wa-search-bar-wrap">
        <div className="wa-search-bar">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            id="chat-search"
            type="text"
            placeholder={activeTab === 'calls' ? "Search call logs..." : "Search mobile number (+91...)"}
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

      {/* Main List Body */}
      <div className="wa-chat-items-list">
        {/* ======================= TAB: GROUPS ======================= */}
        {activeTab === 'groups' ? (
          searchQuery.trim() ? (
            <div className="wa-search-results-section">
              <div className="wa-section-title">
                <span>Group Matches</span>
                {isSearchingDb && <i className="fa-solid fa-circle-notch fa-spin"></i>}
              </div>

              {filteredConversations.length > 0 ? (
                filteredConversations.map((item) => {
                  const isGroup = Boolean(item.isGroup);
                  const phoneDisplay = item.fullPhone || item.phone || item.id;
                  const displayName = item.name || phoneDisplay;
                  const isActive = activeChat && (activeChat === phoneDisplay || activeChat === item.phone || activeChat === item.fullPhone || activeChat === item.id);
                  const time = item.lastMessageAt
                    ? new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div className="wa-swipe-item-container" key={item.id}>
                      <div className="wa-swipe-actions">
                        <button
                          type="button"
                          className="wa-swipe-delete-btn"
                          title="Delete Chat"
                          onClick={(e) => handleOpenDeleteModal(e, item)}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                          <span>Delete</span>
                        </button>
                      </div>

                      <div
                        className={`wa-chat-item-row wa-swipeable-row ${isActive ? 'active' : ''} ${swipedId === item.id ? 'is-swiped' : ''}`}
                        style={{
                          transform: `translateX(${dragState.id === item.id ? `${dragState.currentOffset}px` : swipedId === item.id ? '-80px' : '0px'})`,
                          transition: dragState.id === item.id && dragState.isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)'
                        }}
                        onTouchStart={(e) => handleTouchStart(e, item)}
                        onTouchMove={(e) => handleTouchMove(e, item)}
                        onTouchEnd={(e) => handleTouchEnd(e, item)}
                        onClick={() => {
                          if (swipedId === item.id) {
                            setSwipedId(null);
                            return;
                          }
                          handleSelectUser(phoneDisplay, item);
                        }}
                      >
                        <Avatar
                          src={item.avatar}
                          isGroup={true}
                          name={displayName}
                          size={46}
                        />
                        <div className="wa-item-center">
                          <div className="wa-item-top">
                            <span className={`wa-item-name ${item.unreadCount > 0 ? 'unread' : ''}`}>{displayName}</span>
                            <span className="wa-group-tag">Groups</span>
                            {time && <span className={`wa-item-time ${item.unreadCount > 0 ? 'unread' : ''}`}>{time}</span>}
                          </div>
                          <div className="wa-item-bottom">
                            <span className="wa-item-msg">{formatConversationPreview(item)}</span>
                          </div>
                        </div>
                        <div className="wa-row-slide-trigger" onClick={(e) => handleToggleSwipe(e, item)} title="Options">
                          <i className="fa-solid fa-chevron-left"></i>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="wa-inbox-empty">
                  <div className="wa-empty-icon-circle">
                    <i className="fa-solid fa-users"></i>
                  </div>
                  <h4>No matching groups</h4>
                  <p>Try a different group name or clear the search.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {filteredConversations.length > 0 ? (
                filteredConversations.map((item) => {
                  const isGroup = Boolean(item.isGroup);
                  const phoneDisplay = item.fullPhone || item.phone || item.id;
                  const displayName = item.name || phoneDisplay;
                  const isActive = activeChat && (activeChat === phoneDisplay || activeChat === item.phone || activeChat === item.fullPhone || activeChat === item.id);
                  const time = item.lastMessageAt
                    ? new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div className="wa-swipe-item-container" key={item.id}>
                      <div className="wa-swipe-actions">
                        <button
                          type="button"
                          className="wa-swipe-delete-btn"
                          title="Delete Chat"
                          onClick={(e) => handleOpenDeleteModal(e, item)}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                          <span>Delete</span>
                        </button>
                      </div>

                      <div
                        className={`wa-chat-item-row wa-swipeable-row ${isActive ? 'active' : ''} ${swipedId === item.id ? 'is-swiped' : ''}`}
                        style={{
                          transform: `translateX(${dragState.id === item.id ? `${dragState.currentOffset}px` : swipedId === item.id ? '-80px' : '0px'})`,
                          transition: dragState.id === item.id && dragState.isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)'
                        }}
                        onTouchStart={(e) => handleTouchStart(e, item)}
                        onTouchMove={(e) => handleTouchMove(e, item)}
                        onTouchEnd={(e) => handleTouchEnd(e, item)}
                        onClick={() => {
                          if (swipedId === item.id) {
                            setSwipedId(null);
                            return;
                          }
                          handleSelectUser(phoneDisplay, item);
                        }}
                      >
                        <Avatar
                          src={item.avatar}
                          isGroup={Boolean(item.isGroup)}
                          name={displayName}
                          size={46}
                        />
                        <div className="wa-item-center">
                          <div className="wa-item-top">
                            <span className={`wa-item-name ${item.unreadCount > 0 ? 'unread' : ''}`}>{displayName}</span>
                            <span className="wa-group-tag">Groups</span>
                            {time && <span className={`wa-item-time ${item.unreadCount > 0 ? 'unread' : ''}`}>{time}</span>}
                          </div>
                          <div className="wa-item-bottom">
                            <span className="wa-item-msg">{formatConversationPreview(item)}</span>
                            {item.unreadCount > 0 && (
                              <span className="wa-unread-badge" title={`${item.unreadCount} new unread message${item.unreadCount > 1 ? 's' : ''}`}>
                                {item.unreadCount > 99 ? '99+' : item.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="wa-row-slide-trigger" onClick={(e) => handleToggleSwipe(e, item)} title="Options">
                          <i className="fa-solid fa-chevron-left"></i>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="wa-inbox-empty">
                  <div className="wa-empty-icon-circle">
                    <i className="fa-solid fa-users"></i>
                  </div>
                  <h4>No groups yet</h4>
                  <p>Create a new group from the menu above to get started.</p>
                </div>
              )}
            </>
          )
        ) : activeTab === 'calls' ? (
          callLogsLoading && callLogs.length === 0 ? (
            <div className="wa-inbox-loading">
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              <span>Loading call history...</span>
            </div>
          ) : callLogs.length === 0 ? (
            <div className="wa-inbox-empty">
              <div className="wa-empty-icon-circle">
                <i className="fa-solid fa-phone-slash"></i>
              </div>
              <h4>No call history</h4>
              <p>To start a call, open a chat or select a contact and tap the voice or video call button.</p>
            </div>
          ) : (
            <div className="wa-calls-history-wrapper">
              <div className="wa-calls-header-row">
                <span className="wa-calls-header-title">Recent Calls</span>
                {callLogs.length > 0 && (
                  <button
                    type="button"
                    className="wa-calls-clear-btn"
                    onClick={handleClearCallLogs}
                    title="Clear All Call Logs"
                  >
                    <i className="fa-solid fa-trash-can"></i> Clear All
                  </button>
                )}
              </div>

              {callLogs
                .filter((call) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  const name = (call.peerName || '').toLowerCase();
                  const phone = (call.peerPhone || call.peerId || '').toLowerCase();
                  return name.includes(q) || phone.includes(q);
                })
                .map((call) => {
                  const isMissed = call.direction === 'missed' || call.rawStatus === 'missed';
                  const isDeclined = call.direction === 'declined' || call.rawStatus === 'declined';
                  const isOutgoing = call.direction === 'outgoing';
                  const isGroupCall = Boolean(call.isGroup);
                  const peerPhoneDisplay = call.peerPhone || call.peerId;
                  const displayName = call.peerName || peerPhoneDisplay;
                  const isOnline = isUserOnline(peerPhoneDisplay);

                  return (
                    <div
                      key={call.id}
                      className={`wa-chat-item-row wa-call-item-row ${isMissed ? 'wa-call-missed' : ''}`}
                      onClick={() => handleSelectUser(isGroupCall ? `group:${call.groupId}` : peerPhoneDisplay)}
                      title="Tap to open conversation"
                    >
                      <Avatar
                        src={call.peerAvatar}
                        isGroup={isGroupCall}
                        name={displayName}
                        size={46}
                        showOnline={!isGroupCall && isOnline}
                        isOnline={isOnline}
                      />

                      <div className="wa-item-center">
                        <div className="wa-item-top">
                          <span className={`wa-item-name ${isMissed ? 'wa-missed-title' : ''}`}>
                            {displayName}
                            {isGroupCall && <span className="wa-group-tag-small">Group</span>}
                          </span>
                          <span className="wa-item-time">{formatCallTime(call.createdAt)}</span>
                        </div>
                        <div className="wa-item-bottom">
                          <span className="wa-call-subtitle-info">
                            {isGroupCall ? (
                              isMissed || call.status === 'not_accepted' ? (
                                <>
                                  <i className="fa-solid fa-arrow-down-left" style={{ color: '#ef4444', marginRight: '5px', fontSize: '13px' }}></i>
                                  <span style={{ color: '#ef4444', fontWeight: '600' }}>Not accepted</span>
                                  <span style={{ color: '#8696a0', marginLeft: '5px' }}>• {call.callType === 'video' ? 'Video' : 'Voice'}</span>
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-arrow-up-right" style={{ color: '#f97316', marginRight: '5px', fontSize: '13px' }}></i>
                                  <span style={{ color: '#f97316', fontWeight: '600' }}>
                                    {call.joinedCount > 0 ? `${call.joinedCount} joined` : 'Completed'}
                                  </span>
                                  {call.duration > 0 && (
                                    <span style={{ color: '#8696a0', marginLeft: '5px' }}>({formatDuration(call.duration)})</span>
                                  )}
                                  <span style={{ color: '#8696a0', marginLeft: '5px' }}>• {call.callType === 'video' ? 'Video' : 'Voice'}</span>
                                  {call.groupMembers?.length > 0 && (
                                    <small className="wa-call-members-preview">• {call.groupMembers.slice(0, 3).join(', ')}</small>
                                  )}
                                </>
                              )
                            ) : isMissed ? (
                              <>
                                <i className="fa-solid fa-arrow-down-left" style={{ color: '#ef4444', marginRight: '5px', fontSize: '13px' }}></i>
                                <span style={{ color: '#ef4444', fontWeight: '600' }}>Missed</span>
                                <span style={{ color: '#8696a0', marginLeft: '5px' }}>• {call.callType === 'video' ? 'Video' : 'Voice'}</span>
                              </>
                            ) : isDeclined ? (
                              <>
                                <i className="fa-solid fa-arrow-down-left" style={{ color: '#ef4444', marginRight: '5px', fontSize: '13px' }}></i>
                                <span style={{ color: '#ef4444' }}>Declined</span>
                                <span style={{ color: '#8696a0', marginLeft: '5px' }}>• {call.callType === 'video' ? 'Video' : 'Voice'}</span>
                              </>
                            ) : isOutgoing ? (
                              <>
                                <i className="fa-solid fa-arrow-up-right" style={{ color: '#f97316', marginRight: '5px', fontSize: '13px' }}></i>
                                <span>Outgoing</span>
                                {call.duration > 0 ? (
                                  <span style={{ color: '#8696a0', marginLeft: '5px' }}>({formatDuration(call.duration)})</span>
                                ) : (
                                  <span style={{ color: '#8696a0', marginLeft: '5px' }}>• Unanswered</span>
                                )}
                                <span style={{ color: '#8696a0', marginLeft: '5px' }}>• {call.callType === 'video' ? 'Video' : 'Voice'}</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-arrow-down-left" style={{ color: '#f97316', marginRight: '5px', fontSize: '13px' }}></i>
                                <span>Incoming</span>
                                {call.duration > 0 && (
                                  <span style={{ color: '#8696a0', marginLeft: '5px' }}>({formatDuration(call.duration)})</span>
                                )}
                                <span style={{ color: '#8696a0', marginLeft: '5px' }}>• {call.callType === 'video' ? 'Video' : 'Voice'}</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* 1-Tap Callback Actions & Delete */}
                      <div className="wa-call-item-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="wa-call-action-btn-small voice"
                          title={`Voice call ${displayName}`}
                          onClick={() => onStartCall && onStartCall('voice', peerPhoneDisplay)}
                        >
                          <i className="fa-solid fa-phone"></i>
                        </button>
                        <button
                          type="button"
                          className="wa-call-action-btn-small video"
                          title={`Video call ${displayName}`}
                          onClick={() => onStartCall && onStartCall('video', peerPhoneDisplay)}
                        >
                          <i className="fa-solid fa-video"></i>
                        </button>
                        <button
                          type="button"
                          className="wa-call-action-btn-small delete"
                          title="Delete call record"
                          onClick={() => handleDeleteCallLog(call.id)}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )
        ) : activeTab === 'status' ? (
          /* ======================= TAB: STATUS ======================= */
          <StatusTab userId={userId} currentUser={currentUser} onSelectChat={onSelectChat} />
        ) : (
          /* ======================= TAB: CHATS ======================= */
          searchQuery.trim() ? (
            <div className="wa-search-results-section">
              {/* 1. Existing Chats matched first */}
              {filteredConversations.length > 0 && (
                <>
                  <div className="wa-section-title">
                    <span>Chats</span>
                  </div>
                  {filteredConversations.map((item) => renderConversationItem(item))}
                </>
              )}

              {/* 2. Other Contacts from Database (excluding existing conversations) */}
              {newSearchResults.length > 0 && (
                <>
                  <div className="wa-section-title">
                    <span>Other Contacts</span>
                    {isSearchingDb && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  </div>
                  {newSearchResults.map((user) => {
                    const phoneDisplay = user.fullPhone || user.phone || user.id;
                    const displayName = user.name || phoneDisplay;
                    const online = isUserOnline(phoneDisplay);
                    return (
                      <div
                        key={user.id}
                        className="wa-chat-item-row search-match"
                        onClick={() => handleSelectUser(phoneDisplay, user)}
                      >
                        <Avatar
                          src={user.avatar}
                          name={displayName}
                          size={46}
                          showOnline={online}
                          isOnline={online}
                          className="search-avatar"
                        />
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
                  })}
                </>
              )}

              {/* 3. Fallback direct chat trigger if no existing chat and no new search results found */}
              {filteredConversations.length === 0 && newSearchResults.length === 0 && !isSearchingDb && (
                <div
                  className="wa-search-no-match"
                  onClick={() => {
                    let num = searchQuery.trim();
                    if (!num.startsWith('+')) num = `+91${num.replace(/\D/g, '')}`;
                    handleSelectUser(num);
                  }}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <div>
                    <strong>Chat with "{searchQuery.trim()}"</strong>
                    <p>Tap here to start chatting with this mobile number</p>
                  </div>
                </div>
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
              orderedConversations.map((item) => renderConversationItem(item))
            )
          )
        )}
      </div>

      {showGroupModal && (
        <div className="wa-modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="wa-new-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h3>Create Group</h3>
              <button type="button" className="wa-modal-close" onClick={() => setShowGroupModal(false)}>✕</button>
            </div>
            {modalError && <div className="wa-auth-error">{modalError}</div>}
            <form onSubmit={handleCreateGroup} className="wa-modal-form">
              {/* Group Avatar Upload Circle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '14px' }}>
                <div
                  style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}
                  onClick={() => groupAvatarInputRef.current?.click()}
                  title="Upload group image"
                >
                  <Avatar
                    src={groupAvatar}
                    name={groupName || 'Group'}
                    isGroup={true}
                    size={76}
                    style={{ border: '2.5px dashed #00a884', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  />
                  <div className="wa-create-group-avatar-overlay">
                    <i className="fa-solid fa-camera"></i>
                  </div>
                </div>
                <input
                  type="file"
                  ref={groupAvatarInputRef}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleGroupAvatarUpload}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="wa-group-photo-action-btn"
                    onClick={() => groupAvatarInputRef.current?.click()}
                    style={{ fontSize: '11px', padding: '3px 10px' }}
                  >
                    <i className="fa-solid fa-camera"></i> {groupAvatar ? 'Change Photo' : 'Add Group Image'}
                  </button>
                  {groupAvatar && (
                    <button
                      type="button"
                      className="wa-group-photo-action-btn remove"
                      onClick={() => setGroupAvatar(null)}
                      style={{ fontSize: '11px', padding: '3px 10px' }}
                    >
                      <i className="fa-solid fa-trash-can"></i> Remove
                    </button>
                  )}
                </div>
              </div>

              <label>Group Name</label>
              <input
                type="text"
                placeholder="e.g. Weekend Friends"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
                required
              />
              <label style={{ marginTop: '12px' }}>Members' phone numbers</label>
              <input
                type="text"
                placeholder="Type a registered number to search"
                value={groupMemberQuery}
                onChange={(e) => setGroupMemberQuery(e.target.value)}
              />
              {selectedGroupMembers.length > 0 && (
                <div className="wa-group-member-chips">
                  {selectedGroupMembers.map((member) => (
                    <button
                      type="button"
                      className="wa-group-member-chip"
                      key={member.id}
                      onClick={() => setSelectedGroupMembers((prev) => prev.filter((item) => item.id !== member.id))}
                      title="Remove member"
                    >
                      {member.name || member.fullPhone || member.phone} <span>×</span>
                    </button>
                  ))}
                </div>
              )}
              {groupMemberQuery.trim() && (
                <div className="wa-group-member-results">
                  {isSearchingGroupMembers ? (
                    <div className="wa-group-member-search-state">Searching...</div>
                  ) : groupMemberResults.length > 0 ? (
                    groupMemberResults.map((member) => (
                      <button
                        type="button"
                        className="wa-group-member-result"
                        key={member.id}
                        onClick={() => {
                          setSelectedGroupMembers((prev) => [...prev, member]);
                          setGroupMemberQuery('');
                        }}
                      >
                        <i className="fa-solid fa-user"></i>
                        <span>
                          <strong>{member.name || member.fullPhone || member.phone}</strong>
                          <small>{member.fullPhone || member.phone}</small>
                        </span>
                        <i className="fa-solid fa-plus"></i>
                      </button>
                    ))
                  ) : (
                    <div className="wa-group-member-search-state">No registered user found</div>
                  )}
                </div>
              )}
              <small style={{ display: 'block', margin: '8px 0 14px', color: '#6b7280' }}>
                Search by number, then tap a result to add it to the group.
              </small>
              <button
                type="submit"
                className="wa-auth-green-btn"
                style={{ width: '100%', maxWidth: '100%', margin: '0' }}
                disabled={creatingGroup || selectedGroupMembers.length === 0}
              >
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      )}

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

      {/* Modal: Delete Conversation Confirmation */}
      {deleteModal.isOpen && (
        <div
          className="wa-modal-overlay"
          onClick={() => !deleteModal.isDeleting && setDeleteModal({ isOpen: false, item: null, isDeleting: false })}
        >
          <div className="wa-delete-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-delete-modal-icon">
              <i className="fa-solid fa-trash-can"></i>
            </div>
            <h3>Delete this chat?</h3>
            <p>
              Messages will be cleared and this chat will be deleted for you (
              <strong>
                {deleteModal.item?.name || deleteModal.item?.fullPhone || deleteModal.item?.phone || deleteModal.item?.id}
              </strong>
              ).
            </p>
            <div className="wa-delete-modal-actions">
              <button
                type="button"
                className="wa-delete-cancel-btn"
                disabled={deleteModal.isDeleting}
                onClick={() => setDeleteModal({ isOpen: false, item: null, isDeleting: false })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wa-delete-confirm-btn"
                disabled={deleteModal.isDeleting}
                onClick={handleConfirmDelete}
              >
                {deleteModal.isDeleting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Deleting...
                  </>
                ) : (
                  'Delete Chat'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

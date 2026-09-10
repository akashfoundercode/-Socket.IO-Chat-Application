/**
 * All REST API endpoints and HTTP network requests are managed here.
 * Any URL or API changes made in this file automatically reflect across all frontend components.
 */

export const getApiBaseUrl = () => {
  const productionBackendUrl = 'https://whatsapp.siberiancrane.tech';
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return '';
  }
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || window.location.port === '5173'
      ? ''
      : productionBackendUrl;
  }
  return productionBackendUrl;
};

export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  let cleanPath = url;
  if (cleanPath.startsWith('/uploads/')) {
    cleanPath = cleanPath.replace('/uploads/', '/api/chat/media/');
  } else if (cleanPath.startsWith('/api/chat/uploads/')) {
    cleanPath = cleanPath.replace('/api/chat/uploads/', '/api/chat/media/');
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return cleanPath;
  return `${baseUrl.replace(/\/$/, '')}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Generic request helper with error handling and JSON parsing
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error.message);
    throw error;
  }
}

// ============================================
// 1. Authentication APIs (OTP & Login)
// ============================================
export const authApi = {
  /**
   * Send 6-digit OTP to phone number
   * POST /api/auth/send-otp
   */
  sendOtp: (countryCode, phone) => {
    return request('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ countryCode, phone })
    });
  },

  /**
   * Verify OTP and log in / register
   * POST /api/auth/verify-otp
   */
  verifyOtp: (countryCode, phone, otp, name = '') => {
    return request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ countryCode, phone, otp, name })
    });
  }
};

// ============================================
// 2. Profile & Settings APIs (Get & Update Profile)
// ============================================
export const profileApi = {
  /**
   * Get user profile details (Name, About, Avatar, Phone, Avatar Privacy)
   * GET /api/chat/profile/:id?viewerId=...
   */
  getProfile: (userId, viewerId = '') => {
    const url = viewerId
      ? `/api/chat/profile/${encodeURIComponent(userId)}?viewerId=${encodeURIComponent(viewerId)}`
      : `/api/chat/profile/${encodeURIComponent(userId)}`;
    return request(url);
  },

  /**
   * Update user profile (Name, About/Status, Avatar, Avatar Privacy)
   * PUT /api/chat/profile/:id
   */
  updateProfile: (userId, { name, about, avatar, avatarPrivacy }) => {
    return request(`/api/chat/profile/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, about, avatar, avatarPrivacy })
    });
  }
};

// ============================================
// 3. Chat & Conversation APIs
// ============================================
export const chatApi = {
  /**
   * Add / Create contact to start chatting
   * POST /api/chat/contacts
   */
  addContact: (countryCode, phone, name = '') => {
  addContact: (countryCode, phone, name = '', userId = '') => {
    return request('/api/chat/contacts', {
      method: 'POST',
      body: JSON.stringify({ countryCode, phone, name })
      body: JSON.stringify({ countryCode, phone, name, userId })
    });
  },

  /**
   * Get saved contact book / contacts log for a user
   * GET /api/chat/contacts/:userId
   */
  getContacts: (userId) => {
    return request(`/api/chat/contacts/${encodeURIComponent(userId)}`);
  },

  /**
   * Delete contact from saved contacts
   * DELETE /api/chat/contacts/:contactId
   */
  deleteContact: (contactId, userId) => {
    return request(`/api/chat/contacts/${encodeURIComponent(contactId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId, contactId })
    });
  },

  /**
   * Rename Contact / Save Custom Alias (Only visible to current user)
   * PUT /api/chat/contacts/rename
   */
  renameContact: (userId, contactId, customName) => {
    return request('/api/chat/contacts/rename', {
      method: 'PUT',
      body: JSON.stringify({ userId, contactId, customName })
    });
  },

  /**
   * Get active conversations list for a user (Empty [] for new users)
   * GET /api/chat/conversations/:userId
   */
  getConversations: (userId) => {
    return request(`/api/chat/conversations/${encodeURIComponent(userId)}`);
  },

  /**
   * Search registered users in database by exact or partial phone number
   * GET /api/chat/users/search?q=...&currentUserId=...
   */
  searchUsers: (query, currentUserId = '') => {
    const params = new URLSearchParams({
      q: query,
      currentUserId
    });
    return request(`/api/chat/users/search?${params.toString()}`);
  },

  /**
   * Get past chat history between two users
   * GET /api/chat/history?userId=...&otherUserId=...
   */
  getChatHistory: (userId, otherUserId) => {
    const params = new URLSearchParams({
      userId,
      otherUserId
    });
    return request(`/api/chat/history?${params.toString()}`);
  },

  /**
   * Get total & per-sender unread message notification counts
   * GET /api/chat/unread/:userId
   */
  getUnreadCount: (userId) => {
    return request(`/api/chat/unread/${encodeURIComponent(userId)}`);
  },

  /**
   * Delete / Clear entire conversation for user (Swipe to delete)
   * DELETE /api/chat/conversations/:otherUserId?userId=...
   */
  deleteConversation: (otherUserId, userId) => {
    const url = userId
      ? `/api/chat/conversations/${encodeURIComponent(otherUserId)}?userId=${encodeURIComponent(userId)}`
      : `/api/chat/conversations/${encodeURIComponent(otherUserId)}`;
    return request(url, { method: 'DELETE' });
  },

  /**
   * Mark unread messages from otherUserId as seen
   * POST /api/chat/seen
   */
  markSeen: (userId, otherUserId) => {
    return request('/api/chat/seen', {
      method: 'POST',
      body: JSON.stringify({ userId, otherUserId })
    });
  },

  getGroups: (userId) => request(`/api/chat/groups/${encodeURIComponent(userId)}`),

  createGroup: (creatorId, name, memberIds, avatar = null) => request('/api/chat/groups', {
    method: 'POST',
    body: JSON.stringify({ creatorId, name, memberIds, avatar })
  }),

  getGroup: (groupId, userId) => request(`/api/chat/groups/detail/${encodeURIComponent(groupId)}?userId=${encodeURIComponent(userId)}`),

  addGroupMember: (groupId, requesterId, memberId) => request(`/api/chat/groups/${encodeURIComponent(groupId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ requesterId, memberId })
  }),

  removeGroupMember: (groupId, requesterId, memberId) => request(`/api/chat/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ requesterId })
  }),

  leaveGroup: (groupId, userId) => request(`/api/chat/groups/${encodeURIComponent(groupId)}/leave`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  }),

  joinGroupByInvite: (groupId, userId, joinMethod = 'link') => request(`/api/chat/groups/${encodeURIComponent(groupId)}/join`, {
    method: 'POST',
    body: JSON.stringify({ userId, joinMethod })
  }),

  updateGroup: (groupId, requesterId, changes) => request(`/api/chat/groups/${encodeURIComponent(groupId)}`, {
    method: 'PUT',
    body: JSON.stringify({ requesterId, ...changes })
  }),

  updateGroupMemberRole: (groupId, requesterId, memberId, role) => request(`/api/chat/groups/${encodeURIComponent(groupId)}/members/role`, {
    method: 'PUT',
    body: JSON.stringify({ requesterId, memberId, role })
  }),

  getGroupHistory: (groupId, userId) => request(`/api/chat/groups/${encodeURIComponent(groupId)}/history?userId=${encodeURIComponent(userId)}`),

  markGroupSeen: (groupId, userId) => request(`/api/chat/groups/${encodeURIComponent(groupId)}/seen`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  })
};

// ============================================
// 4. Block & Unblock APIs
// ============================================
export const blockApi = {
  /**
   * Block a user
   * POST /api/chat/block
   */
  blockUser: (blockerId, blockedId) => {
    return request('/api/chat/block', {
      method: 'POST',
      body: JSON.stringify({ blockerId, blockedId })
    });
  },

  /**
   * Unblock a user
   * POST /api/chat/unblock
   */
  unblockUser: (blockerId, blockedId) => {
    return request('/api/chat/unblock', {
      method: 'POST',
      body: JSON.stringify({ blockerId, blockedId })
    });
  },

  /**
   * Get list of blocked user IDs
   * GET /api/chat/blocked/:userId
   */
  getBlockedList: (userId) => {
    return request(`/api/chat/blocked/${encodeURIComponent(userId)}`);
  },

  /**
   * Check block status
   * GET /api/chat/block-status?userId=...&otherUserId=...
   */
  getBlockStatus: (userId, otherUserId) => {
    const params = new URLSearchParams({ userId, otherUserId });
    return request(`/api/chat/block-status?${params.toString()}`);
  }
};

// ============================================
// 5. Agora RTC Video & Voice Calling APIs
// ============================================
export const agoraApi = {
  /**
   * Fetch dynamic Agora RTC token for channel
   * GET /api/agora/token?channelName=...&uid=...
   */
  getToken: (channelName, uid = 0) => {
    const params = new URLSearchParams({
      channelName: String(channelName).trim(),
      uid: String(uid || 0)
    });
    return request(`/api/agora/token?${params.toString()}`);
  }
};

// ============================================
// 6. Call Logs & History APIs
// ============================================
export const callApi = {
  /**
   * Get call history logs for a user
   * GET /api/chat/calls/:userId
   */
  getCallLogs: (userId) => {
    return request(`/api/chat/calls/${encodeURIComponent(userId)}`);
  },

  /**
   * Delete a specific call log entry
   * DELETE /api/chat/calls/:callId?userId=...
   */
  deleteCallLog: (callId, userId) => {
    return request(`/api/chat/calls/${encodeURIComponent(callId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  },

  /**
   * Batch delete call logs
   * POST /api/chat/calls/batch-delete
   */
  deleteCallLogs: (callIds, userId) => {
    return request('/api/chat/calls/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ callIds, userId })
    });
  },

  /**
   * Clear all call logs for a user
   * DELETE /api/chat/calls/clear/:userId
   */
  clearCallLogs: (userId) => {
    return request(`/api/chat/calls/clear/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  }
};

// ============================================
// 7. Status APIs
// ============================================
export const statusApi = {
  getStatuses: (userId) => request(`/api/chat/status/${encodeURIComponent(userId)}`),

  createStatus: ({ userId, type, content, caption, bgColor, fontStyle }) =>
    request('/api/chat/status', {
      method: 'POST',
      body: JSON.stringify({ userId, type, content, caption, bgColor, fontStyle })
    }),

  deleteStatus: (statusId, userId) =>
    request(`/api/chat/status/${statusId}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  viewStatus: (statusId, viewerId) =>
    request(`/api/chat/status/${statusId}/view`, {
      method: 'POST',
      body: JSON.stringify({ viewerId })
    }),

  getViewers: (statusId, ownerId) =>
    request(`/api/chat/status/${statusId}/viewers?ownerId=${encodeURIComponent(ownerId)}`),

  reactToStatus: (statusId, reactorId, emoji) =>
    request(`/api/chat/status/${statusId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reactorId, emoji })
    }),

  replyToStatus: (statusId, senderId, message) =>
    request(`/api/chat/status/${statusId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ senderId, message })
    })
};

export default {
  auth: authApi,
  profile: profileApi,
  chat: chatApi,
  block: blockApi,
  agora: agoraApi,
  calls: callApi,
  status: statusApi
};

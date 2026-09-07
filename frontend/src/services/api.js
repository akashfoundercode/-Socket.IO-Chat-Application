/**
 * Centralized API Service Manager for Frontend
 * All REST API endpoints and HTTP network requests are managed here.
 * Any URL or API changes made in this file automatically reflect across all frontend components.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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
    return request('/api/chat/contacts', {
      method: 'POST',
      body: JSON.stringify({ countryCode, phone, name })
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
  }
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

export default {
  auth: authApi,
  profile: profileApi,
  chat: chatApi,
  block: blockApi
};

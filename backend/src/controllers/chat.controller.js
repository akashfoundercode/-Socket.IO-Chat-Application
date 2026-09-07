const chatModel = require("../models/chat.model");

const normalizeId = (value) => String(value || "").trim();

/**
 * Add / Create a new contact to chat with
 * POST /api/chat/contacts
 * Body: { countryCode: "+91", phone: "9876543210", name?: "Rahul" }
 */
const addContact = async (req, res) => {
    try {
        let { countryCode, phone, name } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        let cleanPhone = String(phone).trim().replace(/\D/g, "");
        let cleanCountryCode = String(countryCode || "+91").trim();
        if (!cleanCountryCode.startsWith("+")) cleanCountryCode = `+${cleanCountryCode}`;

        let fullPhone;
        if (String(phone).trim().startsWith("+")) {
            fullPhone = String(phone).trim();
        } else {
            fullPhone = `${cleanCountryCode}${cleanPhone}`;
        }

        const contactName = (name && String(name).trim()) || fullPhone;

        const contact = await chatModel.findOrCreateContact({
            id: fullPhone,
            fullPhone,
            phone: cleanPhone,
            countryCode: cleanCountryCode,
            name: contactName
        });

        return res.status(200).json({
            success: true,
            message: "Contact added successfully",
            contact
        });
    } catch (error) {
        console.error("addContact error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Search users in database by exact or partial phone number / name
 * GET /api/chat/users/search?q=+919876543210&currentUserId=+919999999999
 */
const searchUsers = async (req, res) => {
    try {
        const query = req.query.q || req.query.phone || req.query.query;
        const currentUserId = req.query.currentUserId || req.query.userId || "";

        if (!query || String(query).trim().length === 0) {
            return res.json({ success: true, count: 0, users: [] });
        }

        const users = await chatModel.searchUsersByPhone(query, currentUserId);
        return res.json({
            success: true,
            query: String(query).trim(),
            count: users.length,
            users: Array.isArray(users) ? users : []
        });
    } catch (error) {
        console.error("searchUsers error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get active conversations list for a user.
 * GET /api/chat/conversations/:userId
 */
const getConversations = async (req, res) => {
    try {
        const userId = normalizeId(req.params.userId || req.query.userId);
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const conversations = await chatModel.listConversations(userId);
        return res.json({
            success: true,
            userId,
            conversations: Array.isArray(conversations) ? conversations : []
        });
    } catch (error) {
        console.error("getConversations error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get chat history between two users
 * GET /api/chat/history?userId=...&otherUserId=...
 */
const getChatHistory = async (req, res) => {
    try {
        const userId = normalizeId(req.query.userId);
        const otherUserId = normalizeId(req.query.otherUserId || req.query.room);

        if (!userId || !otherUserId) {
            return res.status(400).json({ success: false, message: "Both userId and otherUserId are required" });
        }

        const messages = await chatModel.getConversation(userId, otherUserId);
        return res.json({
            success: true,
            userId,
            otherUserId,
            messages
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Profile by user ID (optionally evaluated against viewerId for privacy)
 * GET /api/chat/profile/:id?viewerId=...
 */
const me = async (req, res) => {
    try {
        const userId = normalizeId(req.params.id);
        const viewerId = normalizeId(req.query.viewerId || req.query.currentUserId);
        const user = await chatModel.getUser(userId, viewerId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.json({ success: true, user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update Profile (Name, About/Status, Avatar, Avatar Privacy)
 * PUT /api/chat/profile/:id
 * Body: { name: "...", about: "...", avatar: "...", avatarPrivacy: "everyone" | "contacts" | "nobody" }
 */
const profile = async (req, res) => {
    try {
        const userId = normalizeId(req.params.id);
        const { name, about, avatar, avatarPrivacy } = req.body;

        const updatedUser = await chatModel.updateUser(userId, { name, about, avatar, avatarPrivacy });
        return res.json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("profile update error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Block a contact
 * POST /api/chat/block
 * Body: { blockerId: "...", blockedId: "..." }
 */
const blockContact = async (req, res) => {
    try {
        const blockerId = normalizeId(req.body.blockerId || req.body.userId);
        const blockedId = normalizeId(req.body.blockedId || req.body.targetUserId);

        if (!blockerId || !blockedId) {
            return res.status(400).json({ success: false, message: "Both blockerId and blockedId are required" });
        }

        await chatModel.blockUser(blockerId, blockedId);
        return res.json({ success: true, message: "User blocked successfully", blockerId, blockedId });
    } catch (error) {
        console.error("blockContact error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Unblock a contact
 * POST /api/chat/unblock
 * Body: { blockerId: "...", blockedId: "..." }
 */
const unblockContact = async (req, res) => {
    try {
        const blockerId = normalizeId(req.body.blockerId || req.body.userId);
        const blockedId = normalizeId(req.body.blockedId || req.body.targetUserId);

        if (!blockerId || !blockedId) {
            return res.status(400).json({ success: false, message: "Both blockerId and blockedId are required" });
        }

        await chatModel.unblockUser(blockerId, blockedId);
        return res.json({ success: true, message: "User unblocked successfully", blockerId, blockedId });
    } catch (error) {
        console.error("unblockContact error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get list of blocked users for a user
 * GET /api/chat/blocked/:userId
 */
const getBlockedList = async (req, res) => {
    try {
        const userId = normalizeId(req.params.userId || req.query.userId);
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const blockedList = await chatModel.getBlockedUsers(userId);
        return res.json({ success: true, userId, blockedUsers: blockedList });
    } catch (error) {
        console.error("getBlockedList error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Check block status between two users
 * GET /api/chat/block-status?userId=...&otherUserId=...
 */
const checkBlockStatus = async (req, res) => {
    try {
        const userId = normalizeId(req.query.userId);
        const otherUserId = normalizeId(req.query.otherUserId);

        if (!userId || !otherUserId) {
            return res.status(400).json({ success: false, message: "Both userId and otherUserId are required" });
        }

        const status = await chatModel.getBlockStatus(userId, otherUserId);
        return res.json({ success: true, ...status });
    } catch (error) {
        console.error("checkBlockStatus error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    addContact,
    searchUsers,
    getConversations,
    getChatHistory,
    me,
    profile,
    blockContact,
    unblockContact,
    getBlockedList,
    checkBlockStatus
};

const chatModel = require("../models/chat.model");

const normalizeId = (value) => String(value || "").trim();

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

const getUnreadNotifications = async (req, res) => {
    try {
        const userId = normalizeId(req.params.userId || req.query.userId);
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const unreadData = await chatModel.getUnreadCount(userId);
        return res.json({
            success: true,
            userId,
            ...unreadData
        });
    } catch (error) {
        console.error("getUnreadNotifications error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
const deleteConversation = async (req, res) => {
    try {
        const userId = normalizeId(req.query.userId || req.body.userId);
        const otherUserId = normalizeId(req.params.otherUserId || req.query.otherUserId || req.body.otherUserId);

        if (!userId || !otherUserId) {
            return res.status(400).json({ success: false, message: "Both userId and otherUserId are required" });
        }

        await chatModel.deleteConversation(userId, otherUserId);
        return res.json({
            success: true,
            message: "Conversation deleted successfully",
            userId,
            otherUserId
        });
    } catch (error) {
        console.error("deleteConversation error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const renameContact = async (req, res) => {
    try {
        const userId = normalizeId(req.body.userId || req.query.userId);
        const contactId = normalizeId(req.body.contactId || req.params.contactId || req.query.contactId);
        const customName = String(req.body.customName !== undefined ? req.body.customName : req.body.name !== undefined ? req.body.name : "").trim();

        if (!userId || !contactId) {
            return res.status(400).json({ success: false, message: "Both userId and contactId are required" });
        }

        const result = await chatModel.saveCustomContactName(userId, contactId, customName);
        return res.json({
            success: true,
            message: customName ? "Custom contact name saved successfully" : "Custom contact name reset to default",
            userId,
            contactId,
            customName: result?.customName || ""
        });
    } catch (error) {
        console.error("renameContact error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get call history logs for a user
 * GET /api/chat/calls/:userId
 */
const getCallLogs = async (req, res) => {
    try {
        const userId = normalizeId(req.params.userId || req.query.userId);
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const calls = await chatModel.getCallLogs(userId);
        return res.json({
            success: true,
            userId,
            count: calls.length,
            calls: Array.isArray(calls) ? calls : []
        });
    } catch (error) {
        console.error("getCallLogs error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete a specific call log entry
 * DELETE /api/chat/calls/:callId?userId=...
 */
const deleteCallLog = async (req, res) => {
    try {
        const callId = req.params.callId;
        const userId = normalizeId(req.query.userId || req.body.userId);
        if (!callId || !userId) {
            return res.status(400).json({ success: false, message: "Both callId and userId are required" });
        }

        await chatModel.deleteCallLog(callId, userId);
        return res.json({ success: true, message: "Call log entry deleted", callId });
    } catch (error) {
        console.error("deleteCallLog error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Clear all call logs for a user
 * DELETE /api/chat/calls/clear/:userId
 */
const clearCallLogs = async (req, res) => {
    try {
        const userId = normalizeId(req.params.userId || req.query.userId || req.body.userId);
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        await chatModel.clearCallLogs(userId);
        return res.json({ success: true, message: "All call logs cleared", userId });
    } catch (error) {
        console.error("clearCallLogs error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const createStatus = async (req, res) => {
    try {
        const userId = normalizeId(req.body.userId);
        const { type, content, caption, bgColor, fontStyle } = req.body;
        if (!userId || !content) return res.status(400).json({ success: false, message: 'userId and content are required' });
        const status = await chatModel.createStatus({ userId, type, content, caption, bgColor, fontStyle });
        return res.json({ success: true, status });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getStatuses = async (req, res) => {
    try {
        const userId = normalizeId(req.params.userId || req.query.userId);
        if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
        const [mine, contacts] = await Promise.all([
            chatModel.getMyStatuses(userId),
            chatModel.getContactStatuses(userId)
        ]);
        return res.json({ success: true, mine, contacts });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteStatus = async (req, res) => {
    try {
        const statusId = req.params.statusId;
        const userId = normalizeId(req.query.userId || req.body.userId);
        if (!statusId || !userId) return res.status(400).json({ success: false, message: 'statusId and userId are required' });
        await chatModel.deleteStatus(statusId, userId);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const viewStatus = async (req, res) => {
    try {
        const statusId = req.params.statusId;
        const viewerId = normalizeId(req.body.viewerId || req.query.viewerId);
        if (!statusId || !viewerId) return res.status(400).json({ success: false, message: 'statusId and viewerId required' });
        await chatModel.recordStatusView(statusId, viewerId);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getStatusViewers = async (req, res) => {
    try {
        const statusId = req.params.statusId;
        const ownerId = normalizeId(req.query.ownerId || req.query.userId);
        if (!statusId || !ownerId) return res.status(400).json({ success: false, message: 'statusId and ownerId required' });
        const viewers = await chatModel.getStatusViews(statusId, ownerId);
        return res.json({ success: true, viewers, count: viewers.length });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const reactToStatus = async (req, res) => {
    try {
        const statusId = req.params.statusId;
        const reactorId = normalizeId(req.body.reactorId || req.body.userId);
        const { emoji } = req.body;
        if (!statusId || !reactorId || !emoji) return res.status(400).json({ success: false, message: 'statusId, reactorId, emoji required' });
        await chatModel.addStatusReaction(statusId, reactorId, emoji);
        // Notify status owner via socket
        const ownerId = await chatModel.getStatusOwner(statusId);
        return res.json({ success: true, ownerId });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const replyToStatus = async (req, res) => {
    try {
        const statusId = req.params.statusId;
        const senderId = normalizeId(req.body.senderId || req.body.userId);
        const { message } = req.body;
        if (!statusId || !senderId || !message) return res.status(400).json({ success: false, message: 'statusId, senderId, message required' });
        await chatModel.addStatusReply(statusId, senderId, message);
        const ownerId = await chatModel.getStatusOwner(statusId);
        return res.json({ success: true, ownerId });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const markSeen = async (req, res) => {
    try {
        const userId = normalizeId(req.body.userId || req.query.userId);
        const otherUserId = normalizeId(req.body.otherUserId || req.query.otherUserId);
        if (!userId || !otherUserId) {
            return res.status(400).json({ success: false, message: "userId and otherUserId are required" });
        }
        const affectedRows = await chatModel.markMessagesAsSeen(otherUserId, userId);
        return res.json({ success: true, affectedRows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const createGroup = async (req, res) => {
    try {
        const creatorId = normalizeId(req.body.creatorId || req.body.userId);
        const name = String(req.body.name || '').trim();
        const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
        if (!creatorId || !name) return res.status(400).json({ success: false, message: 'creatorId and name are required' });
        const group = await chatModel.createGroup({ name, creatorId, memberIds });

        // Broadcast real-time socket events to creator and all members
        const io = req.app.get('io');
        if (io) {
            const allMemberIds = [creatorId, ...memberIds];
            allMemberIds.forEach((mId) => {
                const variants = chatModel.getPhoneVariants(mId);
                variants.forEach((v) => {
                    io.to(v).emit('group_created', { group });
                    io.to(v).emit('conversation_refresh');
                });
            });
        }

        return res.status(201).json({ success: true, group });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getGroups = async (req, res) => {
    try {
        const userId = normalizeId(req.params.userId || req.query.userId);
        if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
        return res.json({ success: true, groups: await chatModel.listGroups(userId) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getGroup = async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const userId = normalizeId(req.query.userId);
        const group = await chatModel.getGroup(groupId, userId);
        if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
        return res.json({ success: true, group });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const addGroupMember = async (req, res) => {
    try {
        const requesterId = normalizeId(req.body.requesterId || req.body.userId);
        const memberId = normalizeId(req.body.memberId);
        const groupId = req.params.groupId;
        const group = await chatModel.addGroupMember(groupId, requesterId, memberId);

        // Notify group and new member via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`group:${groupId}`).emit('group_details', group);
            const variants = chatModel.getPhoneVariants(memberId);
            variants.forEach((v) => {
                io.to(v).emit('group_created', { group });
                io.to(v).emit('conversation_refresh');
            });
        }

        return res.json({ success: true, group });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

const updateGroup = async (req, res) => {
    try {
        const requesterId = normalizeId(req.body.requesterId || req.body.userId);
        const group = await chatModel.updateGroup(req.params.groupId, requesterId, {
            name: req.body.name,
            avatar: req.body.avatar,
            messagePermission: req.body.messagePermission
        });
        const io = req.app.get('io');
        if (io) {
            io.to(`group:${req.params.groupId}`).emit('group_details', group);
            io.to(`group:${req.params.groupId}`).emit('conversation_refresh');
        }
        return res.json({ success: true, group });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

const updateGroupMemberRole = async (req, res) => {
    try {
        const requesterId = normalizeId(req.body.requesterId || req.body.userId);
        const group = await chatModel.updateGroupMemberRole(
            req.params.groupId,
            requesterId,
            normalizeId(req.body.memberId),
            req.body.role
        );
        const io = req.app.get('io');
        if (io) {
            io.to(`group:${req.params.groupId}`).emit('group_details', group);
            io.to(`group:${req.params.groupId}`).emit('conversation_refresh');
        }
        return res.json({ success: true, group });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

const getGroupHistory = async (req, res) => {
    try {
        const userId = normalizeId(req.query.userId);
        const groupId = req.params.groupId;
        if (userId && groupId) {
            await chatModel.markGroupMessagesAsSeen(groupId, userId).catch(() => { });
        }
        const messages = await chatModel.getGroupMessages(groupId, userId);
        return res.json({ success: true, messages });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const markGroupSeen = async (req, res) => {
    try {
        const groupId = req.params.groupId || req.body.groupId;
        const userId = normalizeId(req.body.userId || req.query.userId);
        if (!groupId || !userId) return res.status(400).json({ success: false, message: 'groupId and userId required' });
        await chatModel.markGroupMessagesAsSeen(groupId, userId);
        return res.json({ success: true, groupId });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    addContact,
    renameContact,
    searchUsers,
    getConversations,
    deleteConversation,
    getChatHistory,
    me,
    profile,
    blockContact,
    unblockContact,
    getBlockedList,
    checkBlockStatus,
    getUnreadNotifications,
    getCallLogs,
    deleteCallLog,
    clearCallLogs,
    createStatus,
    getStatuses,
    deleteStatus,
    viewStatus,
    getStatusViewers,
    reactToStatus,
    replyToStatus,
    markSeen,
    createGroup,
    getGroups,
    getGroup,
    addGroupMember,
    updateGroup,
    updateGroupMemberRole,
    getGroupHistory,
    markGroupSeen
};

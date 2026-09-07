const chatModel = require("../models/chat.model");

// Track online users and their active sockets: userId -> Set<socketId>
const onlineUsers = new Map();

const isUserOnline = (id) => {
    if (!id) return false;
    const cleanId = String(id).trim();
    const withPlus = cleanId.startsWith("+") ? cleanId : `+${cleanId}`;
    const withoutPlus = cleanId.replace(/^\+/, "");
    return (
        (onlineUsers.has(cleanId) && onlineUsers.get(cleanId).size > 0) ||
        (onlineUsers.has(withPlus) && onlineUsers.get(withPlus).size > 0) ||
        (onlineUsers.has(withoutPlus) && onlineUsers.get(withoutPlus).size > 0)
    );
};

module.exports = (io) => {
    io.on("connection", (socket) => {
        // 1. User Join / Connect
        socket.on("join", async (userId) => {
            const normalizedUserId = String(userId || "").trim();
            if (!normalizedUserId) return;

            socket.data.userId = normalizedUserId;
            socket.join(normalizedUserId);

            // Add to online users map
            if (!onlineUsers.has(normalizedUserId)) {
                onlineUsers.set(normalizedUserId, new Set());
            }
            onlineUsers.get(normalizedUserId).add(socket.id);

            // Update user last seen in DB
            await chatModel.updateLastSeen(normalizedUserId);

            // Broadcast that this user is ONLINE to all connected clients
            io.emit("user_status", {
                userId: normalizedUserId,
                isOnline: true
            });

            // Send current list of online users to the newly joined client
            socket.emit("online_users", Array.from(onlineUsers.keys()));

            // When user comes online, mark all pending 'sent' messages as 'delivered'
            try {
                const updatedCount = await chatModel.markMessagesAsDelivered(normalizedUserId);
                if (updatedCount > 0) {
                    io.emit("messages_delivered", { to: normalizedUserId });
                }
            } catch (err) {
                console.error("markMessagesAsDelivered error:", err);
            }

            socket.emit("joined", normalizedUserId);
        });

        // 2. Check single user online/offline status
        socket.on("check_user_status", async (targetUserId) => {
            const cleanTarget = String(targetUserId || "").trim();
            if (!cleanTarget) return;

            const userId = socket.data.userId;
            if (userId) {
                const blockStatus = await chatModel.getBlockStatus(userId, cleanTarget);
                if (blockStatus.isBlockedByThem || blockStatus.isBlockedByMe) {
                    socket.emit("user_status", {
                        userId: cleanTarget,
                        isOnline: false
                    });
                    return;
                }
            }

            socket.emit("user_status", {
                userId: cleanTarget,
                isOnline: isUserOnline(cleanTarget)
            });
        });

        // 3. Load Conversation and Mark Seen (Double Blue Tick)
        socket.on("loadConversation", async (otherUserId) => {
            const userId = socket.data.userId;
            otherUserId = String(otherUserId || "").trim();
            if (!userId || !otherUserId) return;

            socket.data.activeWith = otherUserId;

            // Check block status
            const blockStatus = await chatModel.getBlockStatus(userId, otherUserId);
            const isOnline = (blockStatus.isBlockedByThem || blockStatus.isBlockedByMe)
                ? false
                : isUserOnline(otherUserId);

            // Send immediate online/offline status of recipient
            socket.emit("user_status", {
                userId: otherUserId,
                isOnline
            });

            // Mark all messages from otherUserId to userId as SEEN (Double Blue Tick)
            try {
                await chatModel.markMessagesAsSeen(otherUserId, userId);
                io.to(otherUserId).emit("messages_seen", {
                    seenBy: userId,
                    conversationWith: userId
                });
            } catch (err) {
                console.error("markMessagesAsSeen error:", err);
            }

            const history = await chatModel.getConversation(userId, otherUserId);
            socket.emit("conversation_history", history);
        });

        // 4. Mark Seen Explicit Trigger
        socket.on("mark_seen", async ({ otherUserId }) => {
            const userId = socket.data.userId;
            const targetId = String(otherUserId || "").trim();
            if (!userId || !targetId) return;

            socket.data.activeWith = targetId;

            try {
                await chatModel.markMessagesAsSeen(targetId, userId);
                io.to(targetId).emit("messages_seen", {
                    seenBy: userId,
                    conversationWith: userId
                });
            } catch (err) {
                console.error("mark_seen error:", err);
            }
        });

        // 5. Close Active Chat (Back to Chat List)
        socket.on("close_chat", () => {
            socket.data.activeWith = null;
        });

        // 6. Send Message with Real-Time Tick Determination
        socket.on("message", async (data) => {
            const from = socket.data.userId;
            const to = String(data?.to || "").trim();
            const text = String(data?.text || "").trim();
            if (!from || !to || (!text && !data?.mediaUrl)) return;

            // Check block status before proceeding
            const blockStatus = await chatModel.getBlockStatus(from, to);
            if (blockStatus.isBlockedByMe || blockStatus.isBlockedByThem) {
                socket.emit("message_error", {
                    message: blockStatus.isBlockedByThem
                        ? "You cannot send messages because you have been blocked by this user."
                        : "You blocked this contact. Unblock to send messages."
                });
                return;
            }

            // Determine initial status:
            const isRecipientOnline = isUserOnline(to);

            let initialStatus = "sent"; // Single Gray Tick

            if (isRecipientOnline) {
                initialStatus = "delivered"; // Double Gray Tick

                // Check if recipient is currently inside this specific conversation
                const recipientSockets = onlineUsers.get(to) ||
                    onlineUsers.get(to.startsWith('+') ? to : `+${to}`) ||
                    onlineUsers.get(to.replace(/^\+/, ''));
                if (recipientSockets) {
                    for (const socketId of recipientSockets) {
                        const recipientSocket = io.sockets.sockets.get(socketId);
                        if (recipientSocket && (recipientSocket.data.activeWith === from ||
                            recipientSocket.data.activeWith === (from.startsWith('+') ? from : `+${from}`) ||
                            recipientSocket.data.activeWith === from.replace(/^\+/, ''))) {
                            initialStatus = "seen"; // Double Blue Tick
                            break;
                        }
                    }
                }
            }

            try {
                const message = await chatModel.addMessage({
                    from,
                    to,
                    text,
                    type: data?.type || "text",
                    status: initialStatus,
                    mediaUrl: data?.mediaUrl
                });

                // Deliver message to recipient if online
                if (isRecipientOnline) {
                    io.to(to).emit("message_received", message);
                    const altTo = to.startsWith('+') ? to.replace(/^\+/, '') : `+${to}`;
                    io.to(altTo).emit("message_received", message);
                }

                // Acknowledge sender with saved message containing status
                socket.emit("message_saved", message);
            } catch (err) {
                console.error("Socket message error:", err.message);
                socket.emit("message_error", { message: err.message });
            }
        });

        // 7. Typing Indicators
        socket.on("typing", async ({ to, isTyping }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            // Do not broadcast typing if blocked
            const blockStatus = await chatModel.getBlockStatus(from, cleanTo);
            if (blockStatus.isBlockedByMe || blockStatus.isBlockedByThem) return;

            io.to(cleanTo).emit("typing", { from, isTyping: Boolean(isTyping) });
            io.to(altTo).emit("typing", { from, isTyping: Boolean(isTyping) });
        });

        // 8. Block & Unblock Real-Time Synchronization
        socket.on("block_user", async ({ targetUserId }) => {
            const userId = socket.data.userId;
            const targetId = String(targetUserId || "").trim();
            if (!userId || !targetId) return;

            await chatModel.blockUser(userId, targetId);

            // Notify blocker client
            socket.emit("user_blocked", { targetUserId: targetId, byMe: true });

            // Notify blocked user client
            const altTarget = targetId.startsWith('+') ? targetId.replace(/^\+/, '') : `+${targetId}`;
            io.to(targetId).emit("user_blocked", { targetUserId: userId, byMe: false });
            io.to(altTarget).emit("user_blocked", { targetUserId: userId, byMe: false });

            // Mask status as offline for blocked user
            io.to(targetId).emit("user_status", { userId, isOnline: false });
            io.to(altTarget).emit("user_status", { userId, isOnline: false });
        });

        socket.on("unblock_user", async ({ targetUserId }) => {
            const userId = socket.data.userId;
            const targetId = String(targetUserId || "").trim();
            if (!userId || !targetId) return;

            await chatModel.unblockUser(userId, targetId);

            // Notify unblocker client
            socket.emit("user_unblocked", { targetUserId: targetId, byMe: true });

            // Notify unblocked user client
            const altTarget = targetId.startsWith('+') ? targetId.replace(/^\+/, '') : `+${targetId}`;
            io.to(targetId).emit("user_unblocked", { targetUserId: userId, byMe: false });
            io.to(altTarget).emit("user_unblocked", { targetUserId: userId, byMe: false });

            // Emit accurate presence
            const isMeOnline = isUserOnline(userId);
            io.to(targetId).emit("user_status", { userId, isOnline: isMeOnline });
            io.to(altTarget).emit("user_status", { userId, isOnline: isMeOnline });

            const isTargetOnline = isUserOnline(targetId);
            socket.emit("user_status", { userId: targetId, isOnline: isTargetOnline });
        });

        // 9. WebRTC Calling Signaling Events
        // A. Initiate Call
        socket.on("call_user", async ({ to, callerName, callerAvatar, callType, offer }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            // Check if call is between blocked users
            const blockStatus = await chatModel.getBlockStatus(from, cleanTo);
            if (blockStatus.isBlockedByMe || blockStatus.isBlockedByThem) {
                socket.emit("call_rejected", {
                    from: cleanTo,
                    reason: blockStatus.isBlockedByThem ? "Cannot call: You are blocked by this user." : "Cannot call: You blocked this contact."
                });
                return;
            }

            const payload = {
                from,
                callerName: callerName || from,
                callerAvatar: callerAvatar || null,
                callType: callType || 'voice', // 'voice' | 'video'
                offer: offer || null
            };

            io.to(cleanTo).emit("incoming_call", payload);
            io.to(altTo).emit("incoming_call", payload);
        });

        // B. Answer / Accept Call
        socket.on("answer_call", ({ to, answer }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            io.to(cleanTo).emit("call_accepted", { from, answer });
            io.to(altTo).emit("call_accepted", { from, answer });
        });

        // C. Reject / Decline Call
        socket.on("reject_call", ({ to, reason }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            io.to(cleanTo).emit("call_rejected", { from, reason: reason || 'Call declined' });
            io.to(altTo).emit("call_rejected", { from, reason: reason || 'Call declined' });
        });

        // D. End / Hangup Active Call
        socket.on("end_call", ({ to }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            io.to(cleanTo).emit("call_ended", { from });
            io.to(altTo).emit("call_ended", { from });
        });

        // E. WebRTC ICE Candidates Exchange
        socket.on("ice_candidate", ({ to, candidate }) => {
            const from = socket.data.userId;
            if (!from || !to || !candidate) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            io.to(cleanTo).emit("ice_candidate", { from, candidate });
            io.to(altTo).emit("ice_candidate", { from, candidate });
        });

        // 8. Explicit User Logout
        socket.on("logout", async () => {
            const userId = socket.data.userId;
            if (userId && onlineUsers.has(userId)) {
                onlineUsers.get(userId).delete(socket.id);
                if (onlineUsers.get(userId).size === 0) {
                    onlineUsers.delete(userId);
                    await chatModel.updateLastSeen(userId);
                    io.emit("user_status", {
                        userId,
                        isOnline: false,
                        lastSeen: new Date()
                    });
                }
            }
            if (userId) socket.leave(userId);
            socket.data.userId = null;
            socket.data.activeWith = null;
        });

        // 9. Disconnect / Cleanup
        socket.on("disconnect", async () => {
            const userId = socket.data.userId;
            if (userId && onlineUsers.has(userId)) {
                onlineUsers.get(userId).delete(socket.id);
                if (onlineUsers.get(userId).size === 0) {
                    onlineUsers.delete(userId);
                    await chatModel.updateLastSeen(userId);
                    io.emit("user_status", {
                        userId,
                        isOnline: false,
                        lastSeen: new Date()
                    });
                }
            }
        });
    });
};


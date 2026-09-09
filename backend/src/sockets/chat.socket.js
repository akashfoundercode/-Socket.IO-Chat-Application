const chatModel = require("../models/chat.model");

// Track online users and their active sockets: userId -> Set<socketId>
const onlineUsers = new Map();

// Track active call sessions: channelName -> { callId, callerId, receiverId, callType, startTime, isAnswered }
const activeCalls = new Map();
// Track which user is currently on an active call: userId -> channelName
const userCallSessions = new Map();
const activeGroupCalls = new Map();

const saveCallChatMessage = async (io, session, status, duration = 0) => {
    if (!session?.callerId || !session?.receiverId) return;

    const callMessage = await chatModel.addMessage({
        from: session.callerId,
        to: session.receiverId,
        text: JSON.stringify({
            callType: session.callType || 'voice',
            status,
            duration: Number(duration || 0)
        }),
        type: 'call',
        status: 'delivered'
    });

    chatModel.getPhoneVariants(session.callerId).forEach((variant) => {
        io.to(variant).emit('message_saved', callMessage);
    });

    const receiverVariants = chatModel.getPhoneVariants(session.receiverId);
    receiverVariants.forEach((variant) => io.to(variant).emit('message_received', callMessage));
};

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

            try {
                const groups = await chatModel.listGroups(normalizedUserId);
                groups.forEach((group) => socket.join(`group:${group.groupId}`));
            } catch (err) {
                console.error("join group rooms error:", err.message);
            }


            if (!onlineUsers.has(normalizedUserId)) {
                onlineUsers.set(normalizedUserId, new Set());
            }
            onlineUsers.get(normalizedUserId).add(socket.id);


            try {
                await chatModel.updateLastSeen(normalizedUserId);
            } catch (err) {
                console.error("updateLastSeen error:", err.message);
            }

            io.emit("user_status", {
                userId: normalizedUserId,
                isOnline: true
            });


            socket.emit("online_users", Array.from(onlineUsers.keys()));


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

        socket.on("loadConversation", async (otherUserId) => {
            const userId = socket.data.userId;
            otherUserId = String(otherUserId || "").trim();
            if (!userId || !otherUserId) return;

            socket.data.activeWith = otherUserId;

            const blockStatus = await chatModel.getBlockStatus(userId, otherUserId);
            const isOnline = (blockStatus.isBlockedByThem || blockStatus.isBlockedByMe)
                ? false
                : isUserOnline(otherUserId);

            socket.emit("user_status", {
                userId: otherUserId,
                isOnline
            });

            try {
                await chatModel.markMessagesAsSeen(otherUserId, userId);
                chatModel.getPhoneVariants(otherUserId).forEach((variant) => {
                    io.to(variant).emit("messages_seen", {
                        seenBy: userId,
                        conversationWith: userId
                    });
                });
            } catch (err) {
                console.error("markMessagesAsSeen error:", err);
            }

            const history = await chatModel.getConversation(userId, otherUserId);
            socket.emit("conversation_history", history);
        });


        socket.on("mark_seen", async ({ otherUserId }) => {
            const userId = socket.data.userId;
            const targetId = String(otherUserId || "").trim();
            if (!userId || !targetId) return;

            socket.data.activeWith = targetId;

            try {
                await chatModel.markMessagesAsSeen(targetId, userId);
                chatModel.getPhoneVariants(targetId).forEach((variant) => {
                    io.to(variant).emit("messages_seen", {
                        seenBy: userId,
                        conversationWith: userId
                    });
                });
            } catch (err) {
                console.error("mark_seen error:", err);
            }
        });


        socket.on("close_chat", () => {
            socket.data.activeWith = null;
        });


        socket.on("message", async (data) => {
            const from = socket.data.userId;
            const to = String(data?.to || "").trim();
            const text = String(data?.text || "").trim();
            if (!from || !to || (!text && !data?.mediaUrl)) return;

            const blockStatus = await chatModel.getBlockStatus(from, to);
            if (blockStatus.isBlockedByMe || blockStatus.isBlockedByThem) {
                socket.emit("message_error", {
                    message: blockStatus.isBlockedByThem
                        ? "You cannot send messages because you have been blocked by this user."
                        : "You blocked this contact. Unblock to send messages."
                });
                return;
            }


            const isRecipientOnline = isUserOnline(to);

            let initialStatus = "sent";

            if (isRecipientOnline) {
                initialStatus = "delivered";


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
                    mediaUrl: data?.mediaUrl,
                    replyToId: data?.replyToId || null,
                    replyToText: data?.replyToText || null,
                    replyToSender: data?.replyToSender || null
                });

                if (isRecipientOnline) {
                    io.to(to).emit("message_received", message);
                    const altTo = to.startsWith('+') ? to.replace(/^\+/, '') : `+${to}`;
                    io.to(altTo).emit("message_received", message);
                }

                socket.emit("message_saved", message);
            } catch (err) {
                console.error("Socket message error:", err.message);
                socket.emit("message_error", { message: err.message });
            }
        });

        socket.on("message_reaction", async ({ messageId, emoji, to }) => {
            const userId = socket.data.userId;
            if (!userId || !messageId) return;
            try {
                const result = await chatModel.reactToMessage(messageId, userId, emoji);
                socket.emit("message_reaction_updated", result);
                const target = to || result.recipientId || result.senderId;
                if (target) {
                    const variants = chatModel.getPhoneVariants(target);
                    variants.forEach((v) => {
                        io.to(v).emit("message_reaction_updated", result);
                    });
                }
            } catch (err) {
                console.error("message_reaction error:", err.message);
                socket.emit("message_error", { message: err.message });
            }
        });

        socket.on("loadGroup", async (groupId) => {
            const userId = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!userId || !cleanGroupId) return;
            try {
                const group = await chatModel.getGroup(cleanGroupId, userId);
                if (!group) return socket.emit("message_error", { message: "You are not a member of this group." });
                socket.join(`group:${cleanGroupId}`);
                socket.data.activeGroup = cleanGroupId;
                await chatModel.markGroupMessagesAsSeen(cleanGroupId, userId).catch(() => { });
                socket.emit("group_details", group);
                socket.emit("group_history", await chatModel.getGroupMessages(cleanGroupId, userId));
            } catch (err) {
                socket.emit("message_error", { message: err.message });
            }
        });

        socket.on("mark_group_seen", async ({ groupId }) => {
            const userId = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!userId || !cleanGroupId) return;
            try {
                await chatModel.markGroupMessagesAsSeen(cleanGroupId, userId);
            } catch (err) {
                console.error("mark_group_seen error:", err.message);
            }
        });

        socket.on("join_group_room", (groupId) => {
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (cleanGroupId) socket.join(`group:${cleanGroupId}`);
        });

        socket.on("leave_group_room", (groupId) => {
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (cleanGroupId) socket.leave(`group:${cleanGroupId}`);
        });

        socket.on("group_message", async (data) => {
            const senderId = socket.data.userId;
            const groupId = String(data?.groupId || "").replace(/^group:/, "");
            if (!senderId || !groupId || (!String(data?.text || "").trim() && !data?.mediaUrl)) return;
            try {
                const message = await chatModel.addGroupMessage({
                    groupId,
                    senderId,
                    text: data.text,
                    type: data.type || "text",
                    mediaUrl: data.mediaUrl || null,
                    replyToId: data.replyToId || null,
                    mentions: data.mentions || []
                });
                io.to(`group:${groupId}`).emit("group_message_received", message);
                io.to(`group:${groupId}`).emit("conversation_refresh");
            } catch (err) {
                socket.emit("message_error", { message: err.message });
            }
        });

        socket.on("group_reaction", async ({ groupId, messageId, emoji }) => {
            const userId = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!userId || !cleanGroupId || !messageId) return;
            try {
                const reactions = await chatModel.reactToGroupMessage(cleanGroupId, messageId, userId, emoji);
                io.to(`group:${cleanGroupId}`).emit("group_reaction_updated", { messageId: String(messageId), reactions });
            } catch (err) {
                socket.emit("message_error", { message: err.message });
            }
        });

        socket.on("leave_group", async ({ groupId }) => {
            const userId = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!userId || !cleanGroupId) return;
            try {
                const { systemMsg } = await chatModel.leaveGroup(cleanGroupId, userId);
                socket.leave(`group:${cleanGroupId}`);
                socket.emit("group_left", { groupId: cleanGroupId });
                if (systemMsg) {
                    io.to(`group:${cleanGroupId}`).emit("group_message_received", systemMsg);
                }
                io.to(`group:${cleanGroupId}`).emit("group_member_left", { groupId: cleanGroupId, userId });
                io.to(`group:${cleanGroupId}`).emit("conversation_refresh");
            } catch (err) {
                socket.emit("message_error", { message: err.message });
            }
        });

        socket.on("group_typing", ({ groupId, isTyping }) => {
            const userId = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!userId || !cleanGroupId) return;
            socket.to(`group:${cleanGroupId}`).emit("group_typing", { from: userId, isTyping: Boolean(isTyping) });
        });

        socket.on("group_call_user", async ({ groupId, callerName, callerAvatar, callType, channelName }) => {
            const from = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!from || !cleanGroupId) return;
            const group = await chatModel.getGroup(cleanGroupId, from);
            if (!group) return;
            const cName = channelName || `group_call_${cleanGroupId}_${Date.now()}`;
            let callLog = null;
            try {
                callLog = await chatModel.createCallLog({
                    callerId: from,
                    receiverId: `group:${cleanGroupId}`,
                    callType: callType || 'voice',
                    status: 'missed',
                    channelName: cName,
                    groupId: cleanGroupId,
                    groupName: group.name || 'Group',
                    memberNames: {
                        joinedCount: 1,
                        members: [callerName || from]
                    }
                });
            } catch (err) {
                console.error('create group call log error:', err.message);
            }
            activeGroupCalls.set(cName, {
                callId: callLog?.id,
                groupId: cleanGroupId,
                callerId: from,
                callerName: callerName || from,
                callType: callType || "voice",
                groupName: group.name || "Group",
                groupAvatar: group.avatar || null,
                participants: new Set([from]),
                participantNames: new Map([[from, callerName || from]]),
                acceptedMembers: new Set(),
                hadAcceptedMember: false,
                startedAt: Date.now(),
                ended: false
            });
            socket.join(`group:${cleanGroupId}`);
            io.to(`group:${cleanGroupId}`).emit('call_log_updated');
            socket.to(`group:${cleanGroupId}`).emit("incoming_group_call", {
                from,
                groupId: cleanGroupId,
                groupName: group.name || "Group",
                groupAvatar: group.avatar || null,
                callerName: callerName || from,
                callerAvatar: callerAvatar || null,
                callType: callType || "voice",
                channelName: cName
            });
        });

        socket.on("group_call_response", async ({ groupId, channelName, accepted, userName, userAvatar }) => {
            const from = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!from || !cleanGroupId) return;

            const session = channelName ? activeGroupCalls.get(channelName) : null;
            const isValidSession = session && session.groupId === cleanGroupId;
            const group = isValidSession ? await chatModel.getGroup(cleanGroupId, from) : null;
            if (!isValidSession || !group) {
                socket.emit("group_call_rejected", {
                    groupId: cleanGroupId,
                    channelName,
                    reason: "You are not a member of this group call."
                });
                return;
            }

            if (session && accepted) {
                session.participants.add(from);
                session.acceptedMembers.add(from);
                session.hadAcceptedMember = true;
                session.participantNames.set(from, userName || from);
            }

            if (accepted) {
                socket.join(`group:${cleanGroupId}`);
            }
            socket.to(`group:${cleanGroupId}`).emit(accepted ? "group_call_accepted" : "group_call_rejected", {
                from,
                groupId: cleanGroupId,
                channelName,
                name: userName || from,
                avatar: userAvatar || null,
                accepted: Boolean(accepted),
                joinedCount: session ? session.participants.size : 1
            });
        });

        socket.on("group_call_media_status", ({ groupId, isMuted, isVideoOff }) => {
            const from = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!from || !cleanGroupId) return;
            const session = Array.from(activeGroupCalls.values()).find((call) => (
                call.groupId === cleanGroupId && call.participants.has(from)
            ));
            if (!session) return;
            socket.to(`group:${cleanGroupId}`).emit("group_call_peer_media_status", {
                from,
                groupId: cleanGroupId,
                isMuted: Boolean(isMuted),
                isVideoOff: Boolean(isVideoOff)
            });
        });

        socket.on("group_call_leave", ({ groupId, channelName }) => {
            const from = socket.data.userId;
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (cleanGroupId) {
                const session = channelName ? activeGroupCalls.get(channelName) : null;
                if (!session || session.groupId !== cleanGroupId || !session.participants.has(from)) return;
                if (session) {
                    session.participants.delete(from);
                    session.acceptedMembers.delete(from);
                    session.participantNames.delete(from);
                }
                socket.to(`group:${cleanGroupId}`).emit("group_call_user_left", { from, groupId: cleanGroupId, channelName });

                // A group RTC channel with one participant left is no longer
                // an active call. Reuse the normal finalization path so the
                // remaining user receives the same cleanup and call log.
                if (session && session.participants.size <= 1 && !session.ended) {
                    socket.emit("group_call_end", { groupId: cleanGroupId, channelName });
                }
            }
        });

        socket.on("group_call_end", ({ groupId, channelName }) => {
            const cleanGroupId = String(groupId || "").replace(/^group:/, "");
            if (!cleanGroupId) return;

            const session = channelName ? activeGroupCalls.get(channelName) : null;
            if (session && !session.ended) {
                session.ended = true;
                const totalJoined = session.participants.size;
                const hasAccepted = session.hadAcceptedMember || session.acceptedMembers.size > 0;
                const finalStatus = hasAccepted ? 'completed' : 'not_accepted';
                const callDuration = hasAccepted ? Math.max(1, Math.round((Date.now() - session.startedAt) / 1000)) : 0;
                const memberNamesList = Array.from(session.participantNames.values());

                if (session.callId) {
                    chatModel.updateCallLog(session.callId, {
                        status: finalStatus,
                        duration: callDuration,
                        memberNames: {
                            joinedCount: totalJoined,
                            members: memberNamesList
                        }
                    }).catch((err) => {
                        console.error('update group call log error:', err.message);
                    });
                }
                chatModel.addGroupMessage({
                    groupId: cleanGroupId,
                    senderId: session.callerId,
                    text: JSON.stringify({
                        callType: session.callType,
                        status: finalStatus,
                        joinedCount: totalJoined,
                        duration: callDuration,
                        groupName: session.groupName,
                        callerName: session.callerName,
                        memberNames: memberNamesList
                    }),
                    type: 'call'
                }).then((message) => {
                    io.to(`group:${cleanGroupId}`).emit('group_message_received', message);
                    io.to(`group:${cleanGroupId}`).emit('conversation_refresh');
                }).catch((err) => console.error('group call message error:', err.message));

                activeGroupCalls.delete(channelName);
                io.to(`group:${cleanGroupId}`).emit('call_log_updated');
            }

            socket.to(`group:${cleanGroupId}`).emit("group_call_ended", { channelName });
        });


        socket.on("delete_message", async ({ messageId, deleteFor, to }) => {
            const userId = socket.data.userId;
            if (!userId || !messageId) return;

            const isEveryone = deleteFor === "everyone";
            try {
                const result = await chatModel.deleteMessage(messageId, userId, isEveryone);
                if (!result) return;

                if (isEveryone) {

                    socket.emit("message_deleted", {
                        messageId: String(messageId),
                        deleteFor: "everyone",
                        message: result
                    });


                    if (to) {
                        const cleanTo = String(to).trim();
                        const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;
                        io.to(cleanTo).emit("message_deleted", {
                            messageId: String(messageId),
                            deleteFor: "everyone",
                            message: result
                        });
                        io.to(altTo).emit("message_deleted", {
                            messageId: String(messageId),
                            deleteFor: "everyone",
                            message: result
                        });
                    }
                } else {

                    socket.emit("message_deleted", {
                        messageId: String(messageId),
                        deleteFor: "me",
                        messageId: String(messageId)
                    });
                }
            } catch (err) {
                console.error("delete_message error:", err.message);
                socket.emit("message_error", { message: err.message });
            }
        });


        socket.on("delete_conversation", async ({ otherUserId }) => {
            const userId = socket.data.userId;
            if (!userId || !otherUserId) return;

            try {
                await chatModel.deleteConversation(userId, otherUserId);
                socket.emit("conversation_deleted", { otherUserId: String(otherUserId) });
            } catch (err) {
                console.error("delete_conversation error:", err.message);
                socket.emit("message_error", { message: err.message });
            }
        });


        socket.on("rename_contact", async ({ contactId, customName }) => {
            const userId = socket.data.userId;
            if (!userId || !contactId) return;

            try {
                const result = await chatModel.saveCustomContactName(userId, contactId, customName);
                socket.emit("contact_renamed", result);
            } catch (err) {
                console.error("rename_contact error:", err.message);
                socket.emit("message_error", { message: err.message });
            }
        });


        socket.on("edit_message", async ({ messageId, text, to }) => {
            const userId = socket.data.userId;
            if (!userId || !messageId || !text) return;

            try {
                const updatedMessage = await chatModel.updateMessage(messageId, userId, text);
                if (!updatedMessage) return;


                socket.emit("message_edited", updatedMessage);


                if (to) {
                    const cleanTo = String(to).trim();
                    const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;
                    io.to(cleanTo).emit("message_edited", updatedMessage);
                    io.to(altTo).emit("message_edited", updatedMessage);
                }
            } catch (err) {
                console.error("edit_message error:", err.message);
                socket.emit("message_error", { message: err.message });
            }
        });

        socket.on("pin_message", async ({ messageId, pinned, to, groupId }) => {
            const userId = socket.data.userId;
            const isGroup = Boolean(groupId || String(to || '').startsWith('group:'));
            if (!userId || !messageId) return;

            try {
                const updatedMessage = await chatModel.updateMessagePin(
                    messageId,
                    userId,
                    Boolean(pinned),
                    isGroup,
                    groupId || to
                );
                if (!updatedMessage) return;

                if (isGroup) {
                    const cleanGroupId = String(groupId || to).replace(/^group:/, '');
                    io.to(`group:${cleanGroupId}`).emit("message_pin_updated", updatedMessage);
                } else {
                    socket.emit("message_pin_updated", updatedMessage);
                    if (to) {
                        const cleanTo = String(to).trim();
                        const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;
                        io.to(cleanTo).emit("message_pin_updated", updatedMessage);
                        io.to(altTo).emit("message_pin_updated", updatedMessage);
                    }
                }
            } catch (err) {
                console.error("pin_message error:", err.message);
                socket.emit("message_error", { message: err.message });
            }
        });


        socket.on("typing", async ({ to, isTyping }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;


            const blockStatus = await chatModel.getBlockStatus(from, cleanTo);
            if (blockStatus.isBlockedByMe || blockStatus.isBlockedByThem) return;

            io.to(cleanTo).emit("typing", { from, isTyping: Boolean(isTyping) });
            io.to(altTo).emit("typing", { from, isTyping: Boolean(isTyping) });
        });


        socket.on("block_user", async ({ targetUserId }) => {
            const userId = socket.data.userId;
            const targetId = String(targetUserId || "").trim();
            if (!userId || !targetId) return;

            await chatModel.blockUser(userId, targetId);

            socket.emit("user_blocked", { targetUserId: targetId, byMe: true });


            const altTarget = targetId.startsWith('+') ? targetId.replace(/^\+/, '') : `+${targetId}`;
            io.to(targetId).emit("user_blocked", { targetUserId: userId, byMe: false });
            io.to(altTarget).emit("user_blocked", { targetUserId: userId, byMe: false });


            io.to(targetId).emit("user_status", { userId, isOnline: false });
            io.to(altTarget).emit("user_status", { userId, isOnline: false });
        });

        socket.on("unblock_user", async ({ targetUserId }) => {
            const userId = socket.data.userId;
            const targetId = String(targetUserId || "").trim();
            if (!userId || !targetId) return;

            await chatModel.unblockUser(userId, targetId);

            socket.emit("user_unblocked", { targetUserId: targetId, byMe: true });



            const altTarget = targetId.startsWith('+') ? targetId.replace(/^\+/, '') : `+${targetId}`;
            io.to(targetId).emit("user_unblocked", { targetUserId: userId, byMe: false });
            io.to(altTarget).emit("user_unblocked", { targetUserId: userId, byMe: false });


            const isMeOnline = isUserOnline(userId);
            io.to(targetId).emit("user_status", { userId, isOnline: isMeOnline });
            io.to(altTarget).emit("user_status", { userId, isOnline: isMeOnline });

            const isTargetOnline = isUserOnline(targetId);
            socket.emit("user_status", { userId: targetId, isOnline: isTargetOnline });
        });


        // 9. WebRTC / Agora Calling Signaling Events
        // A. Initiate Call
        socket.on("call_user", async ({ to, callerName, callerAvatar, callType, channelName }) => {
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

            const cName = channelName || `call_${Date.now()}`;

            // Persist Call Log entry with initial status 'missed'
            let callLog = null;
            try {
                callLog = await chatModel.createCallLog({
                    callerId: from,
                    receiverId: cleanTo,
                    callType: callType || 'voice',
                    status: 'missed',
                    channelName: cName
                });
            } catch (logErr) {
                console.error("createCallLog error:", logErr.message);
            }

            const callSession = {
                callId: callLog?.id,
                callerId: from,
                receiverId: cleanTo,
                callType: callType || 'voice',
                channelName: cName,
                startTime: null,
                isAnswered: false
            };

            activeCalls.set(cName, callSession);
            userCallSessions.set(from, cName);

            const payload = {
                callId: callLog?.id,
                from,
                callerName: callerName || from,
                callerAvatar: callerAvatar || null,
                callType: callType || 'voice',
                channelName: cName
            };

            // Check if receiver is currently on another call (Call Waiting)
            const isReceiverBusy = userCallSessions.has(cleanTo) || userCallSessions.has(altTo);

            if (isReceiverBusy) {
                // Inform receiver about Call Waiting
                io.to(cleanTo).emit("call_waiting", payload);
                io.to(altTo).emit("call_waiting", payload);

                // Inform caller that user is on another call (Call Waiting)
                socket.emit("call_waiting_response", {
                    to: cleanTo,
                    channelName: cName,
                    message: "User is on another call (Call Waiting)..."
                });
            } else {
                io.to(cleanTo).emit("incoming_call", payload);
                io.to(altTo).emit("incoming_call", payload);
            }

            // Real-time notification to update calls tab
            io.to(from).emit("call_log_updated");
        });

        // B. Recipient device received ring -> notify caller with "Ringing..."
        socket.on("call_ringing", ({ to, channelName }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            io.to(cleanTo).emit("call_ringing", { from, channelName });
            io.to(altTo).emit("call_ringing", { from, channelName });
        });

        // C. Answer / Accept Call
        socket.on("answer_call", async ({ to, channelName }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            const session = channelName ? activeCalls.get(channelName) : null;
            if (session) {
                session.isAnswered = true;
                session.startTime = Date.now();
                userCallSessions.set(from, channelName);

                if (session.callId) {
                    try {
                        await chatModel.updateCallLog(session.callId, { status: 'incoming', duration: 0 });
                    } catch (err) {
                        console.error("updateCallLog on answer error:", err.message);
                    }
                }
            }

            io.to(cleanTo).emit("call_accepted", { from, channelName });
            io.to(altTo).emit("call_accepted", { from, channelName });

            io.to(cleanTo).emit("call_log_updated");
            io.to(from).emit("call_log_updated");
        });

        // D. Reject / Decline Call
        socket.on("reject_call", async ({ to, channelName, reason }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            const session = channelName ? activeCalls.get(channelName) : null;
            if (session && session.callId) {
                try {
                    await chatModel.updateCallLog(session.callId, { status: 'declined', duration: 0 });
                    await saveCallChatMessage(io, session, 'declined', 0);
                } catch (err) {
                    console.error("updateCallLog on reject error:", err.message);
                }
            }

            if (channelName) {
                activeCalls.delete(channelName);
            }
            userCallSessions.delete(from);

            io.to(cleanTo).emit("call_rejected", { from, reason: reason || 'Call declined' });
            io.to(altTo).emit("call_rejected", { from, reason: reason || 'Call declined' });

            io.to(cleanTo).emit("call_log_updated");
            io.to(from).emit("call_log_updated");
        });

        // E. End / Hangup Active Call
        socket.on("end_call", async ({ to, channelName }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;

            const session = channelName ? activeCalls.get(channelName) : null;
            if (session) {
                let duration = 0;
                if (session.isAnswered && session.startTime) {
                    duration = Math.max(1, Math.round((Date.now() - session.startTime) / 1000));
                }
                if (session.callId) {
                    try {
                        await chatModel.updateCallLog(session.callId, {
                            status: session.isAnswered ? 'incoming' : 'missed',
                            duration
                        });
                        await saveCallChatMessage(io, session, session.isAnswered ? 'completed' : 'missed', duration);
                    } catch (err) {
                        console.error("updateCallLog on end error:", err.message);
                    }
                }
                activeCalls.delete(channelName);
            }

            userCallSessions.delete(from);
            userCallSessions.delete(cleanTo);
            userCallSessions.delete(altTo);

            io.to(cleanTo).emit("call_ended", { from });
            io.to(altTo).emit("call_ended", { from });

            io.to(cleanTo).emit("call_log_updated");
            io.to(from).emit("call_log_updated");
        });

        // Media Status Sync (Mute / Video Off notification to peer)
        socket.on("call_media_status", ({ to, isMuted, isVideoOff }) => {
            const from = socket.data.userId;
            if (!from || !to) return;
            const cleanTo = String(to).trim();
            const altTo = cleanTo.startsWith('+') ? cleanTo.replace(/^\+/, '') : `+${cleanTo}`;
            io.to(cleanTo).emit("call_media_status", { from, isMuted, isVideoOff });
            io.to(altTo).emit("call_media_status", { from, isMuted, isVideoOff });
        });

        // Profile Updated Real-time broadcast
        socket.on("profile_updated", (data) => {
            const userId = socket.data.userId || data?.userId;
            if (!userId) return;
            io.emit("user_profile_changed", {
                userId,
                name: data?.name,
                profileName: data?.name,
                about: data?.about,
                avatar: data?.avatar,
                avatarPrivacy: data?.avatarPrivacy
            });
        });

        // Status Real-Time Socket Handlers
        socket.on("status_posted", ({ userId }) => {
            io.emit("status_updated", { userId: userId || socket.data.userId });
        });

        socket.on("status_deleted", ({ userId }) => {
            io.emit("status_updated", { userId: userId || socket.data.userId });
        });

        socket.on("status_viewed", ({ statusId, ownerId, viewerId }) => {
            if (!ownerId) return;
            const cleanOwner = String(ownerId).trim();
            const altOwner = cleanOwner.startsWith('+') ? cleanOwner.replace(/^\+/, '') : `+${cleanOwner}`;
            io.to(cleanOwner).emit("status_view_updated", { statusId, viewerId: viewerId || socket.data.userId });
            io.to(altOwner).emit("status_view_updated", { statusId, viewerId: viewerId || socket.data.userId });
        });

        socket.on("status_reaction", ({ statusId, ownerId, emoji }) => {
            if (!ownerId) return;
            const cleanOwner = String(ownerId).trim();
            const altOwner = cleanOwner.startsWith('+') ? cleanOwner.replace(/^\+/, '') : `+${cleanOwner}`;
            io.to(cleanOwner).emit("status_reaction_updated", {
                statusId,
                reactorId: socket.data.userId,
                emoji
            });
            io.to(altOwner).emit("status_reaction_updated", {
                statusId,
                reactorId: socket.data.userId,
                emoji
            });
        });

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
const chatModel = require("../models/chat.model");

module.exports = (io) => {
    io.on("connection", (socket) => {
        socket.on("join", (userId) => {
            const normalizedUserId = String(userId || "").trim();
            if (!normalizedUserId) return;
            socket.data.userId = normalizedUserId;
            socket.join(normalizedUserId);
            socket.emit("joined", normalizedUserId);
        });

        socket.on("loadConversation", async (otherUserId) => {
            const userId = socket.data.userId;
            otherUserId = String(otherUserId || "").trim();
            if (!userId || !otherUserId) return;
            socket.emit("conversation_history", await chatModel.getConversation(userId, otherUserId));
        });

        socket.on("message", async (data) => {
            const from = socket.data.userId;
            const to = String(data?.to || "").trim();
            const text = String(data?.text || "").trim();
            if (!from || !to || (!text && !data?.mediaUrl)) return;

            const message = await chatModel.addMessage({ from, to, text, type: data?.type, mediaUrl: data?.mediaUrl });

            // Deliver message to recipient and acknowledge sender
            io.to(to).emit("message_received", message);
            socket.emit("message_saved", message);
        });

        socket.on("edit_message", async ({ id, text, to }) => {
            const message = await chatModel.updateMessage(id, socket.data.userId, String(text || "").trim());
            if (message) io.to(String(to)).emit("message_updated", message);
            if (message) socket.emit("message_updated", message);
        });

        socket.on("delete_message", async ({ id, to, everyone }) => {
            const deleted = await chatModel.deleteMessage(id, socket.data.userId, Boolean(everyone));
            if (deleted) {
                const payload = { id: String(id), everyone: Boolean(everyone) };
                if (everyone) io.to(String(to)).emit("message_deleted", payload);
                else socket.emit("message_deleted", payload);
            }
        });

        socket.on("typing", ({ to, isTyping }) => {
            if (to) socket.to(String(to)).emit("typing", { from: socket.data.userId, isTyping: Boolean(isTyping) });
        });

        socket.on("call", ({ to, kind }) => {
            if (to) io.to(String(to)).emit("incoming_call", { from: socket.data.userId, kind: kind === "video" ? "video" : "audio" });
        });
    });
};

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
            if (!from || !to || !text) return;

            const message = await chatModel.addMessage({ from, to, text });

            // Deliver message to recipient and acknowledge sender
            io.to(to).emit("message_received", message);
            socket.emit("message_saved", message);
        });
    });
};

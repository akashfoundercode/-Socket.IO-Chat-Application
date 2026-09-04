const chatModel = require("../models/chat.model");

const getChatHistory = async (req, res) => {
    const { room } = req.query;
    if (!room) {
        return res.status(400).json({
            message: "Room is required" });
    }

    const messages = await chatModel.getConversation(room, room);
    return res.json({
          room, messages 
        });
};

module.exports = { getChatHistory };

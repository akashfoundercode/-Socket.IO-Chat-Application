const chatModel = require("../models/chat.model");

const normalizeId = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");

const register = async (req, res) => {
    try {
        const id = normalizeId(req.body.id);
        const name = String(req.body.name || "").trim();
        const password = String(req.body.password || "");
        if (!id || !name || password.length < 4) return res.status(400).json({ message: "Name, user ID and a 4+ character password are required" });
        return res.status(201).json({ user: await chatModel.createUser({ id, name, password }) });
    } catch (error) {
        return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ message: error.code === "ER_DUP_ENTRY" ? "User ID already exists" : "Could not create account" });
    }
};

const login = async (req, res) => {
    const user = await chatModel.authenticateUser({ id: normalizeId(req.body.id), password: String(req.body.password || "") });
    if (!user) return res.status(401).json({ message: "Invalid user ID or password" });
    return res.json({ user });
};

const me = async (req, res) => res.json({ user: await chatModel.getUser(normalizeId(req.params.id)) });
const users = async (req, res) => res.json({ users: await chatModel.listUsers(normalizeId(req.params.id)) });
const profile = async (req, res) => res.json({ user: await chatModel.updateUser(normalizeId(req.params.id), req.body) });

const getChatHistory = async (req, res) => {
    const { room } = req.query;
    if (!room) {
        return res.status(400).json({
            message: "Room is required"
        });
    }

    const messages = await chatModel.getConversation(room, room);
    return res.json({
        room, messages
    });
};

module.exports = { getChatHistory };
module.exports = { getChatHistory, register, login, me, users, profile };

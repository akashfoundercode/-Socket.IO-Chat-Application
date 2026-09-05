const { getPool } = require("../config/database");
const crypto = require("crypto");

const mapMessage = (row) => ({
    id: String(row.id),
    from: row.sender_id,
    to: row.recipient_id,
    text: row.text,
    type: row.type || "text",
    mediaUrl: row.media_url || null,
    editedAt: row.edited_at,
    createdAt: row.created_at
});

const hashPassword = (password) => crypto.createHash("sha256").update(password).digest("hex");

const createUser = async ({ id, name, password }) => {
    await getPool().execute(
        "INSERT INTO users (id, name, password_hash) VALUES (?, ?, ?)",
        [id, name, hashPassword(password)]
    );
    return getUser(id);
};

const getUser = async (id) => {
    const [rows] = await getPool().execute(
        "SELECT id, name, about, avatar, last_seen AS lastSeen FROM users WHERE id = ?",
        [id]
    );
    return rows[0] || null;
};

const authenticateUser = async ({ id, password }) => {
    const [rows] = await getPool().execute(
        "SELECT id, name, about, avatar, last_seen AS lastSeen FROM users WHERE id = ? AND password_hash = ?",
        [id, hashPassword(password)]
    );
    if (rows[0]) await getPool().execute("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    return rows[0] || null;
};

const updateUser = async (id, { name, about, avatar }) => {
    await getPool().execute(
        "UPDATE users SET name = COALESCE(?, name), about = COALESCE(?, about), avatar = COALESCE(?, avatar) WHERE id = ?",
        [name || null, about || null, avatar || null, id]
    );
    return getUser(id);
};

const listUsers = async (userId) => {
    const [rows] = await getPool().execute(
        `SELECT u.id, u.name, u.about, u.avatar, u.last_seen AS lastSeen,
            (SELECT text FROM messages m WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id) ORDER BY m.id DESC LIMIT 1) AS lastMessage,
            (SELECT created_at FROM messages m WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id) ORDER BY m.id DESC LIMIT 1) AS lastMessageAt
         FROM users u WHERE u.id <> ? ORDER BY COALESCE(lastMessageAt, u.last_seen) DESC, u.name ASC`,
        [userId, userId, userId, userId, userId]
    );
    return rows;
};

const addMessage = async ({ from, to, text, type = "text", mediaUrl = null }) => {
    const [result] = await getPool().execute(
        "INSERT INTO messages (sender_id, recipient_id, text, type, media_url) VALUES (?, ?, ?, ?, ?)",
        [from, to, text, type, mediaUrl]
    );
    const [rows] = await getPool().execute("SELECT * FROM messages WHERE id = ?", [result.insertId]);
    return mapMessage(rows[0]);
};

const updateMessage = async (id, userId, text) => {
    const [result] = await getPool().execute("UPDATE messages SET text = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ? AND sender_id = ?", [text, id, userId]);
    if (!result.affectedRows) return null;
    const [rows] = await getPool().execute("SELECT * FROM messages WHERE id = ?", [id]);
    return mapMessage(rows[0]);
};

const deleteMessage = async (id, userId, everyone = false) => {
    if (everyone) {
        const [result] = await getPool().execute("UPDATE messages SET text = '', type = 'deleted', media_url = NULL WHERE id = ? AND sender_id = ?", [id, userId]);
        return result.affectedRows > 0;
    }
    await getPool().execute("INSERT IGNORE INTO message_deletions (message_id, user_id) VALUES (?, ?)", [id, userId]);
    return true;
};

const getConversation = async (userId, otherUserId) => {
    const [rows] = await getPool().execute(
        `SELECT m.* FROM messages m
            WHERE ((sender_id = ? AND recipient_id = ?) 
                OR (sender_id = ? AND recipient_id = ?))
            AND NOT EXISTS (SELECT 1 FROM message_deletions d WHERE d.message_id = m.id AND d.user_id = ?)
         ORDER BY id ASC`,
        [userId, otherUserId, otherUserId, userId, userId]
    );
    return rows.map(mapMessage);
};

module.exports = {
    addMessage,
    getConversation,
    createUser,
    getUser,
    authenticateUser,
    updateUser,
    listUsers,
    updateMessage,
    deleteMessage
};
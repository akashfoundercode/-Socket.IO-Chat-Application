const { getPool } = require("../config/database");

const mapMessage = (row) => ({
    id: String(row.id),
    from: row.sender_id,
    to: row.recipient_id,
    text: row.text,
    createdAt: row.created_at
});

const addMessage = async ({ from, to, text }) => {
    const [result] = await getPool().execute(
        "INSERT INTO messages (sender_id, recipient_id, text) VALUES (?, ?, ?)",
        [from, to, text]
    );
    const [rows] = await getPool().execute("SELECT * FROM messages WHERE id = ?", [result.insertId]);
    return mapMessage(rows[0]);
};

const getConversation = async (userId, otherUserId) => {
    const [rows] = await getPool().execute(
        `SELECT * FROM messages 
         WHERE (sender_id = ? AND recipient_id = ?) 
            OR (sender_id = ? AND recipient_id = ?) 
         ORDER BY id ASC`,
        [userId, otherUserId, otherUserId, userId]
    );
    return rows.map(mapMessage);
};

module.exports = {
    addMessage,
    getConversation
};
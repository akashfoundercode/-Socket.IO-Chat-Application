const { getPool } = require("../config/database");
const crypto = require("crypto");

const mapMessage = (row) => ({
    id: String(row.id),
    from: row.sender_id,
    to: row.recipient_id,
    text: row.text,
    type: row.type || "text",
    status: row.status || "sent",
    mediaUrl: row.media_url || null,
    deliveredAt: row.delivered_at,
    seenAt: row.seen_at,
    editedAt: row.edited_at,
    createdAt: row.created_at
});

const hashPassword = (password) => crypto.createHash("sha256").update(password).digest("hex");

const createUser = async ({ id, name, password }) => {
    await getPool().execute(
        "INSERT INTO users (id, name, password_hash) VALUES (?, ?, ?)",
        [id, name || id, hashPassword(password)]
    );
    return getUser(id);
};

const findOrCreateContact = async ({ id, fullPhone, phone, countryCode, name }) => {
    const pool = getPool();
    const [rows] = await pool.execute(
        "SELECT id, name, country_code AS countryCode, phone, full_phone AS fullPhone, about, avatar, last_seen AS lastSeen FROM users WHERE full_phone = ? OR id = ? LIMIT 1",
        [fullPhone, id]
    );

    if (rows.length > 0) {
        return rows[0];
    }

    await pool.execute(
        `INSERT INTO users (id, name, country_code, phone, full_phone, last_seen)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, name || fullPhone, countryCode, phone, fullPhone]
    );

    const [newRows] = await pool.execute(
        "SELECT id, name, country_code AS countryCode, phone, full_phone AS fullPhone, about, avatar, last_seen AS lastSeen FROM users WHERE id = ?",
        [id]
    );
    return newRows[0];
};

const getPhoneVariants = (id) => {
    const clean = String(id || "").trim();
    if (!clean) return [];
    const withPlus = clean.startsWith("+") ? clean : `+${clean}`;
    const withoutPlus = clean.replace(/^\+/, "");
    return Array.from(new Set([clean, withPlus, withoutPlus]));
};

const blockUser = async (blockerId, blockedId) => {
    const pool = getPool();
    const cleanBlocker = String(blockerId || "").trim();
    const cleanBlocked = String(blockedId || "").trim();
    if (!cleanBlocker || !cleanBlocked) return false;

    await pool.execute(
        `INSERT IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)`,
        [cleanBlocker, cleanBlocked]
    );
    return true;
};

const unblockUser = async (blockerId, blockedId) => {
    const pool = getPool();
    const blockerVars = getPhoneVariants(blockerId);
    const blockedVars = getPhoneVariants(blockedId);
    if (!blockerVars.length || !blockedVars.length) return false;

    const blockerPlaceholders = blockerVars.map(() => "?").join(",");
    const blockedPlaceholders = blockedVars.map(() => "?").join(",");

    await pool.execute(
        `DELETE FROM blocked_users 
         WHERE blocker_id IN (${blockerPlaceholders}) AND blocked_id IN (${blockedPlaceholders})`,
        [...blockerVars, ...blockedVars]
    );
    return true;
};

const getBlockStatus = async (userId, otherUserId) => {
    const pool = getPool();
    const userVars = getPhoneVariants(userId);
    const otherVars = getPhoneVariants(otherUserId);

    if (!userVars.length || !otherVars.length) {
        return { isBlockedByMe: false, isBlockedByThem: false };
    }

    const uPlaceholders = userVars.map(() => "?").join(",");
    const oPlaceholders = otherVars.map(() => "?").join(",");

    // 1. Did user block other?
    const [byMeRows] = await pool.execute(
        `SELECT id FROM blocked_users WHERE blocker_id IN (${uPlaceholders}) AND blocked_id IN (${oPlaceholders}) LIMIT 1`,
        [...userVars, ...otherVars]
    );

    // 2. Did other block user?
    const [byThemRows] = await pool.execute(
        `SELECT id FROM blocked_users WHERE blocker_id IN (${oPlaceholders}) AND blocked_id IN (${uPlaceholders}) LIMIT 1`,
        [...otherVars, ...userVars]
    );

    return {
        isBlockedByMe: byMeRows.length > 0,
        isBlockedByThem: byThemRows.length > 0
    };
};

const getBlockedUsers = async (userId) => {
    const pool = getPool();
    const userVars = getPhoneVariants(userId);
    if (!userVars.length) return [];

    const placeholders = userVars.map(() => "?").join(",");
    const [rows] = await pool.execute(
        `SELECT DISTINCT blocked_id AS blockedId, created_at AS createdAt 
         FROM blocked_users 
         WHERE blocker_id IN (${placeholders})`,
        userVars
    );
    return rows.map((r) => r.blockedId);
};

const getUser = async (id, viewerId = null) => {
    const cleanId = String(id || "").trim();
    const withPlus = cleanId.startsWith("+") ? cleanId : `+${cleanId}`;

    const [rows] = await getPool().execute(
        `SELECT 
            id, 
            COALESCE(name, full_phone, id) AS name, 
            country_code AS countryCode, 
            phone, 
            COALESCE(full_phone, id) AS fullPhone, 
            about, 
            avatar, 
            COALESCE(avatar_privacy, 'everyone') AS avatarPrivacy,
            last_seen AS lastSeen 
         FROM users 
         WHERE id = ? OR full_phone = ? OR full_phone = ? 
         LIMIT 1`,
        [cleanId, cleanId, withPlus]
    );
    if (!rows[0]) return null;

    const user = rows[0];
    if (!user.avatarPrivacy) user.avatarPrivacy = 'everyone';
    user.isBlockedByMe = false;
    user.isBlockedByThem = false;

    // Apply block checks and privacy if viewerId is provided and different from user
    if (viewerId) {
        const cleanViewer = String(viewerId || "").trim();
        const isSelf = cleanViewer === user.id || cleanViewer === user.fullPhone;
        if (!isSelf) {
            const blockStatus = await getBlockStatus(cleanViewer, user.id);
            user.isBlockedByMe = blockStatus.isBlockedByMe;
            user.isBlockedByThem = blockStatus.isBlockedByThem;

            if (blockStatus.isBlockedByThem || blockStatus.isBlockedByMe) {
                // If blocked, profile photo and about bio are completely hidden!
                user.avatar = null;
                user.about = '';
                user.lastSeen = null;
            } else if (user.avatarPrivacy === 'nobody') {
                user.avatar = null;
            } else if (user.avatarPrivacy === 'contacts') {
                const [chatCount] = await getPool().execute(
                    `SELECT id FROM messages 
                     WHERE (sender_id = ? AND recipient_id = ?) 
                        OR (sender_id = ? AND recipient_id = ?) 
                     LIMIT 1`,
                    [cleanViewer, user.id, user.id, cleanViewer]
                );
                if (chatCount.length === 0) {
                    user.avatar = null;
                }
            }
        }
    }

    return user;
};

const authenticateUser = async ({ id, password }) => {
    const [rows] = await getPool().execute(
        "SELECT id, COALESCE(full_phone, id) AS name, about, avatar, COALESCE(avatar_privacy, 'everyone') AS avatarPrivacy, last_seen AS lastSeen FROM users WHERE id = ? AND password_hash = ?",
        [id, hashPassword(password)]
    );
    if (rows[0]) await getPool().execute("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    return rows[0] || null;
};

/**
 * Update user profile (Name, About/Status, Avatar, Avatar Privacy)
 */
const updateUser = async (id, { name, about, avatar, avatarPrivacy }) => {
    const cleanId = String(id || "").trim();
    const withPlus = cleanId.startsWith("+") ? cleanId : `+${cleanId}`;

    // Ensure user exists first, if not create user entry
    const existing = await getUser(cleanId);
    if (!existing) {
        await getPool().execute(
            `INSERT INTO users (id, name, full_phone, about, avatar, avatar_privacy)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [cleanId, name || cleanId, cleanId, about || 'Available', avatar || '🧑‍💻', avatarPrivacy || 'everyone']
        );
        return getUser(cleanId);
    }

    await getPool().execute(
        `UPDATE users 
         SET name = COALESCE(?, name), 
             about = COALESCE(?, about), 
             avatar = COALESCE(?, avatar),
             avatar_privacy = COALESCE(?, avatar_privacy)
         WHERE id = ? OR full_phone = ? OR full_phone = ?`,
        [
            name !== undefined ? name : null,
            about !== undefined ? about : null,
            avatar !== undefined ? avatar : null,
            avatarPrivacy !== undefined ? avatarPrivacy : null,
            cleanId,
            cleanId,
            withPlus
        ]
    );

    return getUser(cleanId);
};

/**
 * List active conversations for a user.
 */
const listConversations = async (userId) => {
    const pool = getPool();
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return [];

    const userVars = getPhoneVariants(cleanUserId);
    const placeholders = userVars.map(() => "?").join(",");

    const [rows] = await pool.execute(
        `SELECT 
            contact.id AS id,
            COALESCE(u.name, u.full_phone, contact.id) AS name,
            u.full_phone AS fullPhone,
            u.phone AS phone,
            u.about AS about,
            COALESCE(u.avatar_privacy, 'everyone') AS avatarPrivacy,
            CASE 
                WHEN u.avatar_privacy = 'nobody' THEN NULL 
                ELSE u.avatar 
            END AS avatar,
            u.last_seen AS lastSeen,
            m.text AS lastMessage,
            m.status AS lastMessageStatus,
            m.created_at AS lastMessageAt,
            m.sender_id AS lastMessageSender,
            m.type AS lastMessageType
         FROM (
            SELECT DISTINCT 
                CASE 
                    WHEN sender_id IN (${placeholders}) THEN recipient_id 
                    ELSE sender_id 
                END AS id
            FROM messages
            WHERE (sender_id IN (${placeholders}) OR recipient_id IN (${placeholders}))
         ) AS contact
         LEFT JOIN users u ON (u.id = contact.id OR u.full_phone = contact.id OR u.phone = contact.id)
         LEFT JOIN messages m ON m.id = (
            SELECT sub_m.id FROM messages sub_m
            WHERE ((sub_m.sender_id IN (${placeholders}) AND sub_m.recipient_id = contact.id)
               OR (sub_m.sender_id = contact.id AND sub_m.recipient_id IN (${placeholders})))
            ORDER BY sub_m.id DESC
            LIMIT 1
         )
         ORDER BY m.id DESC`,
        [...userVars, ...userVars, ...userVars, ...userVars, ...userVars]
    );

    const conversations = await Promise.all(
        rows.map(async (conv) => {
            const blockStatus = await getBlockStatus(cleanUserId, conv.id);
            const isBlockedByMe = blockStatus.isBlockedByMe;
            const isBlockedByThem = blockStatus.isBlockedByThem;

            return {
                ...conv,
                isBlockedByMe,
                isBlockedByThem,
                avatar: isBlockedByMe || isBlockedByThem ? null : conv.avatar,
                about: isBlockedByMe || isBlockedByThem ? '' : conv.about,
                lastSeen: isBlockedByThem ? null : conv.lastSeen
            };
        })
    );

    return conversations;
};

/**
 * Search registered users by phone
 */
const searchUsersByPhone = async (searchQuery, currentUserId = "") => {
    const pool = getPool();
    const query = String(searchQuery || "").trim();
    const cleanCurrentUserId = String(currentUserId || "").trim();

    if (!query) return [];

    const digitsOnly = query.replace(/\D/g, "");
    const withPlus = query.startsWith("+") ? query : `+${query}`;

    const [rows] = await pool.execute(
        `SELECT 
            u.id,
            COALESCE(u.name, u.full_phone, u.id) AS name,
            u.country_code AS countryCode,
            u.phone,
            u.full_phone AS fullPhone,
            u.about,
            COALESCE(u.avatar_privacy, 'everyone') AS avatarPrivacy,
            CASE 
                WHEN u.avatar_privacy = 'nobody' THEN NULL
                WHEN u.avatar_privacy = 'contacts' THEN (
                    CASE WHEN EXISTS (
                        SELECT 1 FROM messages m 
                        WHERE (m.sender_id = u.id AND m.recipient_id = ?) 
                           OR (m.sender_id = ? AND m.recipient_id = u.id)
                    ) THEN u.avatar ELSE NULL END
                )
                ELSE u.avatar
            END AS avatar,
            u.last_seen AS lastSeen
         FROM users u
         WHERE (
            u.full_phone = ? 
            OR u.full_phone = ? 
            OR u.phone = ? 
            OR u.id = ?
            OR u.full_phone LIKE ?
            OR u.phone LIKE ?
            OR u.name LIKE ?
         )
         AND u.id <> ?
         ORDER BY 
            (CASE WHEN u.full_phone = ? OR u.phone = ? THEN 1 ELSE 2 END),
            u.id ASC
         LIMIT 20`,
        [
            cleanCurrentUserId,
            cleanCurrentUserId,
            query,
            withPlus,
            digitsOnly,
            query,
            `%${digitsOnly || query}%`,
            `%${digitsOnly || query}%`,
            `%${query}%`,
            cleanCurrentUserId,
            query,
            digitsOnly
        ]
    );

    return rows;
};

const addMessage = async ({ from, to, text, type = "text", status = "sent", mediaUrl = null }) => {
    // Check if either user has blocked the other
    const blockStatus = await getBlockStatus(from, to);
    if (blockStatus.isBlockedByMe || blockStatus.isBlockedByThem) {
        const err = new Error(
            blockStatus.isBlockedByThem
                ? "You cannot send messages to this contact because you have been blocked."
                : "You blocked this contact. Unblock to send messages."
        );
        err.isBlocked = true;
        throw err;
    }

    const deliveredAt = status === "delivered" ? new Date() : null;

    const [result] = await getPool().execute(
        "INSERT INTO messages (sender_id, recipient_id, text, type, status, media_url, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [from, to, text, type, status, mediaUrl, deliveredAt]
    );
    const [rows] = await getPool().execute("SELECT * FROM messages WHERE id = ?", [result.insertId]);
    return mapMessage(rows[0]);
};

const markMessagesAsDelivered = async (recipientId) => {
    const pool = getPool();
    const [result] = await pool.execute(
        "UPDATE messages SET status = 'delivered', delivered_at = NOW() WHERE recipient_id = ? AND status = 'sent'",
        [recipientId]
    );
    return result.affectedRows;
};

const markMessagesAsSeen = async (senderId, recipientId) => {
    const pool = getPool();
    const [result] = await pool.execute(
        "UPDATE messages SET status = 'seen', seen_at = NOW() WHERE sender_id = ? AND recipient_id = ? AND status <> 'seen'",
        [senderId, recipientId]
    );
    return result.affectedRows;
};

const updateMessage = async (id, userId, text) => {
    const [result] = await getPool().execute("UPDATE messages SET text = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ? AND sender_id = ?", [text, id, userId]);
    if (!result.affectedRows) return null;
    const [rows] = await getPool().execute("SELECT * FROM messages WHERE id = ?", [id]);
    return mapMessage(rows[0]);
};

const deleteMessage = async (id, userId, everyone = false) => {
    const pool = getPool();
    const cleanId = Number(id);
    if (!cleanId) return null;

    const userVars = getPhoneVariants(userId);
    const placeholders = userVars.map(() => "?").join(",");

    if (everyone) {
        // Only sender can delete for everyone
        const [result] = await pool.execute(
            `UPDATE messages 
             SET text = 'This message was deleted', type = 'deleted', media_url = NULL 
             WHERE id = ? AND sender_id IN (${placeholders})`,
            [cleanId, ...userVars]
        );

        if (result.affectedRows === 0) return null;

        const [rows] = await pool.execute("SELECT * FROM messages WHERE id = ?", [cleanId]);
        return rows[0] ? mapMessage(rows[0]) : null;
    }

    // Delete for me: record deletion for all phone variations of current user
    for (const u of userVars) {
        await pool.execute(
            "INSERT IGNORE INTO message_deletions (message_id, user_id) VALUES (?, ?)",
            [cleanId, u]
        );
    }
    return { id: String(cleanId), deletedForMe: true };
};

const getConversation = async (userId, otherUserId) => {
    const pool = getPool();
    const userVars = getPhoneVariants(userId);
    const otherVars = getPhoneVariants(otherUserId);
    if (!userVars.length || !otherVars.length) return [];

    const uPlaceholders = userVars.map(() => "?").join(",");
    const oPlaceholders = otherVars.map(() => "?").join(",");

    const [rows] = await pool.execute(
        `SELECT m.* FROM messages m
         WHERE ((sender_id IN (${uPlaceholders}) AND recipient_id IN (${oPlaceholders})) 
             OR (sender_id IN (${oPlaceholders}) AND recipient_id IN (${uPlaceholders})))
           AND NOT EXISTS (
               SELECT 1 FROM message_deletions d 
               WHERE d.message_id = m.id AND d.user_id IN (${uPlaceholders})
           )
         ORDER BY m.id ASC`,
        [...userVars, ...otherVars, ...otherVars, ...userVars, ...userVars]
    );
    return rows.map(mapMessage);
};

const updateLastSeen = async (id) => {
    const cleanId = String(id || "").trim();
    if (!cleanId) return;
    const withPlus = cleanId.startsWith("+") ? cleanId : `+${cleanId}`;
    try {
        await getPool().execute(
            `UPDATE users SET last_seen = NOW() WHERE id = ? OR full_phone = ? OR full_phone = ?`,
            [cleanId, cleanId, withPlus]
        );
    } catch (err) {
        console.error("updateLastSeen error:", err);
    }
};

module.exports = {
    addMessage,
    findOrCreateContact,
    markMessagesAsDelivered,
    markMessagesAsSeen,
    getConversation,
    createUser,
    getUser,
    authenticateUser,
    updateUser,
    updateLastSeen,
    listConversations,
    searchUsersByPhone,
    updateMessage,
    deleteMessage,
    blockUser,
    unblockUser,
    getBlockStatus,
    getBlockedUsers
};

const { getPool } = require("../config/database");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.join(__dirname, "../../uploads");

const ensureUploadDirs = () => {
    const dirs = ["voice", "images", "media", "status", "avatars"];
    dirs.forEach((d) => {
        const full = path.join(UPLOAD_ROOT, d);
        if (!fs.existsSync(full)) {
            fs.mkdirSync(full, { recursive: true });
        }
    });
};
ensureUploadDirs();

const saveMediaBase64 = async (mediaUrl, type = "media") => {
    if (!mediaUrl || typeof mediaUrl !== "string" || !mediaUrl.startsWith("data:")) {
        return mediaUrl;
    }

    try {
        const matches = mediaUrl.match(/^data:([A-Za-z-+\/0-9;=_-]+);base64,([\s\S]+)$/);
        if (!matches || matches.length !== 3) {
            return mediaUrl;
        }

        const mimeType = matches[1].toLowerCase();
        const base64Data = matches[2].replace(/\s/g, "");
        const buffer = Buffer.from(base64Data, "base64");

        // Discard recordings that are too small to be valid audio (< 1KB)
        if (mimeType.includes("audio") || type === "voice") {
            if (buffer.length < 1000) {
                console.warn(`Discarding tiny audio blob: ${buffer.length} bytes`);
                return null;
            }
        }

        let subDir = "media";
        let ext = "bin";

        if (mimeType.includes("audio") || type === "voice") {
            subDir = "voice";
            if (mimeType.includes("webm")) ext = "webm";
            else if (mimeType.includes("mp4")) ext = "mp4";
            else if (mimeType.includes("ogg")) ext = "ogg";
            else if (mimeType.includes("wav")) ext = "wav";
            else if (mimeType.includes("aac")) ext = "aac";
            else ext = "webm";
        } else if (mimeType.includes("image") || type === "image") {
            subDir = "images";
            if (mimeType.includes("png")) ext = "png";
            else if (mimeType.includes("webp")) ext = "webp";
            else if (mimeType.includes("gif")) ext = "gif";
            else ext = "jpg";
        }

        const uploadDir = path.join(UPLOAD_ROOT, subDir);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `${subDir}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const filePath = path.join(uploadDir, filename);

        fs.writeFileSync(filePath, buffer);
        return `/api/chat/media/${subDir}/${filename}`;
    } catch (err) {
        console.error("Error saving media file to disk:", err.message);
        return mediaUrl;
    }
};

const mapMessage = (row) => ({
    id: String(row.id),
    from: row.sender_id,
    to: row.recipient_id,
    text: row.text,
    type: row.type || "text",
    status: row.status || "sent",
    mediaUrl: row.media_url || null,
    originalText: row.original_text || null,
    replyToId: row.reply_to_id ? String(row.reply_to_id) : null,
    replyToText: row.reply_to_text || null,
    replyToSender: row.reply_to_sender || null,
    reactions: row.reactions ? (typeof row.reactions === 'string' ? JSON.parse(row.reactions) : row.reactions) : {},
    isPinned: Boolean(row.is_pinned),
    deliveredAt: row.delivered_at,
    seenAt: row.seen_at,
    editedAt: row.edited_at,
    createdAt: row.created_at
});

const mapGroupMessage = (row) => ({
    id: String(row.id),
    groupId: String(row.group_id),
    from: row.sender_id,
    text: row.text,
    type: row.type || "text",
    mediaUrl: row.media_url || null,
    replyToId: row.reply_to_id ? String(row.reply_to_id) : null,
    mentions: row.mentions ? JSON.parse(row.mentions) : [],
    reactions: row.reactions ? JSON.parse(row.reactions) : {},
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at
});

const hashPassword = (password) => crypto.createHash("sha256").update(password).digest("hex");

const createUser = async ({ name, countryCode = "+91", phone = "", fullPhone, password }) => {
    const pool = getPool();
    const finalPhone = fullPhone || phone;
    const [result] = await pool.execute(
        "INSERT INTO users (name, country_code, phone, full_phone, password_hash) VALUES (?, ?, ?, ?, ?)",
        [name || finalPhone, countryCode, phone, finalPhone, password ? hashPassword(password) : null]
    );
    return getUser(result.insertId);
};

const findOrCreateContact = async ({ id, fullPhone, phone, countryCode, name }) => {
    const pool = getPool();
    const cleanFullPhone = String(fullPhone || id || "").trim();
    const cleanPhone = String(phone || "").trim();
    const cleanCountry = String(countryCode || "+91").trim();
    const cleanName = String(name || cleanFullPhone).trim();

    const [rows] = await pool.execute(
        "SELECT id, name, country_code AS countryCode, phone, full_phone AS fullPhone, about, avatar, last_seen AS lastSeen FROM users WHERE full_phone = ? OR phone = ? LIMIT 1",
        [cleanFullPhone, cleanFullPhone]
    );

    if (rows.length > 0) {
        return {
            ...rows[0],
            id: Number(rows[0].id)
        };
    }

    const [insertResult] = await pool.execute(
        `INSERT INTO users (name, country_code, phone, full_phone, last_seen)
         VALUES (?, ?, ?, ?, NOW())`,
        [cleanName, cleanCountry, cleanPhone, cleanFullPhone]
    );

    const [newRows] = await pool.execute(
        "SELECT id, name, country_code AS countryCode, phone, full_phone AS fullPhone, about, avatar, last_seen AS lastSeen FROM users WHERE id = ?",
        [insertResult.insertId]
    );
    return {
        ...newRows[0],
        id: Number(newRows[0].id)
    };
};

const getPhoneVariants = (id) => {
    const clean = String(id || "").trim();
    if (!clean) return [];

    const variants = new Set();
    variants.add(clean);

    const withPlus = clean.startsWith("+") ? clean : `+${clean}`;
    const withoutPlus = clean.replace(/^\+/, "");
    variants.add(withPlus);
    variants.add(withoutPlus);

    // Extract digits
    const digits = clean.replace(/\D/g, "");
    if (digits) {
        variants.add(digits);
        variants.add(`+${digits}`);

        // If 10 digits (e.g. 9876543210)
        if (digits.length === 10) {
            variants.add(`+91${digits}`);
            variants.add(`91${digits}`);
        }

        // If 12 digits starting with 91 (e.g. 919876543210)
        if (digits.length === 12 && digits.startsWith("91")) {
            const last10 = digits.slice(2);
            variants.add(last10);
            variants.add(`+${last10}`);
            variants.add(`+91${last10}`);
            variants.add(`91${last10}`);
        }

        // If greater than 10 digits, also include last 10 digits
        if (digits.length > 10) {
            const last10 = digits.slice(-10);
            variants.add(last10);
            variants.add(`+${last10}`);
            variants.add(`+91${last10}`);
            variants.add(`91${last10}`);
        }
    }

    return Array.from(variants).filter(Boolean);
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
    if (!cleanId) return null;
    const withPlus = cleanId.startsWith("+") ? cleanId : `+${cleanId}`;

    const [rows] = await getPool().execute(
        `SELECT 
            id, 
            COALESCE(name, full_phone, CAST(id AS CHAR)) AS name, 
            country_code AS countryCode, 
            phone, 
            COALESCE(full_phone, phone, CAST(id AS CHAR)) AS fullPhone, 
            about, 
            avatar, 
            COALESCE(avatar_privacy, 'everyone') AS avatarPrivacy, 
            last_seen AS lastSeen 
         FROM users 
         WHERE id = ? OR full_phone = ? OR full_phone = ? OR phone = ?
         LIMIT 1`,
        [cleanId, cleanId, withPlus, cleanId]
    );
    if (!rows[0]) return null;

    const user = {
        ...rows[0],
        id: Number(rows[0].id)
    };
    user.profileName = user.name;
    user.customName = null;
    if (!user.avatarPrivacy) user.avatarPrivacy = 'everyone';
    user.isBlockedByMe = false;
    user.isBlockedByThem = false;

    // Default name for other users is fullPhone unless self or custom alias
    if (viewerId) {
        const cleanViewer = String(viewerId || "").trim();
        const isSelf = cleanViewer === String(user.id) || cleanViewer === user.fullPhone || cleanViewer === user.phone;

        if (isSelf) {
            user.name = user.profileName;
        } else {
            // Fetch custom contact name set by viewer for this user (personal alias)
            const viewerVars = getPhoneVariants(cleanViewer);
            const contactVars = Array.from(new Set([
                String(user.id),
                ...getPhoneVariants(user.fullPhone),
                ...getPhoneVariants(user.phone)
            ]));

            if (viewerVars.length && contactVars.length) {
                const vPlaceholders = viewerVars.map(() => "?").join(",");
                const cPlaceholders = contactVars.map(() => "?").join(",");
                const [cRows] = await getPool().execute(
                    `SELECT custom_name AS customName FROM contacts 
                     WHERE user_id IN (${vPlaceholders}) AND contact_id IN (${cPlaceholders}) 
                     LIMIT 1`,
                    [...viewerVars, ...contactVars]
                );
                if (cRows[0] && cRows[0].customName) {
                    user.customName = cRows[0].customName;
                    user.name = cRows[0].customName;
                } else {
                    user.name = user.fullPhone || user.phone || user.profileName;
                }
            } else {
                user.name = user.fullPhone || user.phone || user.profileName;
            }

            const blockStatus = await getBlockStatus(cleanViewer, user.fullPhone || user.id);
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
                    [cleanViewer, user.fullPhone || user.id, user.fullPhone || user.id, cleanViewer]
                );
                if (chatCount.length === 0) {
                    user.avatar = null;
                }
            }
        }
    } else {
        user.name = user.fullPhone || user.phone || user.profileName;
    }

    return user;
};

const authenticateUser = async ({ id, password }) => {
    const cleanId = String(id || "").trim();
    const withPlus = cleanId.startsWith("+") ? cleanId : `+${cleanId}`;
    const [rows] = await getPool().execute(
        "SELECT id, COALESCE(full_phone, CAST(id AS CHAR)) AS name, full_phone AS fullPhone, about, avatar, COALESCE(avatar_privacy, 'everyone') AS avatarPrivacy, last_seen AS lastSeen FROM users WHERE id = ? OR full_phone = ? OR full_phone = ?",
        [cleanId, cleanId, withPlus]
    );
    if (rows[0]) {
        await getPool().execute("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", [rows[0].id]);
        return {
            ...rows[0],
            id: Number(rows[0].id)
        };
    }
    return null;
};

/**
 * Update user profile (Name, About/Status, Avatar, Avatar Privacy)
 */
const updateUser = async (id, { name, about, avatar, avatarPrivacy }) => {
    const cleanId = String(id || "").trim();
    const withPlus = cleanId.startsWith("+") ? cleanId : `+${cleanId}`;

    const existing = await getUser(cleanId);
    if (!existing) {
        return null;
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
 * Save or remove custom contact name (Per-user private alias)
 */
const saveCustomContactName = async (userId, contactId, customName) => {
    const pool = getPool();
    const cleanUserId = String(userId || "").trim();
    const cleanContactId = String(contactId || "").trim();
    const nameToSave = String(customName || "").trim();

    if (!cleanUserId || !cleanContactId) return null;

    const userVars = getPhoneVariants(cleanUserId);
    const contactVars = getPhoneVariants(cleanContactId);

    // Delete existing custom alias for all variations to prevent multiple rows
    for (const u of userVars) {
        for (const c of contactVars) {
            await pool.execute(
                "DELETE FROM contacts WHERE user_id = ? AND contact_id = ?",
                [u, c]
            );
        }
    }

    if (nameToSave) {
        for (const u of userVars) {
            await pool.execute(
                `INSERT INTO contacts (user_id, contact_id, custom_name)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE custom_name = VALUES(custom_name)`,
                [u, cleanContactId, nameToSave]
            );
        }
    }

    return { userId: cleanUserId, contactId: cleanContactId, customName: nameToSave };
};

/**
 * List active conversations for a user with per-user custom contact alias support (Guaranteed unique).
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
            COALESCE(
                (
                    SELECT c.custom_name FROM contacts c 
                    WHERE c.user_id IN (${placeholders}) 
                      AND (c.contact_id = contact.id OR c.contact_id = u.full_phone OR c.contact_id = u.phone OR c.contact_id = u.id)
                    LIMIT 1
                ),
                u.full_phone,
                contact.id
            ) AS name,
            (
                SELECT c.custom_name FROM contacts c 
                WHERE c.user_id IN (${placeholders}) 
                  AND (c.contact_id = contact.id OR c.contact_id = u.full_phone OR c.contact_id = u.phone OR c.contact_id = u.id)
                LIMIT 1
            ) AS customName,
            u.name AS profileName,
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
            m.type AS lastMessageType,
            COALESCE(unread.unread_count, 0) AS unreadCount
         FROM (
            SELECT DISTINCT 
                CASE 
                    WHEN sender_id IN (${placeholders}) THEN recipient_id 
                    ELSE sender_id 
                END AS id
            FROM messages
            WHERE (sender_id IN (${placeholders}) OR recipient_id IN (${placeholders}))
              AND NOT EXISTS (
                  SELECT 1 FROM message_deletions d 
                  WHERE d.message_id = messages.id AND d.user_id IN (${placeholders})
              )
         ) AS contact
         LEFT JOIN users u ON (u.id = contact.id OR u.full_phone = contact.id OR u.phone = contact.id)
          LEFT JOIN messages m ON m.id = (
            SELECT sub_m.id FROM messages sub_m
            WHERE ((sub_m.sender_id IN (${placeholders}) AND (sub_m.recipient_id = contact.id OR sub_m.recipient_id = u.full_phone OR sub_m.recipient_id = u.phone))
               OR ((sub_m.sender_id = contact.id OR sub_m.sender_id = u.full_phone OR sub_m.sender_id = u.phone) AND sub_m.recipient_id IN (${placeholders})))
              AND NOT EXISTS (
                  SELECT 1 FROM message_deletions d 
                  WHERE d.message_id = sub_m.id AND d.user_id IN (${placeholders})
              )
            ORDER BY sub_m.id DESC
            LIMIT 1
          )
         LEFT JOIN (
            SELECT 
                sender_id AS contact_sender_id,
                COUNT(*) AS unread_count
            FROM messages msg
            WHERE recipient_id IN (${placeholders}) 
              AND status <> 'seen'
              AND type <> 'deleted'
              AND NOT EXISTS (
                  SELECT 1 FROM message_deletions d 
                  WHERE d.message_id = msg.id AND d.user_id IN (${placeholders})
              )
            GROUP BY sender_id
         ) AS unread ON (unread.contact_sender_id = contact.id OR unread.contact_sender_id = u.full_phone OR unread.contact_sender_id = u.phone)
         WHERE m.id IS NOT NULL
         ORDER BY m.created_at DESC, m.id DESC`,
        [
            ...userVars, // 1: scalar subquery name - c.user_id IN
            ...userVars, // 2: scalar subquery customName - c.user_id IN
            ...userVars, // 3: contact subquery - CASE WHEN sender_id IN
            ...userVars, // 4: contact subquery - WHERE sender_id IN
            ...userVars, // 5: contact subquery - OR recipient_id IN
            ...userVars, // 6: contact subquery - NOT EXISTS message_deletions
            ...userVars, // 7: m subquery - sub_m.sender_id IN
            ...userVars, // 8: m subquery - sub_m.recipient_id IN
            ...userVars, // 9: m subquery - NOT EXISTS message_deletions
            ...userVars, // 10: unread subquery - WHERE recipient_id IN
            ...userVars  // 11: unread subquery - NOT EXISTS message_deletions
        ]
    );

    const conversations = await Promise.all(
        rows.map(async (conv) => {
            const blockStatus = await getBlockStatus(cleanUserId, conv.id);
            const isBlockedByMe = blockStatus.isBlockedByMe;
            const isBlockedByThem = blockStatus.isBlockedByThem;

            return {
                ...conv,
                unreadCount: Number(conv.unreadCount || 0),
                isBlockedByMe,
                isBlockedByThem,
                avatar: isBlockedByMe || isBlockedByThem ? null : conv.avatar,
                about: isBlockedByMe || isBlockedByThem ? '' : conv.about,
                lastSeen: isBlockedByThem ? null : conv.lastSeen
            };
        })
    );

    // Guarantee strictly unique conversation entries per phone number
    const seen = new Set();
    const uniqueConversations = [];
    for (const conv of conversations) {
        const rawPhone = conv.fullPhone || conv.phone || conv.id || "";
        const digits = rawPhone.replace(/\D/g, "");
        const key = digits || rawPhone;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueConversations.push(conv);
        }
    }

    return uniqueConversations;
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
            COALESCE(c.custom_name, u.full_phone, CAST(u.id AS CHAR)) AS name,
            c.custom_name AS customName,
            u.name AS profileName,
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
                        WHERE (m.sender_id = u.full_phone AND m.recipient_id = ?) 
                           OR (m.sender_id = ? AND m.recipient_id = u.full_phone)
                    ) THEN u.avatar ELSE NULL END
                )
                ELSE u.avatar
            END AS avatar,
            u.last_seen AS lastSeen
         FROM users u
         LEFT JOIN contacts c ON (
             c.user_id = ? 
             AND (c.contact_id = CAST(u.id AS CHAR) OR c.contact_id = u.full_phone OR c.contact_id = u.phone)
         )
         WHERE (
            u.full_phone = ? 
            OR u.full_phone = ? 
            OR u.phone = ? 
            OR CAST(u.id AS CHAR) = ?
            OR u.full_phone LIKE ?
            OR u.phone LIKE ?
            OR u.name LIKE ?
            OR c.custom_name LIKE ?
         )
         AND u.full_phone <> ?
         AND CAST(u.id AS CHAR) <> ?
         ORDER BY 
            (CASE WHEN u.full_phone = ? OR u.phone = ? THEN 1 ELSE 2 END),
            u.id ASC
         LIMIT 20`,
        [
            cleanCurrentUserId,
            cleanCurrentUserId,
            cleanCurrentUserId,
            query,
            withPlus,
            digitsOnly,
            query,
            `%${digitsOnly || query}%`,
            `%${digitsOnly || query}%`,
            `%${query}%`,
            `%${query}%`,
            cleanCurrentUserId,
            cleanCurrentUserId,
            query,
            digitsOnly
        ]
    );

    return rows.map(r => ({
        ...r,
        id: Number(r.id)
    }));
};

const addMessage = async ({ from, to, text, type = "text", status = "sent", mediaUrl = null, replyToId = null, replyToText = null, replyToSender = null }) => {
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

    const savedMediaUrl = await saveMediaBase64(mediaUrl, type);

    // Reject voice messages where audio blob was too small/invalid
    if (type === 'voice' && mediaUrl && !savedMediaUrl) {
        throw new Error('Voice recording was too short or invalid. Please try again.');
    }

    const deliveredAt = status === "delivered" ? new Date() : null;

    const [result] = await getPool().execute(
        "INSERT INTO messages (sender_id, recipient_id, text, type, status, media_url, reply_to_id, reply_to_text, reply_to_sender, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [from, to, text, type, status, savedMediaUrl, replyToId ? Number(replyToId) : null, replyToText || null, replyToSender || null, deliveredAt]
    );
    const [rows] = await getPool().execute("SELECT * FROM messages WHERE id = ?", [result.insertId]);
    return mapMessage(rows[0]);
};

const reactToMessage = async (messageId, userId, emoji) => {
    const cleanId = Number(messageId);
    if (!cleanId) throw new Error("Invalid message ID");
    const [rows] = await getPool().execute("SELECT reactions, sender_id, recipient_id FROM messages WHERE id = ?", [cleanId]);
    if (!rows[0]) throw new Error("Message not found");
    const reactions = rows[0].reactions ? (typeof rows[0].reactions === 'string' ? JSON.parse(rows[0].reactions) : rows[0].reactions) : {};
    const cleanEmoji = String(emoji || "❤️");
    reactions[cleanEmoji] = Array.isArray(reactions[cleanEmoji]) ? reactions[cleanEmoji] : [];
    const isAlready = reactions[cleanEmoji].includes(String(userId));
    if (isAlready) {
        reactions[cleanEmoji] = reactions[cleanEmoji].filter((id) => id !== String(userId));
        if (reactions[cleanEmoji].length === 0) delete reactions[cleanEmoji];
    } else {
        Object.keys(reactions).forEach((k) => {
            reactions[k] = reactions[k].filter((id) => id !== String(userId));
            if (reactions[k].length === 0) delete reactions[k];
        });
        reactions[cleanEmoji] = reactions[cleanEmoji] || [];
        reactions[cleanEmoji].push(String(userId));
    }
    await getPool().execute("UPDATE messages SET reactions = ? WHERE id = ?", [JSON.stringify(reactions), cleanId]);
    return {
        messageId: String(cleanId),
        reactions,
        senderId: rows[0].sender_id,
        recipientId: rows[0].recipient_id
    };
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
    const senderVars = getPhoneVariants(senderId);
    const recipientVars = getPhoneVariants(recipientId);
    if (!senderVars.length || !recipientVars.length) return 0;
    const sPlaceholders = senderVars.map(() => "?").join(",");
    const rPlaceholders = recipientVars.map(() => "?").join(",");
    const [result] = await pool.execute(
        `UPDATE messages SET status = 'seen', seen_at = NOW() 
         WHERE sender_id IN (${sPlaceholders}) AND recipient_id IN (${rPlaceholders}) AND status <> 'seen'`,
        [...senderVars, ...recipientVars]
    );
    return result.affectedRows;
};

const updateMessage = async (id, userId, text) => {
    const pool = getPool();
    const cleanId = Number(id);
    const cleanText = String(text || "").trim();
    if (!cleanId || !cleanText) return null;

    const userVars = getPhoneVariants(userId);
    const placeholders = userVars.map(() => "?").join(",");

    // Preserve original text on first edit
    const [result] = await pool.execute(
        `UPDATE messages 
         SET original_text = COALESCE(original_text, text),
             text = ?, 
             edited_at = NOW() 
         WHERE id = ? AND sender_id IN (${placeholders}) AND type <> 'deleted'`,
        [cleanText, cleanId, ...userVars]
    );

    if (!result.affectedRows) return null;
    const [rows] = await pool.execute("SELECT * FROM messages WHERE id = ?", [cleanId]);
    return rows[0] ? mapMessage(rows[0]) : null;
};

const updateMessagePin = async (id, userId, pinned, isGroup = false, groupId = null) => {
    const cleanId = Number(id);
    if (!cleanId) return null;

    if (isGroup) {
        const cleanGroupId = Number(String(groupId || '').replace(/^group:/, ''));
        if (!cleanGroupId || !(await isGroupMember(cleanGroupId, userId))) return null;
        const [result] = await getPool().execute(
            "UPDATE group_messages SET is_pinned = ? WHERE id = ? AND group_id = ?",
            [pinned ? 1 : 0, cleanId, cleanGroupId]
        );
        if (!result.affectedRows) return null;
        const [rows] = await getPool().execute("SELECT * FROM group_messages WHERE id = ? AND group_id = ?", [cleanId, cleanGroupId]);
        return rows[0] ? mapGroupMessage(rows[0]) : null;
    }

    const userVars = getPhoneVariants(userId);
    const placeholders = userVars.map(() => "?").join(",");
    const [result] = await getPool().execute(
        `UPDATE messages SET is_pinned = ?
         WHERE id = ? AND (sender_id IN (${placeholders}) OR recipient_id IN (${placeholders}))`,
        [pinned ? 1 : 0, cleanId, ...userVars, ...userVars]
    );
    if (!result.affectedRows) return null;
    const [rows] = await getPool().execute("SELECT * FROM messages WHERE id = ?", [cleanId]);
    return rows[0] ? mapMessage(rows[0]) : null;
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

/**
 * Delete / Clear an entire chat conversation for current user (Swipe to delete)
 */
const deleteConversation = async (userId, otherUserId) => {
    const pool = getPool();
    const userVars = getPhoneVariants(userId);
    const otherVars = getPhoneVariants(otherUserId);
    if (!userVars.length || !otherVars.length) return false;

    const uPlaceholders = userVars.map(() => "?").join(",");
    const oPlaceholders = otherVars.map(() => "?").join(",");

    // 1. Fetch all message IDs in this conversation
    const [msgRows] = await pool.execute(
        `SELECT id FROM messages 
         WHERE ((sender_id IN (${uPlaceholders}) AND recipient_id IN (${oPlaceholders}))
            OR (sender_id IN (${oPlaceholders}) AND recipient_id IN (${uPlaceholders})))`,
        [...userVars, ...otherVars, ...otherVars, ...userVars]
    );

    if (msgRows.length === 0) return true;

    // 2. Mark all these message IDs as deleted for all user variants
    for (const row of msgRows) {
        for (const u of userVars) {
            await pool.execute(
                "INSERT IGNORE INTO message_deletions (message_id, user_id) VALUES (?, ?)",
                [row.id, u]
            );
        }
    }

    return true;
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
         ORDER BY m.is_pinned DESC, m.id ASC`,
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

const getUnreadCount = async (userId) => {
    const pool = getPool();
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return { totalUnread: 0, bySender: {} };

    const userVars = getPhoneVariants(cleanUserId);
    const placeholders = userVars.map(() => "?").join(",");

    const [rows] = await pool.execute(
        `SELECT sender_id AS senderId, COUNT(*) AS count 
         FROM messages msg
         WHERE recipient_id IN (${placeholders}) 
           AND status <> 'seen' 
           AND type <> 'deleted' 
           AND NOT EXISTS (
               SELECT 1 FROM message_deletions d 
               WHERE d.message_id = msg.id AND d.user_id IN (${placeholders})
           )
         GROUP BY sender_id`,
        [...userVars, ...userVars]
    );

    let total = 0;
    const bySender = {};
    for (const r of rows) {
        const c = Number(r.count || 0);
        total += c;
        bySender[r.senderId] = c;
    }

    return { totalUnread: total, bySender };
};

/**
 * 8. Create a new call log entry
 */
const createCallLog = async ({ callerId, receiverId, callType = 'voice', status = 'missed', channelName = null, groupId = null, groupName = null, memberNames = [] }) => {
    const pool = getPool();
    const cleanCaller = String(callerId || "").trim();
    const cleanReceiver = String(receiverId || "").trim();
    if (!cleanCaller || !cleanReceiver) return null;

    const [result] = await pool.execute(
        `INSERT INTO call_logs (caller_id, receiver_id, call_type, status, channel_name, group_id, group_name, member_names, duration, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
        [cleanCaller, cleanReceiver, callType, status, channelName, groupId ? Number(groupId) : null, groupName || null, JSON.stringify(Array.isArray(memberNames) ? memberNames.slice(0, 3) : [])]
    );

    return {
        id: result.insertId,
        callerId: cleanCaller,
        receiverId: cleanReceiver,
        callType,
        status,
        channelName,
        duration: 0,
        createdAt: new Date()
    };
};

const toGroupId = (id) => {
    const clean = String(id || '').replace(/^group:/, '').trim();
    return Number(clean) || 0;
};

const getAllUserVariants = async (userId) => {
    const clean = String(userId || '').trim();
    if (!clean) return [];
    const rawVariants = new Set(getPhoneVariants(clean));
    try {
        const u = await getUser(clean);
        if (u) {
            if (u.id) rawVariants.add(String(u.id));
            if (u.phone) {
                getPhoneVariants(u.phone).forEach((v) => rawVariants.add(v));
            }
            if (u.fullPhone) {
                getPhoneVariants(u.fullPhone).forEach((v) => rawVariants.add(v));
            }
        }
    } catch (e) { }
    return Array.from(rawVariants).filter(Boolean);
};

const isGroupMember = async (groupId, userId) => {
    const cleanId = toGroupId(groupId);
    if (!cleanId || !userId) return null;
    const variants = await getAllUserVariants(userId);
    if (variants.length === 0) return null;
    const placeholders = variants.map(() => "?").join(",");
    const [rows] = await getPool().execute(
        `SELECT role, user_id AS userId FROM group_members WHERE group_id = ? AND user_id IN (${placeholders}) LIMIT 1`,
        [cleanId, ...variants]
    );
    return rows[0] || null;
};

const addGroupSystemMessage = async (groupId, payload) => {
    const cleanId = toGroupId(groupId);
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const [result] = await getPool().execute(
        "INSERT INTO group_messages (group_id, sender_id, text, type, mentions) VALUES (?, 'system', ?, 'system', '[]')",
        [cleanId, text]
    );
    const [rows] = await getPool().execute("SELECT * FROM group_messages WHERE id = ?", [result.insertId]);
    return mapGroupMessage(rows[0]);
};

const createGroup = async ({ name, creatorId, memberIds = [] }) => {
    const pool = getPool();
    const cleanName = String(name || "").trim();
    const cleanCreator = String(creatorId || "").trim();
    if (!cleanName || !cleanCreator) throw new Error("Group name and creator are required");

    const [result] = await pool.execute(
        "INSERT INTO chat_groups (name, creator_id) VALUES (?, ?)",
        [cleanName, cleanCreator]
    );
    const uniqueMembers = Array.from(new Set([cleanCreator, ...memberIds.map((id) => String(id || "").trim()).filter(Boolean)]));
    for (const memberId of uniqueMembers) {
        await pool.execute(
            "INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
            [result.insertId, memberId, memberId === cleanCreator ? "admin" : "member"]
        );
    }
    const creatorUser = await getUser(cleanCreator);
    const creatorName = creatorUser?.name || cleanCreator;
    await addGroupSystemMessage(result.insertId, {
        action: 'create_group',
        creatorId: cleanCreator,
        creatorName,
        groupName: cleanName
    });

    return getGroup(result.insertId, cleanCreator);
};

const getGroup = async (groupId, viewerId = null) => {
    const cleanId = toGroupId(groupId);
    const [rows] = await getPool().execute(
        `SELECT g.id, g.name, g.creator_id AS creatorId, g.avatar,
            g.message_permission AS messagePermission, g.created_at AS createdAt,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS memberCount
         FROM chat_groups g
         WHERE g.id = ? LIMIT 1`,
        [cleanId]
    );
    if (!rows[0]) return null;
    if (viewerId && !(await isGroupMember(groupId, viewerId))) return null;
    const [members] = await getPool().execute(
        `SELECT gm.user_id AS userId, gm.role, u.name, u.full_phone AS fullPhone, u.avatar
         FROM group_members gm LEFT JOIN users u ON (u.full_phone = gm.user_id OR u.phone = gm.user_id OR CAST(u.id AS CHAR) = gm.user_id)
         WHERE gm.group_id = ? ORDER BY gm.role DESC, gm.joined_at ASC`,
        [cleanId]
    );
    return { ...rows[0], id: String(rows[0].id), memberCount: Number(rows[0].memberCount), members };
};

const listGroups = async (userId) => {
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return [];
    const variants = getPhoneVariants(cleanUserId);
    const placeholders = variants.map(() => '?').join(', ');
    const notPlaceholders = variants.map(() => '?').join(', ');

    const [rows] = await getPool().execute(
        `SELECT g.id, g.name, g.creator_id AS creatorId, g.avatar,
            g.message_permission AS messagePermission, g.created_at AS createdAt,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS memberCount,
                m.text AS lastMessage, m.type AS lastMessageType, m.created_at AS lastMessageAt,
                (
                    SELECT COUNT(*) FROM group_messages gm2
                    WHERE gm2.group_id = g.id
                      AND gm2.id > COALESCE(mine.last_seen_message_id, 0)
                      AND gm2.sender_id NOT IN (${notPlaceholders})
                ) AS unreadCount
          FROM chat_groups g
          INNER JOIN group_members mine ON mine.group_id = g.id AND mine.user_id IN (${placeholders})
          LEFT JOIN group_messages m ON m.id = (SELECT MAX(m2.id) FROM group_messages m2 WHERE m2.group_id = g.id)
          GROUP BY g.id, mine.last_seen_message_id, m.id
          ORDER BY COALESCE(m.id, g.id) DESC`,
        [...variants, ...variants]
    );
    return rows.map((row) => ({
        ...row,
        id: `group:${row.id}`,
        groupId: String(row.id),
        memberCount: Number(row.memberCount || 0),
        unreadCount: Number(row.unreadCount || 0),
        isGroup: true
    }));
};

const markGroupMessagesAsSeen = async (groupId, userId) => {
    const cleanId = toGroupId(groupId);
    const cleanUserId = String(userId || "").trim();
    if (!cleanId || !cleanUserId) return 0;
    const variants = getPhoneVariants(cleanUserId);
    const placeholders = variants.map(() => '?').join(', ');

    const [maxRows] = await getPool().execute(
        "SELECT COALESCE(MAX(id), 0) AS maxId FROM group_messages WHERE group_id = ?",
        [cleanId]
    );
    const maxId = maxRows[0]?.maxId || 0;
    if (maxId > 0) {
        await getPool().execute(
            `UPDATE group_members SET last_seen_message_id = ? WHERE group_id = ? AND user_id IN (${placeholders})`,
            [maxId, cleanId, ...variants]
        );
    }
    return maxId;
};

const addGroupMember = async (groupId, requesterId, memberId) => {
    const cleanId = toGroupId(groupId);
    const requester = await isGroupMember(groupId, requesterId);
    if (!requester || requester.role !== "admin") throw new Error("Only group admins can add members");
    const user = await getUser(memberId);
    if (!user) throw new Error("User not found");
    const finalMemberId = user.fullPhone || user.phone || memberId;
    await getPool().execute("INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')", [cleanId, String(finalMemberId).trim()]);

    const requesterUser = await getUser(requesterId);
    const actorName = requesterUser?.name || requesterId;
    const targetName = user?.name || user?.fullPhone || memberId;

    const systemMsg = await addGroupSystemMessage(cleanId, {
        action: 'add_member',
        actorId: requesterId,
        actorName,
        targetId: finalMemberId,
        targetName
    });

    const group = await getGroup(cleanId, requesterId);
    return { group, systemMsg };
};

const removeGroupMember = async (groupId, requesterId, memberId) => {
    const cleanId = toGroupId(groupId);
    const requester = await isGroupMember(groupId, requesterId);
    if (!requester || requester.role !== "admin") throw new Error("Only group admins can remove members");

    const [groupRows] = await getPool().execute("SELECT creator_id AS creatorId FROM chat_groups WHERE id = ? LIMIT 1", [cleanId]);
    const creatorId = groupRows[0]?.creatorId;
    const creatorVariants = await getAllUserVariants(creatorId);
    const targetVariants = await getAllUserVariants(memberId);

    if (creatorId && targetVariants.some((v) => creatorVariants.includes(v))) {
        throw new Error("The group creator cannot be removed");
    }

    const placeholders = targetVariants.map(() => "?").join(",");
    if (targetVariants.length > 0) {
        await getPool().execute(
            `DELETE FROM group_members WHERE group_id = ? AND user_id IN (${placeholders})`,
            [cleanId, ...targetVariants]
        );
    }

    const requesterUser = await getUser(requesterId);
    const targetUser = await getUser(memberId);
    const actorName = requesterUser?.name || requesterId;
    const targetName = targetUser?.name || targetUser?.fullPhone || memberId;

    const systemMsg = await addGroupSystemMessage(cleanId, {
        action: 'remove_member',
        actorId: requesterId,
        actorName,
        targetId: memberId,
        targetName
    });

    const updatedGroup = await getGroup(cleanId, requesterId);
    return { group: updatedGroup, systemMsg };
};

const leaveGroup = async (groupId, userId) => {
    const cleanId = toGroupId(groupId);
    const userVariants = await getAllUserVariants(userId);
    if (userVariants.length === 0) throw new Error("User ID is invalid");

    const placeholders = userVariants.map(() => "?").join(",");
    const [existing] = await getPool().execute(
        `SELECT role, user_id FROM group_members WHERE group_id = ? AND user_id IN (${placeholders}) LIMIT 1`,
        [cleanId, ...userVariants]
    );
    if (!existing || existing.length === 0) {
        throw new Error("You are not a member of this group");
    }

    await getPool().execute(
        `DELETE FROM group_members WHERE group_id = ? AND user_id IN (${placeholders})`,
        [cleanId, ...userVariants]
    );

    // If remaining members exist and no admin left, promote the oldest member to admin
    const [remainingAdmins] = await getPool().execute(
        "SELECT user_id FROM group_members WHERE group_id = ? AND role = 'admin' LIMIT 1",
        [cleanId]
    );
    if (remainingAdmins.length === 0) {
        const [oldest] = await getPool().execute(
            "SELECT user_id FROM group_members WHERE group_id = ? ORDER BY joined_at ASC LIMIT 1",
            [cleanId]
        );
        if (oldest[0]) {
            await getPool().execute(
                "UPDATE group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?",
                [cleanId, oldest[0].user_id]
            );
        }
    }

    const user = await getUser(userId);
    const name = user?.name || user?.fullPhone || userId;
    const systemMsg = await addGroupSystemMessage(cleanId, {
        action: 'leave_group',
        userId,
        name,
        phone: user?.fullPhone || userId
    });

    return { success: true, systemMsg };
};

const joinGroupByInvite = async (groupId, memberId, joinMethod = 'link') => {
    const cleanId = toGroupId(groupId);
    const user = await getUser(memberId);
    if (!user) throw new Error("User not found");
    const [groupRows] = await getPool().execute("SELECT id FROM chat_groups WHERE id = ? LIMIT 1", [cleanId]);
    if (!groupRows[0]) throw new Error("Group not found");
    const memberVariants = getPhoneVariants(memberId);
    const placeholders = memberVariants.map(() => "?").join(",");
    const [existingRows] = await getPool().execute(
        `SELECT user_id FROM group_members WHERE group_id = ? AND user_id IN (${placeholders}) LIMIT 1`,
        [cleanId, ...memberVariants]
    );
    const alreadyMember = existingRows.length > 0;
    const finalMemberId = user.fullPhone || user.phone || memberId;
    let systemMsg = null;
    if (!alreadyMember) {
        await getPool().execute(
            "INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')",
            [cleanId, String(finalMemberId).trim()]
        );
        const action = joinMethod === 'qr' ? 'join_qr' : 'join_link';
        systemMsg = await addGroupSystemMessage(cleanId, {
            action,
            userId: finalMemberId,
            name: user.name || user.fullPhone || memberId,
            phone: user.fullPhone || memberId
        });
    }
    return { group: await getGroup(cleanId, memberId), alreadyMember, systemMsg };
};

const updateGroup = async (groupId, requesterId, { name, avatar, messagePermission }) => {
    const cleanId = toGroupId(groupId);
    const requester = await isGroupMember(cleanId, requesterId);
    if (!requester || requester.role !== "admin") throw new Error("Only group admins can change group settings");
    const cleanPermission = messagePermission === "admins" ? "admins" : messagePermission === "everyone" ? "everyone" : null;
    await getPool().execute(
        `UPDATE chat_groups SET
            name = COALESCE(?, name),
            avatar = COALESCE(?, avatar),
            message_permission = COALESCE(?, message_permission)
         WHERE id = ?`,
        [name !== undefined ? String(name).trim() || null : null, avatar !== undefined ? avatar : null, cleanPermission, cleanId]
    );
    return getGroup(cleanId, requesterId);
};

const updateGroupMemberRole = async (groupId, requesterId, memberId, role) => {
    const cleanId = toGroupId(groupId);
    const requester = await isGroupMember(cleanId, requesterId);
    const [groupRows] = await getPool().execute("SELECT creator_id AS creatorId FROM chat_groups WHERE id = ? LIMIT 1", [cleanId]);
    const creatorId = groupRows[0]?.creatorId;
    if (!requester || !creatorId || !['admin'].includes(requester.role)) {
        throw new Error("Only group admins can manage group admins");
    }
    if (getPhoneVariants(memberId).includes(String(creatorId))) {
        throw new Error("The super admin role cannot be removed");
    }
    const target = await isGroupMember(cleanId, memberId);
    if (!target) throw new Error("User is not a group member");
    const nextRole = role === "admin" ? "admin" : "member";
    await getPool().execute("UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?", [nextRole, cleanId, String(memberId).trim()]);
    return getGroup(cleanId, requesterId);
};

const getGroupMessages = async (groupId, userId) => {
    const cleanId = toGroupId(groupId);
    if (!(await isGroupMember(cleanId, userId))) return [];
    const [rows] = await getPool().execute("SELECT * FROM group_messages WHERE group_id = ? ORDER BY is_pinned DESC, id ASC", [cleanId]);
    return rows.map(mapGroupMessage);
};

const addGroupMessage = async ({ groupId, senderId, text, type = "text", mediaUrl = null, replyToId = null, mentions = [] }) => {
    const cleanId = toGroupId(groupId);
    const membership = await isGroupMember(cleanId, senderId);
    if (!membership) throw new Error("You are not a member of this group");
    const [groupRows] = await getPool().execute("SELECT message_permission AS messagePermission FROM chat_groups WHERE id = ? LIMIT 1", [cleanId]);
    if (groupRows[0]?.messagePermission === "admins" && membership.role !== "admin") {
        throw new Error("Only group admins can send messages in this group");
    }
    const savedMediaUrl = await saveMediaBase64(mediaUrl, type);
    const [result] = await getPool().execute(
        "INSERT INTO group_messages (group_id, sender_id, text, type, media_url, reply_to_id, mentions) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [cleanId, String(senderId).trim(), String(text || ""), type, savedMediaUrl, replyToId ? Number(replyToId) : null, JSON.stringify(Array.isArray(mentions) ? mentions : [])]
    );
    const [rows] = await getPool().execute("SELECT * FROM group_messages WHERE id = ?", [result.insertId]);
    return mapGroupMessage(rows[0]);
};

const reactToGroupMessage = async (groupId, messageId, userId, emoji) => {
    const cleanId = toGroupId(groupId);
    if (!(await isGroupMember(cleanId, userId))) throw new Error("You are not a member of this group");
    const [rows] = await getPool().execute("SELECT reactions FROM group_messages WHERE id = ? AND group_id = ?", [Number(messageId), cleanId]);
    if (!rows[0]) throw new Error("Message not found");
    const reactions = rows[0].reactions ? JSON.parse(rows[0].reactions) : {};
    const cleanEmoji = String(emoji || "👍");
    reactions[cleanEmoji] = Array.isArray(reactions[cleanEmoji]) ? reactions[cleanEmoji] : [];
    reactions[cleanEmoji] = reactions[cleanEmoji].filter((id) => id !== String(userId));
    reactions[cleanEmoji].push(String(userId));
    await getPool().execute("UPDATE group_messages SET reactions = ? WHERE id = ? AND group_id = ?", [JSON.stringify(reactions), Number(messageId), cleanId]);
    return reactions;
};

/**
 * 9. Update an existing call log entry (e.g. status, duration, memberNames)
 */
const updateCallLog = async (callId, { status, duration, memberNames }) => {
    const pool = getPool();
    const cleanId = Number(callId);
    if (!cleanId) return null;

    let memberNamesStr = null;
    if (memberNames !== undefined) {
        memberNamesStr = typeof memberNames === 'string' ? memberNames : JSON.stringify(memberNames);
    }

    await pool.execute(
        `UPDATE call_logs 
         SET status = COALESCE(?, status),
             duration = COALESCE(?, duration),
             member_names = COALESCE(?, member_names)
         WHERE id = ?`,
        [
            status !== undefined ? status : null,
            duration !== undefined ? Number(duration) : null,
            memberNamesStr,
            cleanId
        ]
    );

    const [rows] = await pool.execute("SELECT * FROM call_logs WHERE id = ? LIMIT 1", [cleanId]);
    return rows[0] || null;
};

/**
 * 10. Get all call logs for a user with peer details and custom contact names
 */
const getCallLogs = async (userId) => {
    const pool = getPool();
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return [];

    const userVars = getPhoneVariants(cleanUserId);
    const placeholders = userVars.map(() => "?").join(",");

    const [rows] = await pool.execute(
        `SELECT 
            cl.id,
            cl.caller_id AS callerId,
            cl.receiver_id AS receiverId,
            cl.call_type AS callType,
            cl.status AS rawStatus,
            cl.duration,
            cl.channel_name AS channelName,
            cl.created_at AS createdAt,
            CASE 
                WHEN cl.caller_id IN (${placeholders}) THEN cl.receiver_id 
                ELSE cl.caller_id 
            END AS peerId,
            CASE 
                WHEN cl.caller_id IN (${placeholders}) THEN 'outgoing'
                WHEN cl.status = 'missed' THEN 'missed'
                WHEN cl.status = 'declined' THEN 'declined'
                ELSE 'incoming'
            END AS direction,
            COALESCE(c.custom_name, (
                CASE WHEN cl.caller_id IN (${placeholders}) THEN cl.receiver_id ELSE cl.caller_id END
            )) AS peerName,
            c.custom_name AS customName,
            u.name AS profileName,
            COALESCE(u.full_phone, u.phone, (
                CASE WHEN cl.caller_id IN (${placeholders}) THEN cl.receiver_id ELSE cl.caller_id END
            )) AS peerPhone,
            u.avatar AS peerAvatar,
            COALESCE(u.avatar_privacy, 'everyone') AS avatarPrivacy,
            u.last_seen AS lastSeen
         FROM call_logs cl
         LEFT JOIN users u ON (
             u.id = (CASE WHEN cl.caller_id IN (${placeholders}) THEN cl.receiver_id ELSE cl.caller_id END)
             OR u.full_phone = (CASE WHEN cl.caller_id IN (${placeholders}) THEN cl.receiver_id ELSE cl.caller_id END)
             OR u.phone = (CASE WHEN cl.caller_id IN (${placeholders}) THEN cl.receiver_id ELSE cl.caller_id END)
         )
         LEFT JOIN contacts c ON (
             c.user_id IN (${placeholders}) 
             AND (
                 c.contact_id = (CASE WHEN cl.caller_id IN (${placeholders}) THEN cl.receiver_id ELSE cl.caller_id END)
                 OR c.contact_id = u.full_phone 
                 OR c.contact_id = u.phone
             )
         )
         WHERE cl.group_id IS NULL AND (cl.caller_id IN (${placeholders}) OR cl.receiver_id IN (${placeholders}))
         ORDER BY cl.id DESC
         LIMIT 100`,
        [
            ...userVars, // 1: peerId CASE
            ...userVars, // 2: direction CASE
            ...userVars, // 3: peerName CASE
            ...userVars, // 4: peerPhone CASE
            ...userVars, // 5: LEFT JOIN users id CASE
            ...userVars, // 6: LEFT JOIN users full_phone CASE
            ...userVars, // 7: LEFT JOIN users phone CASE
            ...userVars, // 8: LEFT JOIN contacts c.user_id IN
            ...userVars, // 9: LEFT JOIN contacts c.contact_id CASE
            ...userVars, // 10: WHERE cl.caller_id IN
            ...userVars  // 11: WHERE cl.receiver_id IN
        ]
    );

    const [groupRows] = await getPool().execute(
        `SELECT cl.id, cl.caller_id AS callerId, cl.call_type AS callType, cl.status AS rawStatus,
                cl.duration, cl.created_at AS createdAt, cl.group_id AS groupId,
                COALESCE(cl.group_name, g.name, CONCAT('Group ', cl.group_id)) AS groupName,
                cl.member_names AS memberNames
         FROM call_logs cl
         JOIN group_members gm ON gm.group_id = cl.group_id AND gm.user_id IN (${placeholders})
         LEFT JOIN chat_groups g ON g.id = cl.group_id
         WHERE cl.group_id IS NOT NULL
         ORDER BY cl.id DESC LIMIT 100`,
        userVars
    );

    const personalCalls = rows.map((r) => {
        const isMissed = r.direction === 'missed' || (r.direction === 'incoming' && r.rawStatus === 'missed');
        return {
            id: Number(r.id),
            callerId: r.callerId,
            receiverId: r.receiverId,
            peerId: r.peerId,
            peerName: r.peerName || r.peerId,
            customName: r.customName || null,
            profileName: r.profileName || null,
            peerPhone: r.peerPhone || r.peerId,
            peerAvatar: r.avatarPrivacy === 'nobody' ? null : r.peerAvatar,
            callType: r.callType || 'voice', // 'voice' | 'video'
            direction: r.direction, // 'incoming' | 'outgoing' | 'missed' | 'declined'
            isMissed,
            status: r.rawStatus,
            duration: Number(r.duration || 0),
            createdAt: r.createdAt
        };
    });

    const groupCalls = groupRows.map((r) => {
        let parsedMembers = [];
        let joinedCount = 0;
        if (r.memberNames) {
            try {
                const parsed = JSON.parse(r.memberNames);
                if (Array.isArray(parsed)) {
                    parsedMembers = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    parsedMembers = parsed.members || [];
                    joinedCount = parsed.joinedCount || 0;
                }
            } catch (e) {
                parsedMembers = [];
            }
        }

        const isNotAccepted = r.rawStatus === 'not_accepted' || r.rawStatus === 'missed' || (r.duration === 0 && joinedCount <= 1 && r.rawStatus !== 'completed');

        return {
            id: Number(r.id),
            callerId: r.callerId,
            receiverId: `group:${r.groupId}`,
            peerId: `group:${r.groupId}`,
            peerName: r.groupName,
            groupName: r.groupName,
            groupId: String(r.groupId),
            groupMembers: parsedMembers,
            joinedCount: joinedCount,
            peerPhone: `group:${r.groupId}`,
            peerAvatar: null,
            callType: r.callType || 'voice',
            direction: userVars.includes(String(r.callerId)) ? 'outgoing' : 'incoming',
            isMissed: isNotAccepted,
            status: isNotAccepted ? 'not_accepted' : r.rawStatus,
            duration: Number(r.duration || 0),
            createdAt: r.createdAt,
            isGroup: true
        };
    });

    return [...personalCalls, ...groupCalls].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * 11. Delete single call log entry
 */
const deleteCallLog = async (callId, userId) => {
    const pool = getPool();
    const cleanId = Number(callId);
    const cleanUserId = String(userId || "").trim();
    if (!cleanId) return false;

    const userVars = getPhoneVariants(cleanUserId);
    const placeholders = userVars.map(() => "?").join(",");

    await pool.execute(
        `DELETE FROM call_logs 
         WHERE id = ? AND (caller_id IN (${placeholders}) OR receiver_id IN (${placeholders}))`,
        [cleanId, ...userVars, ...userVars]
    );

    return true;
};

/**
 * 12. Clear all call logs for a user
 */
const clearCallLogs = async (userId) => {
    const pool = getPool();
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return false;

    const userVars = getPhoneVariants(cleanUserId);
    const placeholders = userVars.map(() => "?").join(",");

    await pool.execute(
        `DELETE FROM call_logs 
         WHERE caller_id IN (${placeholders}) OR receiver_id IN (${placeholders})`,
        [...userVars, ...userVars]
    );

    return true;
};

/**
 * Status CRUD
 */
const createStatus = async ({ userId, type, content, caption, bgColor, fontStyle }) => {
    const pool = getPool();
    const cleanUserId = String(userId || '').trim();
    if (!cleanUserId || !content) return null;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const [result] = await pool.execute(
        `INSERT INTO user_statuses (user_id, type, content, caption, bg_color, font_style, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cleanUserId, type || 'text', content, caption || null, bgColor || '#075e54', fontStyle || 'normal', expiresAt]
    );
    const [rows] = await pool.execute('SELECT * FROM user_statuses WHERE id = ?', [result.insertId]);
    return rows[0] ? mapStatus(rows[0]) : null;
};

const mapStatus = (row) => ({
    id: Number(row.id),
    userId: row.user_id,
    type: row.type,
    content: row.content,
    caption: row.caption || null,
    bgColor: row.bg_color || '#075e54',
    fontStyle: row.font_style || 'normal',
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    viewCount: Number(row.view_count || row.viewCount || 0),
    isViewed: Boolean(row.is_viewed || row.isViewed || false)
});

const getMyStatuses = async (userId) => {
    const pool = getPool();
    const userVars = getPhoneVariants(userId);
    if (!userVars.length) return [];
    const placeholders = userVars.map(() => '?').join(',');
    const [rows] = await pool.execute(
        `SELECT s.*, 
                (SELECT COUNT(*) FROM status_views sv WHERE sv.status_id = s.id) AS view_count
         FROM user_statuses s 
         WHERE user_id IN (${placeholders}) 
           AND expires_at > NOW() 
         ORDER BY id ASC`,
        userVars
    );
    return rows.map(mapStatus);
};

const getContactStatuses = async (userId) => {
    const pool = getPool();
    const userVars = getPhoneVariants(userId);
    if (!userVars.length) return [];
    const placeholders = userVars.map(() => '?').join(',');

    const [rows] = await pool.execute(
        `SELECT s.*, 
                COALESCE(
                    (
                        SELECT c.custom_name FROM contacts c 
                        WHERE c.user_id IN (${placeholders}) 
                          AND (c.contact_id = s.user_id OR c.contact_id = u.full_phone OR c.contact_id = u.phone OR c.contact_id = CAST(u.id AS CHAR)) 
                        LIMIT 1
                    ),
                    u.full_phone,
                    u.phone,
                    s.user_id
                ) AS display_name,
                u.name AS profile_name,
                u.full_phone AS fullPhone,
                u.avatar,
                u.about,
                (SELECT COUNT(*) FROM status_views sv WHERE sv.status_id = s.id) AS view_count,
                EXISTS(SELECT 1 FROM status_views sv WHERE sv.status_id = s.id AND sv.viewer_id IN (${placeholders})) AS is_viewed
         FROM user_statuses s
         LEFT JOIN users u ON (u.full_phone = s.user_id OR u.phone = s.user_id OR CAST(u.id AS CHAR) = s.user_id OR s.user_id LIKE CONCAT('%', u.phone))
         WHERE s.expires_at > NOW()
           AND s.user_id NOT IN (${placeholders})
         ORDER BY s.user_id, s.id ASC`,
        [...userVars, ...userVars, ...userVars]
    );
    return rows.map((r) => ({
        ...mapStatus(r),
        userName: r.display_name || r.fullPhone || r.user_id,
        profileName: r.profile_name || null,
        userAvatar: r.avatar,
        userFullPhone: r.fullPhone
    }));
};

const deleteStatus = async (statusId, userId) => {
    const pool = getPool();
    const userVars = getPhoneVariants(userId);
    const placeholders = userVars.map(() => '?').join(',');
    await pool.execute(
        `DELETE FROM user_statuses WHERE id = ? AND user_id IN (${placeholders})`,
        [Number(statusId), ...userVars]
    );
    return true;
};

const recordStatusView = async (statusId, viewerId) => {
    const pool = getPool();
    await pool.execute(
        `INSERT IGNORE INTO status_views (status_id, viewer_id) VALUES (?, ?)`,
        [Number(statusId), String(viewerId).trim()]
    );
};

const getStatusViews = async (statusId, ownerId) => {
    const pool = getPool();
    const ownerVars = getPhoneVariants(ownerId);
    const placeholders = ownerVars.map(() => '?').join(',');
    // Group by viewer to guarantee absolutely unique viewers per status
    const [rows] = await pool.execute(
        `SELECT sv.viewer_id AS viewerId, 
                MAX(sv.viewed_at) AS viewedAt,
                COALESCE(MAX(u.full_phone), sv.viewer_id) AS phone,
                MAX(u.avatar) AS avatar,
                COALESCE(MAX(c.custom_name), MAX(u.full_phone), sv.viewer_id) AS name,
                MAX(sr.emoji) AS reaction
         FROM status_views sv
         LEFT JOIN users u ON (u.full_phone = sv.viewer_id OR u.phone = sv.viewer_id OR CAST(u.id AS CHAR) = sv.viewer_id)
         LEFT JOIN contacts c ON (c.user_id IN (${placeholders}) AND (c.contact_id = sv.viewer_id OR c.contact_id = u.full_phone OR c.contact_id = u.phone))
         LEFT JOIN status_reactions sr ON (sr.status_id = sv.status_id AND (sr.reactor_id = sv.viewer_id OR sr.reactor_id = u.full_phone OR sr.reactor_id = u.phone))
         WHERE sv.status_id = ?
         GROUP BY sv.viewer_id
         ORDER BY viewedAt DESC`,
        [...ownerVars, Number(statusId)]
    );
    return rows;
};

const addStatusReaction = async (statusId, reactorId, emoji) => {
    const pool = getPool();
    const cleanReactor = String(reactorId).trim();
    await pool.execute(
        `INSERT INTO status_reactions (status_id, reactor_id, emoji) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE emoji = VALUES(emoji), created_at = NOW()`,
        [Number(statusId), cleanReactor, String(emoji).trim()]
    );
    // Ensure reaction is also counted as a unique status view
    await recordStatusView(statusId, cleanReactor);
};

const addStatusReply = async (statusId, senderId, message) => {
    const pool = getPool();
    const [result] = await pool.execute(
        `INSERT INTO status_replies (status_id, sender_id, message) VALUES (?, ?, ?)`,
        [Number(statusId), String(senderId).trim(), String(message).trim()]
    );
    return result.insertId;
};

const getStatusOwner = async (statusId) => {
    const pool = getPool();
    const [rows] = await pool.execute(
        `SELECT user_id FROM user_statuses WHERE id = ? LIMIT 1`,
        [Number(statusId)]
    );
    return rows[0]?.user_id || null;
};

module.exports = {
    addMessage,
    findOrCreateContact,
    markMessagesAsDelivered,
    markMessagesAsSeen,
    getConversation,
    deleteConversation,
    createUser,
    getUser,
    authenticateUser,
    updateUser,
    updateLastSeen,
    saveCustomContactName,
    listConversations,
    searchUsersByPhone,
    updateMessage,
    updateMessagePin,
    deleteMessage,
    blockUser,
    unblockUser,
    getBlockStatus,
    getBlockedUsers,
    getUnreadCount,
    getPhoneVariants,
    createCallLog,
    updateCallLog,
    getCallLogs,
    deleteCallLog,
    clearCallLogs,
    createStatus,
    getMyStatuses,
    getContactStatuses,
    deleteStatus,
    recordStatusView,
    getStatusViews,
    addStatusReaction,
    addStatusReply,
    getStatusOwner,
    createGroup,
    getGroup,
    listGroups,
    markGroupMessagesAsSeen,
    addGroupMember,
    removeGroupMember,
    leaveGroup,
    joinGroupByInvite,
    updateGroup,
    updateGroupMemberRole,
    getGroupMessages,
    addGroupMessage,
    reactToGroupMessage,
    reactToMessage
};

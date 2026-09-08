const mysql = require("mysql2/promise");

const databaseName = process.env.MYSQL_DATABASE || "chat_app";
const connectionOptions = {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || ""
};

let pool;

const initializeDatabase = async () => {
    const connection = await mysql.createConnection(connectionOptions);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
    await connection.end();

    pool = mysql.createPool({
        ...connectionOptions,
        database: databaseName,
        waitForConnections: true,
        connectionLimit: 10,
        dateStrings: true
    });


    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            country_code VARCHAR(10) NOT NULL DEFAULT '+91',
            phone VARCHAR(20) NOT NULL,
            full_phone VARCHAR(30) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NULL,
            about VARCHAR(255) NOT NULL DEFAULT 'Available',
            avatar LONGTEXT NULL,
            avatar_privacy VARCHAR(30) NOT NULL DEFAULT 'everyone',
            last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_phone (phone),
            INDEX idx_full_phone (full_phone)
        )
    `);


    try {
        const [colInfo] = await pool.query(`
            SELECT DATA_TYPE, COLUMN_KEY, EXTRA 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
        `, [databaseName]);

        if (colInfo.length > 0 && colInfo[0].DATA_TYPE === 'varchar') {
            await pool.query("UPDATE users SET full_phone = id WHERE full_phone IS NULL OR full_phone = ''");
            await pool.query("UPDATE users SET phone = REPLACE(full_phone, '+91', '') WHERE phone IS NULL OR phone = ''");
            await pool.query("UPDATE users SET country_code = '+91' WHERE country_code IS NULL OR country_code = ''");

            await pool.query("ALTER TABLE users CHANGE COLUMN id old_id VARCHAR(100) NULL");
            try { await pool.query("ALTER TABLE users DROP PRIMARY KEY"); } catch (e) { }
            await pool.query("ALTER TABLE users ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST");
            try { await pool.query("ALTER TABLE users DROP COLUMN old_id"); } catch (e) { }
            try { await pool.query("ALTER TABLE users ADD UNIQUE KEY uk_full_phone (full_phone)"); } catch (e) { }
            console.log("Successfully migrated users table to AUTO_INCREMENT id!");
        }
    } catch (migErr) {
        console.warn("Users migration check:", migErr.message);
    }


    const userAlterStatements = [
        "ALTER TABLE users ADD COLUMN country_code VARCHAR(10) NOT NULL DEFAULT '+91'",
        "ALTER TABLE users ADD COLUMN phone VARCHAR(20) NOT NULL DEFAULT ''",
        "ALTER TABLE users ADD COLUMN full_phone VARCHAR(30) NOT NULL DEFAULT ''",
        "ALTER TABLE users ADD COLUMN avatar_privacy VARCHAR(30) NOT NULL DEFAULT 'everyone'",
        "ALTER TABLE users MODIFY COLUMN avatar LONGTEXT NULL",
        "ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL"
    ];
    for (const stmt of userAlterStatements) {
        try {
            await pool.query(stmt);
        } catch (err) {
            if (err.code !== "ER_DUP_FIELDNAME") {
                // ignore
            }
        }
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS otps (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            country_code VARCHAR(10) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            full_phone VARCHAR(30) NOT NULL,
            otp VARCHAR(10) NOT NULL,
            expires_at DATETIME NOT NULL,
            is_verified TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_full_phone (full_phone)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            sender_id VARCHAR(100) NOT NULL,
            recipient_id VARCHAR(100) NOT NULL,
            text TEXT NOT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'text',
            status VARCHAR(20) NOT NULL DEFAULT 'sent',
            media_url LONGTEXT NULL,
            original_text TEXT NULL,
            delivered_at DATETIME NULL,
            seen_at DATETIME NULL,
            edited_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX conversation_index (sender_id, recipient_id, id)
        )
    `);

    const messageAlterStatements = [
        "ALTER TABLE messages ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'text'",
        "ALTER TABLE messages ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'sent'",
        "ALTER TABLE messages ADD COLUMN media_url LONGTEXT NULL",
        "ALTER TABLE messages ADD COLUMN original_text TEXT NULL",
        "ALTER TABLE messages ADD COLUMN reply_to_id BIGINT UNSIGNED NULL",
        "ALTER TABLE messages ADD COLUMN reply_to_text TEXT NULL",
        "ALTER TABLE messages ADD COLUMN reply_to_sender VARCHAR(100) NULL",
        "ALTER TABLE messages ADD COLUMN reactions TEXT NULL",
        "ALTER TABLE messages ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE messages ADD COLUMN delivered_at DATETIME NULL",
        "ALTER TABLE messages ADD COLUMN seen_at DATETIME NULL",
        "ALTER TABLE messages ADD COLUMN edited_at DATETIME NULL"
    ];
    for (const statement of messageAlterStatements) {
        try {
            await pool.query(statement);
        } catch (error) {
            if (error.code !== "ER_DUP_FIELDNAME") {
                // ignore
            }
        }
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS message_deletions (
            message_id BIGINT UNSIGNED NOT NULL,
            user_id VARCHAR(100) NOT NULL,
            deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (message_id, user_id),
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS blocked_users (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            blocker_id VARCHAR(100) NOT NULL,
            blocked_id VARCHAR(100) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_blocker_blocked (blocker_id, blocked_id),
            INDEX idx_blocker (blocker_id),
            INDEX idx_blocked (blocked_id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS contacts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(100) NOT NULL,
            contact_id VARCHAR(100) NOT NULL,
            custom_name VARCHAR(150) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_user_contact (user_id, contact_id),
            INDEX idx_user_id (user_id),
            INDEX idx_contact_id (contact_id)
        )
    `);

    // 7. User Statuses table (WhatsApp-style status updates)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_statuses (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'text',
            content LONGTEXT NOT NULL,
            caption TEXT NULL,
            bg_color VARCHAR(20) NULL DEFAULT '#075e54',
            font_style VARCHAR(30) NULL DEFAULT 'normal',
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_expires_at (expires_at)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS status_views (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            status_id BIGINT UNSIGNED NOT NULL,
            viewer_id VARCHAR(100) NOT NULL,
            viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_status_viewer (status_id, viewer_id),
            INDEX idx_status_id (status_id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS status_reactions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            status_id BIGINT UNSIGNED NOT NULL,
            reactor_id VARCHAR(100) NOT NULL,
            emoji VARCHAR(10) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_status_reactor (status_id, reactor_id),
            INDEX idx_status_id (status_id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS status_replies (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            status_id BIGINT UNSIGNED NOT NULL,
            sender_id VARCHAR(100) NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status_id (status_id)
        )
    `);

    // 8. Call Logs / History table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS call_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            caller_id VARCHAR(100) NOT NULL,
            receiver_id VARCHAR(100) NOT NULL,
            call_type VARCHAR(20) NOT NULL DEFAULT 'voice',
            status VARCHAR(20) NOT NULL DEFAULT 'missed',
            channel_name VARCHAR(255) NULL,
            duration INT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_caller (caller_id),
            INDEX idx_receiver (receiver_id),
            INDEX idx_created_at (created_at)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_groups (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            creator_id VARCHAR(100) NOT NULL,
            avatar LONGTEXT NULL,
            message_permission VARCHAR(20) NOT NULL DEFAULT 'everyone',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_group_creator (creator_id)
        )
    `);

    try {
        await pool.query("ALTER TABLE chat_groups ADD COLUMN message_permission VARCHAR(20) NOT NULL DEFAULT 'everyone'");
    } catch (e) {
        // column already exists
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS group_members (
            group_id BIGINT UNSIGNED NOT NULL,
            user_id VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'member',
            last_seen_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, user_id),
            INDEX idx_group_member_user (user_id)
        )
    `);

    try {
        await pool.query("ALTER TABLE group_members ADD COLUMN last_seen_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0");
    } catch (e) {
        // column already exists
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS group_messages (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            group_id BIGINT UNSIGNED NOT NULL,
            sender_id VARCHAR(100) NOT NULL,
            text TEXT NOT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'text',
            media_url LONGTEXT NULL,
            reply_to_id BIGINT UNSIGNED NULL,
            mentions TEXT NULL,
            reactions TEXT NULL,
            is_pinned TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_group_messages (group_id, id),
            INDEX idx_group_sender (sender_id)
        )
    `);

    try {
        await pool.query("ALTER TABLE group_messages ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0");
    } catch (e) {
        // column already exists
    }

    const tables = ['users', 'otps', 'messages', 'message_deletions', 'blocked_users', 'contacts', 'user_statuses', 'status_views', 'status_reactions', 'status_replies', 'call_logs', 'chat_groups', 'group_members', 'group_messages'];
    for (const tbl of tables) {
        try {
            await pool.query(`ALTER TABLE \`${tbl}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        } catch (e) {

        }
    }

    console.log(`MySQL connected & tables initialized: ${databaseName}`);
};

const getPool = () => {
    if (!pool) throw new Error("Database has not been initialized");
    return pool;
};

module.exports = { initializeDatabase, getPool };

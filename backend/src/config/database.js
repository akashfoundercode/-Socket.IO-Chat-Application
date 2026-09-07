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

    // 1. Users table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(100) NOT NULL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            country_code VARCHAR(10) NULL,
            phone VARCHAR(20) NULL,
            full_phone VARCHAR(30) UNIQUE NULL,
            password_hash VARCHAR(255) NULL,
            about VARCHAR(255) NOT NULL DEFAULT 'Available',
            avatar LONGTEXT NULL,
            avatar_privacy VARCHAR(30) NOT NULL DEFAULT 'everyone',
            last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Ensure users columns exist for existing tables
    const userAlterStatements = [
        "ALTER TABLE users ADD COLUMN country_code VARCHAR(10) NULL",
        "ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL",
        "ALTER TABLE users ADD COLUMN full_phone VARCHAR(30) NULL",
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

    // 2. OTPs table for Phone Number verification
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

    // 3. Messages table with WhatsApp Ticks (status: 'sent' | 'delivered' | 'seen')
    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            sender_id VARCHAR(100) NOT NULL,
            recipient_id VARCHAR(100) NOT NULL,
            text TEXT NOT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'text',
            status VARCHAR(20) NOT NULL DEFAULT 'sent',
            media_url LONGTEXT NULL,
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

    // 4. Message deletions
    await pool.query(`
        CREATE TABLE IF NOT EXISTS message_deletions (
            message_id BIGINT UNSIGNED NOT NULL,
            user_id VARCHAR(100) NOT NULL,
            deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (message_id, user_id),
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        )
    `);

    // 5. Blocked Users table
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

    console.log(`MySQL connected & tables initialized: ${databaseName}`);
};

const getPool = () => {
    if (!pool) throw new Error("Database has not been initialized");
    return pool;
};

module.exports = { initializeDatabase, getPool };

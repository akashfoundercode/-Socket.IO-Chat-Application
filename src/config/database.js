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
    pool = mysql.createPool({ ...connectionOptions, database: databaseName, waitForConnections: true, connectionLimit: 10, dateStrings: true });
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(100) NOT NULL PRIMARY KEY, name VARCHAR(120) NOT NULL, password_hash VARCHAR(255) NOT NULL, about VARCHAR(255) NOT NULL DEFAULT 'Available', avatar TEXT NULL, last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS messages (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, sender_id VARCHAR(100) NOT NULL, recipient_id VARCHAR(100) NOT NULL, text TEXT NOT NULL, type VARCHAR(20) NOT NULL DEFAULT 'text', media_url LONGTEXT NULL, edited_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX conversation_index (sender_id, recipient_id, id))`);
    for (const statement of [
        "ALTER TABLE messages ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'text'",
        "ALTER TABLE messages ADD COLUMN media_url LONGTEXT NULL",
        "ALTER TABLE messages ADD COLUMN edited_at DATETIME NULL"
    ]) {
        try {
            await pool.query(statement);
        } catch (error) {
            if (error.code !== "ER_DUP_FIELDNAME") throw error;
        }
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS message_deletions (message_id BIGINT UNSIGNED NOT NULL, user_id VARCHAR(100) NOT NULL, deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (message_id, user_id), FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE)`);
    console.log(`MySQL connected: ${databaseName}`);
};

const getPool = () => {
    if (!pool) throw new Error("Database has not been initialized");
    return pool;
};

module.exports = { initializeDatabase, getPool };
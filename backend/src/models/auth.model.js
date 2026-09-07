const { getPool } = require("../config/database");

const mapUser = (row) => {
    if (!row) return null;
    return {
        id: String(row.id),
        name: row.full_phone || row.id,
        countryCode: row.country_code,
        phone: row.phone,
        fullPhone: row.full_phone || row.id,
        about: row.about,
        avatar: row.avatar,
        lastSeen: row.last_seen,
        createdAt: row.created_at
    };
};

/**
 * Save OTP to database (expires in specified minutes, e.g. 5 mins)
 */
const saveOtp = async ({ countryCode, phone, fullPhone, otp, expiryMinutes = 5 }) => {
    const pool = getPool();
    
    // Invalidate previous unverified OTPs for this phone
    await pool.execute(
        "UPDATE otps SET is_verified = 1 WHERE full_phone = ? AND is_verified = 0",
        [fullPhone]
    );

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const [result] = await pool.execute(
        `INSERT INTO otps (country_code, phone, full_phone, otp, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [countryCode, phone, fullPhone, otp, expiresAt]
    );

    return {
        id: result.insertId,
        fullPhone,
        otp,
        expiresAt
    };
};

/**
 * Verify OTP from database
 */
const verifyOtpInDb = async ({ fullPhone, otp }) => {
    const pool = getPool();
    const now = new Date();

    const [rows] = await pool.execute(
        `SELECT * FROM otps 
         WHERE full_phone = ? 
           AND otp = ? 
           AND is_verified = 0 
           AND expires_at >= ?
         ORDER BY id DESC LIMIT 1`,
        [fullPhone, otp, now]
    );

    if (rows.length === 0) {
        return { valid: false, message: "Invalid or expired OTP" };
    }

    const otpRecord = rows[0];

    // Mark OTP as verified/used
    await pool.execute("UPDATE otps SET is_verified = 1 WHERE id = ?", [otpRecord.id]);

    return { valid: true, otpRecord };
};

/**
 * Find or create user by phone number
 */
const findOrCreateUserByPhone = async ({ countryCode, phone, fullPhone }) => {
    const pool = getPool();

    // Check if user already exists
    const [rows] = await pool.execute(
        "SELECT * FROM users WHERE full_phone = ? OR id = ? LIMIT 1",
        [fullPhone, fullPhone]
    );

    if (rows.length > 0) {
        await pool.execute("UPDATE users SET last_seen = NOW() WHERE id = ?", [rows[0].id]);
        return mapUser(rows[0]);
    }

    // Use full phone number as user's name & ID
    const userId = fullPhone;
    const userName = fullPhone;

    await pool.execute(
        `INSERT INTO users (id, name, country_code, phone, full_phone, last_seen)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, userName, countryCode, phone, fullPhone]
    );

    const [newRows] = await pool.execute("SELECT * FROM users WHERE id = ?", [userId]);
    return mapUser(newRows[0]);
};

/**
 * Get user by ID
 */
const getUserById = async (id) => {
    const [rows] = await getPool().execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    return mapUser(rows[0]);
};

module.exports = {
    saveOtp,
    verifyOtpInDb,
    findOrCreateUserByPhone,
    getUserById
};

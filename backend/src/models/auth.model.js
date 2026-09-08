const { getPool } = require("../config/database");

const mapUser = (row) => {
    if (!row) return null;
    return {
        id: Number(row.id),
        name: row.name || row.full_phone || String(row.id),
        countryCode: row.country_code || "+91",
        phone: row.phone || "",
        fullPhone: row.full_phone || row.phone || String(row.id),
        about: row.about || "Available",
        avatar: row.avatar || null,
        avatarPrivacy: row.avatar_privacy || "everyone",
        lastSeen: row.last_seen,
        createdAt: row.created_at
    };
};


const saveOtp = async ({ countryCode, phone, fullPhone, otp, expiryMinutes = 5 }) => {
    const pool = getPool();

   
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

    await pool.execute("UPDATE otps SET is_verified = 1 WHERE id = ?", [otpRecord.id]);

    return { valid: true, otpRecord };
};

const findOrCreateUserByPhone = async ({ countryCode, phone, fullPhone, name }) => {
    const pool = getPool();


    const [rows] = await pool.execute(
        "SELECT * FROM users WHERE full_phone = ? OR phone = ? LIMIT 1",
        [fullPhone, fullPhone]
    );

    if (rows.length > 0) {
        await pool.execute("UPDATE users SET last_seen = NOW() WHERE id = ?", [rows[0].id]);
        return mapUser(rows[0]);
    }

    const userName = name && String(name).trim() ? String(name).trim() : fullPhone;

    const [result] = await pool.execute(
        `INSERT INTO users (name, country_code, phone, full_phone, last_seen)
         VALUES (?, ?, ?, ?, NOW())`,
        [userName, countryCode, phone, fullPhone]
    );

    const [newRows] = await pool.execute("SELECT * FROM users WHERE id = ?", [result.insertId]);
    return mapUser(newRows[0]);
};


const getUserById = async (id) => {
    const cleanId = String(id || "").trim();
    if (!cleanId) return null;
    const withPlus = cleanId.startsWith("+") ? cleanId : `+${cleanId}`;

    const [rows] = await getPool().execute(
        "SELECT * FROM users WHERE id = ? OR full_phone = ? OR full_phone = ? OR phone = ? LIMIT 1",
        [cleanId, cleanId, withPlus, cleanId]
    );
    return mapUser(rows[0]);
};

module.exports = {
    saveOtp,
    verifyOtpInDb,
    findOrCreateUserByPhone,
    getUserById
};

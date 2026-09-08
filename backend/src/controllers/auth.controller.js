const crypto = require("crypto");
const authModel = require("../models/auth.model");

const COUNTRY_RULES = {
    "+91": {
        name: "India",
        exactLength: 10,
        pattern: /^[6-9]\d{9}$/,
        description: "India (+91) requires exactly 10 digits starting with 6, 7, 8, or 9"
    },
    "+1": {
        name: "USA/Canada",
        exactLength: 10,
        pattern: /^\d{10}$/,
        description: "USA/Canada (+1) requires exactly 10 digits"
    },
    "+44": {
        name: "United Kingdom",
        exactLength: 10,
        pattern: /^\d{10}$/,
        description: "UK (+44) requires exactly 10 digits"
    },
    "+971": {
        name: "UAE",
        exactLength: 9,
        pattern: /^\d{9}$/,
        description: "UAE (+971) requires exactly 9 digits"
    },
    "+966": {
        name: "Saudi Arabia",
        exactLength: 9,
        pattern: /^\d{9}$/,
        description: "Saudi Arabia (+966) requires exactly 9 digits"
    },
    "+61": {
        name: "Australia",
        exactLength: 9,
        pattern: /^\d{9}$/,
        description: "Australia (+61) requires exactly 9 digits"
    },
    "+92": {
        name: "Pakistan",
        exactLength: 10,
        pattern: /^\d{10}$/,
        description: "Pakistan (+92) requires exactly 10 digits"
    },
    "+880": {
        name: "Bangladesh",
        exactLength: 10,
        pattern: /^\d{10}$/,
        description: "Bangladesh (+880) requires exactly 10 digits"
    },
    "+977": {
        name: "Nepal",
        exactLength: 10,
        pattern: /^\d{10}$/,
        description: "Nepal (+977) requires exactly 10 digits"
    },
    "+65": {
        name: "Singapore",
        exactLength: 8,
        pattern: /^\d{8}$/,
        description: "Singapore (+65) requires exactly 8 digits"
    }
};

const validateCountryCode = (countryCode) => {
    if (!countryCode) return { isValid: false, error: "Country code is required" };

    let normalized = String(countryCode).trim();
    if (!normalized.startsWith("+")) {
        normalized = `+${normalized}`;
    }

    const countryCodeRegex = /^\+[1-9]\d{0,3}$/;
    if (!countryCodeRegex.test(normalized)) {
        return { isValid: false, error: "Invalid country code format (e.g. +91, +1, +44)" };
    }

    return { isValid: true, value: normalized };
};

const validatePhone = (phone, normalizedCountryCode = "+91") => {
    if (!phone) return { isValid: false, error: "Phone number is required" };

    const cleanedPhone = String(phone).trim().replace(/\D/g, ""); // digits only

    const countryRule = COUNTRY_RULES[normalizedCountryCode];

    if (countryRule) {
        if (cleanedPhone.length !== countryRule.exactLength) {
            return {
                isValid: false,
                error: `Phone number for ${countryRule.name} (${normalizedCountryCode}) must be exactly ${countryRule.exactLength} digits. You entered ${cleanedPhone.length} digits.`
            };
        }

        if (countryRule.pattern && !countryRule.pattern.test(cleanedPhone)) {
            return {
                isValid: false,
                error: countryRule.description
            };
        }
    } else {
    
        if (cleanedPhone.length < 6 || cleanedPhone.length > 15) {
            return {
                isValid: false,
                error: `Phone number for ${normalizedCountryCode} must be between 6 and 15 digits.`
            };
        }
    }

    return { isValid: true, value: cleanedPhone };
};

const generateOtp = (length = 6) => {
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, digits.length);
        otp += digits[randomIndex];
    }
    return otp;
};

const sendOtp = async (req, res) => {
    try {
        const { countryCode, phone } = req.body;


        const validCountryCode = validateCountryCode(countryCode);
        if (!validCountryCode.isValid) {
            return res.status(400).json({ success: false, message: validCountryCode.error });
        }

        const normalizedCountryCode = validCountryCode.value;

        const validPhone = validatePhone(phone, normalizedCountryCode);
        if (!validPhone.isValid) {
            return res.status(400).json({ success: false, message: validPhone.error });
        }

        const normalizedPhone = validPhone.value;
        const fullPhone = `${normalizedCountryCode}${normalizedPhone}`;

        const otp = generateOtp(6);

        await authModel.saveOtp({
            countryCode: normalizedCountryCode,
            phone: normalizedPhone,
            fullPhone,
            otp,
            expiryMinutes: 5
        });

        console.log(`[OTP GENERATED] Phone: ${fullPhone} | OTP: ${otp}`);

        return res.status(200).json({
            success: true,
            message: `OTP sent successfully to ${fullPhone} and saved in database`,
            data: {
                countryCode: normalizedCountryCode,
                phone: normalizedPhone,
                fullPhone,
                expiresIn: "5 minutes",
                otp
            }
        });
    } catch (error) {
        console.error("sendOtp error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send OTP",
            error: error.message
        });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { countryCode, phone, otp, name } = req.body;

        const validCountryCode = validateCountryCode(countryCode);
        if (!validCountryCode.isValid) {
            return res.status(400).json({ success: false, message: validCountryCode.error });
        }

        const normalizedCountryCode = validCountryCode.value;

        const validPhone = validatePhone(phone, normalizedCountryCode);
        if (!validPhone.isValid) {
            return res.status(400).json({ success: false, message: validPhone.error });
        }

        const normalizedPhone = validPhone.value;
        const fullPhone = `${normalizedCountryCode}${normalizedPhone}`;

        const cleanOtp = String(otp || "").trim();
        if (!cleanOtp || !/^\d{4,6}$/.test(cleanOtp)) {
            return res.status(400).json({
                success: false,
                message: "OTP is required and must be 4-6 digits"
            });
        }

        const verification = await authModel.verifyOtpInDb({
            fullPhone,
            otp: cleanOtp
        });

        if (!verification.valid) {
            return res.status(400).json({
                success: false,
                message: verification.message || "Invalid or expired OTP"
            });
        }

        const user = await authModel.findOrCreateUserByPhone({
            countryCode: normalizedCountryCode,
            phone: normalizedPhone,
            fullPhone,
            name
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            user
        });
    } catch (error) {
        console.error("verifyOtp error:", error);
        return res.status(500).json({
            success: false,
            message: "Verification failed",
            error: error.message
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await authModel.getUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.json({ success: true, user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    COUNTRY_RULES,
    validateCountryCode,
    validatePhone,
    generateOtp,
    sendOtp,
    verifyOtp,
    getProfile
};

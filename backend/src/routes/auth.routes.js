const express = require("express");
const authController = require("../controllers/auth.controller");

const router = express.Router();

// 1. Send OTP (generates & stores OTP in DB)
router.post("/send-otp", authController.sendOtp);

// 2. Verify OTP & Login/Register
router.post("/verify-otp", authController.verifyOtp);

// 3. Get user details
router.get("/me/:id", authController.getProfile);

module.exports = router;

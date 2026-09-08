const express = require("express");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.get("/me/:id", authController.getProfile);

module.exports = router;

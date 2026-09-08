const express = require("express");
const router = express.Router();
const agoraController = require("../controllers/agora.controller");

router.get("/token", agoraController.generateRtcToken);
router.post("/token", agoraController.generateRtcToken);

module.exports = router;

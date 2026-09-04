const express = require("express");

const chatController = require("../controllers/chat.controller");

const router = express.Router();

router.get(
    "/history",
    chatController.getChatHistory
);

module.exports = router;
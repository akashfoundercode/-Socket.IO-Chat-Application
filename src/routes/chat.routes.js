const express = require("express");

const chatController = require("../controllers/chat.controller");

const router = express.Router();

router.get(
    "/history",
    chatController.getChatHistory
);

router.post("/auth/register", chatController.register);
router.post("/auth/login", chatController.login);
router.get("/users/:id", chatController.users);
router.get("/profile/:id", chatController.me);
router.patch("/profile/:id", chatController.profile);

module.exports = router;
const express = require("express");
const chatController = require("../controllers/chat.controller");

const router = express.Router();

// 1. Add / Start chat with contact
router.post("/contacts", chatController.addContact);
router.post("/add-contact", chatController.addContact);

// 2. Search users by phone / name in database
router.get("/users/search", chatController.searchUsers);
router.get("/search", chatController.searchUsers);

// 3. Get active conversations list (Empty [] for new users)
router.get("/conversations/:userId", chatController.getConversations);
router.get("/conversations", chatController.getConversations);

// 4. Get chat history between two users
router.get("/history", chatController.getChatHistory);

// 5. User Profile (Get & Update Name, About/Status, Avatar)
router.get("/profile/:id", chatController.me);
router.put("/profile/:id", chatController.profile);
router.patch("/profile/:id", chatController.profile);

module.exports = router;

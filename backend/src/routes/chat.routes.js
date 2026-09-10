const express = require("express");
const chatController = require("../controllers/chat.controller");

const router = express.Router();

router.post("/contacts", chatController.addContact);
router.post("/add-contact", chatController.addContact);
router.put("/contacts/rename", chatController.renameContact);
router.post("/contacts/rename", chatController.renameContact);
router.put("/contacts/:contactId/rename", chatController.renameContact);

router.get("/users/search", chatController.searchUsers);
router.get("/search", chatController.searchUsers);

router.get("/conversations/:userId", chatController.getConversations);
router.get("/conversations", chatController.getConversations);
router.delete("/conversations/:otherUserId", chatController.deleteConversation);
router.delete("/conversations", chatController.deleteConversation);

router.get("/history", chatController.getChatHistory);

router.post("/groups", chatController.createGroup);
router.get("/groups/:userId", chatController.getGroups);
router.get("/groups/detail/:groupId", chatController.getGroup);
router.post("/groups/:groupId/members", chatController.addGroupMember);
router.delete("/groups/:groupId/members/:memberId", chatController.removeGroupMember);
router.delete("/groups/:groupId/members", chatController.removeGroupMember);
router.post("/groups/:groupId/leave", chatController.leaveGroup);
router.post("/groups/:groupId/join", chatController.joinGroupByInvite);
router.put("/groups/:groupId", chatController.updateGroup);
router.patch("/groups/:groupId", chatController.updateGroup);
router.put("/groups/:groupId/members/role", chatController.updateGroupMemberRole);
router.get("/groups/:groupId/history", chatController.getGroupHistory);
router.post("/groups/:groupId/seen", chatController.markGroupSeen);


router.get("/profile/:id", chatController.me);
router.put("/profile/:id", chatController.profile);
router.patch("/profile/:id", chatController.profile);


router.post("/block", chatController.blockContact);
router.post("/unblock", chatController.unblockContact);
router.get("/blocked/:userId", chatController.getBlockedList);
router.get("/block-status", chatController.checkBlockStatus);


router.get("/unread/:userId", chatController.getUnreadNotifications);
router.get("/unread", chatController.getUnreadNotifications);
router.post("/seen", chatController.markSeen);
router.post("/mark-seen", chatController.markSeen);

router.get("/calls/:userId", chatController.getCallLogs);
router.get("/calls", chatController.getCallLogs);
router.delete("/calls/clear/:userId", chatController.clearCallLogs);
router.post("/calls/batch-delete", chatController.deleteCallLogsBatch);
router.delete("/calls/batch", chatController.deleteCallLogsBatch);
router.delete("/calls/:callId", chatController.deleteCallLog);

router.post("/status", chatController.createStatus);
router.get("/status/:userId", chatController.getStatuses);
router.delete("/status/:statusId", chatController.deleteStatus);
router.post("/status/:statusId/view", chatController.viewStatus);
router.get("/status/:statusId/viewers", chatController.getStatusViewers);
router.post("/status/:statusId/react", chatController.reactToStatus);
router.post("/status/:statusId/reply", chatController.replyToStatus);

// Audio & Media Streaming Endpoint (Voice notes, images, attachments)
const fs = require("fs");
const path = require("path");

const MIME_MAP = {
    ".webm": "audio/webm",
    ".mp4": "audio/mp4",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif"
};

const handleServeMedia = (req, res) => {
    const { subDir, filename } = req.params;
    const safeSubDir = String(subDir || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const safeFilename = path.basename(String(filename || ""));
    const filePath = path.join(__dirname, "../../uploads", safeSubDir, safeFilename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: "Media file not found" });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
        const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": contentType
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            "Content-Length": fileSize,
            "Content-Type": contentType,
            "Accept-Ranges": "bytes"
        });
        fs.createReadStream(filePath).pipe(res);
    }
};

router.get("/media/:subDir/:filename", handleServeMedia);
router.get("/uploads/:subDir/:filename", handleServeMedia);

module.exports = router;

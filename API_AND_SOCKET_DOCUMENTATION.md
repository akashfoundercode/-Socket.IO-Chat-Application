# WhatsApp Clone - Complete REST API & Socket.IO Documentation

**Base API URL:** `http://localhost:5000/api` (or production domain)  
**Socket.IO URL:** `http://localhost:5000` (WebSocket / Polling)  
**Version:** 1.0.0  
**Date:** September 2026

---

## Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [Authentication & Profile REST APIs](#2-authentication--profile-rest-apis)
3. [Contacts & Search REST APIs](#3-contacts--search-rest-apis)
4. [1-on-1 Chats & Message History REST APIs](#4-1-on-1-chats--message-history-rest-apis)
5. [Group Management & Chat REST APIs](#5-group-management--chat-rest-apis)
6. [Call Logs & History REST APIs](#6-call-logs--history-rest-apis)
7. [Status (24h Disappearing Stories) REST APIs](#7-status-24h-disappearing-stories-rest-apis)
8. [Block / Unblock Contact REST APIs](#8-block--unblock-contact-rest-apis)
9. [Media & Voice Note Streaming REST APIs](#9-media--voice-note-streaming-rest-apis)
10. [Agora RTC Calling Token REST API](#10-agora-rtc-calling-token-rest-api)
11. [Socket.IO Events Specification](#11-socketio-events-specification)
    - [Client-to-Server (Emit)](#client-to-server-events)
    - [Server-to-Client (Listen)](#server-to-client-events)
12. [Real-time Message Lifecycle & Tick System](#12-real-time-message-lifecycle--tick-system)
13. [Call & WebRTC / Agora Flow Diagram](#13-call--webrtc--agora-flow-diagram)

---

## 1. Overview & Architecture

The application uses a hybrid **REST + Socket.IO + Agora RTC** architecture:
- **REST APIs**: Used for stateful queries, initial data loading (conversations, groups, call history, statuses), profile updates, and binary media streaming.
- **Socket.IO**: Powers low-latency real-time bidirectional communication: messaging, read receipts (single/double/blue ticks), typing indicators, presence, reactions, and call signaling.
- **Agora RTC Engine**: Delivers high-definition audio & video calling for 1-on-1 and multi-party group calls.

---

## 2. Authentication & Profile REST APIs

### 2.1 Send OTP
* **Endpoint:** `POST /api/auth/send-otp`
* **Description:** Initiates mobile phone verification by generating an OTP.
* **Request Body:**
```json
{
  "phone": "9876543210",
  "countryCode": "+91"
}
```
* **Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "otp": "123456"
}
```

---

### 2.2 Verify OTP & Login
* **Endpoint:** `POST /api/auth/verify-otp`
* **Description:** Verifies entered OTP, registers new user if not exists, and establishes session.
* **Request Body:**
```json
{
  "phone": "9876543210",
  "countryCode": "+91",
  "otp": "123456"
}
```
* **Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "user": {
    "id": "+919876543210",
    "phone": "9876543210",
    "fullPhone": "+919876543210",
    "countryCode": "+91",
    "name": "Sameer",
    "avatar": "https://...",
    "about": "Available"
  }
}
```

---

### 2.3 Get Current User Profile
* **Endpoint:** `GET /api/auth/me/:id`
* **Description:** Retrieves account details of the authenticated user.
* **Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "+919876543210",
    "name": "Sameer",
    "phone": "+919876543210",
    "avatar": "https://...",
    "about": "Hey there! I am using WhatsApp."
  }
}
```

---

### 2.4 Get Contact Profile (With Privacy & Block State)
* **Endpoint:** `GET /api/chat/profile/:id?userId=:viewerId`
* **Description:** Retrieves contact profile with block flags and avatar privacy check.
* **Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "+918382800528",
    "name": "Vivek Singh",
    "phone": "+918382800528",
    "avatar": "https://...",
    "about": "Busy",
    "avatarPrivacy": "everyone",
    "isBlockedByMe": false,
    "isBlockedByThem": false
  }
}
```

---

### 2.5 Update User Profile
* **Endpoint:** `PUT /api/chat/profile/:id` (or `PATCH /api/chat/profile/:id`)
* **Description:** Updates profile name, avatar (base64 or URL), about text, and avatar privacy.
* **Request Body:**
```json
{
  "name": "Sameer Khan",
  "avatar": "data:image/jpeg;base64,...",
  "about": "At work",
  "avatarPrivacy": "everyone"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "+919876543210",
    "name": "Sameer Khan",
    "avatar": "https://...",
    "about": "At work",
    "avatarPrivacy": "everyone"
  }
}
```

---

## 3. Contacts & Search REST APIs

### 3.1 Add Contact
* **Endpoint:** `POST /api/chat/contacts` (or `/api/chat/add-contact`)
* **Request Body:**
```json
{
  "userId": "+919876543210",
  "contactPhone": "8382800528",
  "countryCode": "+91",
  "name": "Vivek"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Contact added successfully",
  "contact": {
    "id": "+918382800528",
    "name": "Vivek",
    "phone": "+918382800528"
  }
}
```

---

### 3.2 Rename Contact (Custom Private Alias)
* **Endpoint:** `PUT /api/chat/contacts/rename` (or `POST /api/chat/contacts/rename`)
* **Description:** Saves a private custom alias name visible only to the current user.
* **Request Body:**
```json
{
  "userId": "+919876543210",
  "contactId": "+918382800528",
  "customName": "Vivek Office"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Contact name updated",
  "contactId": "+918382800528",
  "customName": "Vivek Office"
}
```

---

### 3.3 Search Registered Users
* **Endpoint:** `GET /api/chat/users/search?q=:query&userId=:userId`
* **Response (200 OK):**
```json
{
  "success": true,
  "users": [
    {
      "id": "+918382800528",
      "name": "Vivek Singh",
      "phone": "+918382800528",
      "avatar": "https://...",
      "about": "Available"
    }
  ]
}
```

---

## 4. 1-on-1 Chats & Message History REST APIs

### 4.1 List Conversations
* **Endpoint:** `GET /api/chat/conversations/:userId`
* **Response (200 OK):**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "+918382800528",
      "name": "Vivek Singh",
      "phone": "+918382800528",
      "fullPhone": "+918382800528",
      "avatar": "https://...",
      "lastMessage": "Hello bhai kaise ho",
      "lastMessageType": "text",
      "lastMessageAt": "2026-09-10T04:45:00.000Z",
      "unreadCount": 2,
      "isGroup": false
    }
  ]
}
```

---

### 4.2 Get 1-on-1 Chat Message History
* **Endpoint:** `GET /api/chat/history?userId=:userId&otherUserId=:otherUserId&limit=50&offset=0`
* **Response (200 OK):**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg_12345",
      "from": "+919876543210",
      "to": "+918382800528",
      "text": "Hello!",
      "type": "text",
      "status": "seen",
      "mediaUrl": null,
      "replyToId": null,
      "reactions": [{ "emoji": "👍", "userId": "+918382800528" }],
      "isPinned": 0,
      "createdAt": "2026-09-10T04:40:00.000Z"
    }
  ]
}
```

---

### 4.3 Delete Conversation
* **Endpoint:** `DELETE /api/chat/conversations/:otherUserId?userId=:userId`
* **Response (200 OK):** `{ "success": true, "message": "Conversation deleted" }`

---

### 4.4 Mark 1-on-1 Chat Seen
* **Endpoint:** `POST /api/chat/seen` (or `/api/chat/mark-seen`)
* **Request Body:** `{ "userId": "+919876543210", "otherUserId": "+918382800528" }`
* **Response (200 OK):** `{ "success": true, "markedCount": 3 }`

---

## 5. Group Management & Chat REST APIs

### 5.1 Create Group
* **Endpoint:** `POST /api/chat/groups`
* **Request Body:**
```json
{
  "name": "Developers Group",
  "creatorId": "+919876543210",
  "members": ["+918382800528", "+917236916568"],
  "avatar": "https://..."
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "group": {
    "id": "8",
    "name": "Developers Group",
    "creatorId": "+919876543210",
    "avatar": "https://...",
    "memberCount": 3,
    "messagePermission": "everyone"
  }
}
```

---

### 5.2 List User Groups
* **Endpoint:** `GET /api/chat/groups/:userId`
* **Response (200 OK):**
```json
{
  "success": true,
  "groups": [
    {
      "id": "group:8",
      "groupId": "8",
      "name": "Developers Group",
      "creatorId": "+919876543210",
      "avatar": "https://...",
      "memberCount": 3,
      "lastMessage": "Hello everyone",
      "lastMessageType": "text",
      "lastMessageAt": "2026-09-10T04:50:00.000Z",
      "unreadCount": 0,
      "isGroup": true
    }
  ]
}
```

---

### 5.3 Get Group Details & Hierarchy Members
* **Endpoint:** `GET /api/chat/groups/detail/:groupId?userId=:userId`
* **Response (200 OK):**
```json
{
  "success": true,
  "group": {
    "id": "8",
    "name": "Developers Group",
    "creatorId": "+919876543210",
    "avatar": "https://...",
    "messagePermission": "everyone",
    "memberCount": 3,
    "inviteUrl": "https://app.com/?joinGroup=8&groupName=Developers%20Group&via=link",
    "members": [
      {
        "userId": "+919876543210",
        "name": "Sameer (Creator)",
        "fullPhone": "+919876543210",
        "role": "admin",
        "isCreator": true
      },
      {
        "userId": "+918382800528",
        "name": "Vivek Singh",
        "fullPhone": "+918382800528",
        "role": "admin",
        "isCreator": false
      },
      {
        "userId": "+917236916568",
        "name": "Akash",
        "fullPhone": "+917236916568",
        "role": "member",
        "isCreator": false
      }
    ]
  }
}
```

---

### 5.4 Add Member to Group
* **Endpoint:** `POST /api/chat/groups/:groupId/members`
* **Request Body:** `{ "requesterId": "+919876543210", "memberId": "+919555078466" }`
* **Response (200 OK):** `{ "success": true, "message": "Member added successfully" }`

---

### 5.5 Remove Member from Group
* **Endpoint:** `DELETE /api/chat/groups/:groupId/members/:memberId`
* **Request Body / Query:** `{ "requesterId": "+919876543210" }`
* **Response (200 OK):** `{ "success": true, "message": "Member removed successfully" }`

---

### 5.6 Leave Group
* **Endpoint:** `POST /api/chat/groups/:groupId/leave`
* **Request Body:** `{ "userId": "+917236916568" }`
* **Response (200 OK):** `{ "success": true, "message": "Left group successfully" }`

---

### 5.7 Join Group via Link / QR Code
* **Endpoint:** `POST /api/chat/groups/:groupId/join`
* **Request Body:** `{ "userId": "+919999888877", "via": "qr" }`
* **Response (200 OK):** `{ "success": true, "group": { "id": "8", "name": "Developers Group" } }`

---

### 5.8 Update Group Settings
* **Endpoint:** `PUT /api/chat/groups/:groupId` (or `PATCH /api/chat/groups/:groupId`)
* **Request Body:** `{ "userId": "+919876543210", "name": "Lucknow Core Team", "messagePermission": "admins" }`
* **Response (200 OK):** `{ "success": true, "group": { "id": "8", "name": "Lucknow Core Team" } }`

---

### 5.9 Update Member Role (Admin / Member)
* **Endpoint:** `PUT /api/chat/groups/:groupId/members/role`
* **Request Body:** `{ "requesterId": "+919876543210", "memberId": "+918382800528", "role": "admin" }`
* **Response (200 OK):** `{ "success": true, "message": "Member role updated successfully" }`

---

### 5.10 Get Group Message History
* **Endpoint:** `GET /api/chat/groups/:groupId/history?userId=:userId&limit=50&offset=0`
* **Response (200 OK):**
```json
{
  "success": true,
  "messages": [
    {
      "id": "gmsg_54321",
      "groupId": "8",
      "senderId": "+919876543210",
      "senderName": "Sameer",
      "senderAvatar": "https://...",
      "text": "Meeting at 5 PM",
      "type": "text",
      "createdAt": "2026-09-10T04:55:00.000Z"
    }
  ]
}
```

---

### 5.11 Mark Group Messages Seen
* **Endpoint:** `POST /api/chat/groups/:groupId/seen`
* **Request Body:** `{ "userId": "+919876543210" }`
* **Response (200 OK):** `{ "success": true }`

---

## 6. Call Logs & History REST APIs

### 6.1 Get User Call History
* **Endpoint:** `GET /api/chat/calls/:userId`
* **Response (200 OK):**
```json
{
  "success": true,
  "calls": [
    {
      "id": "call_101",
      "callerId": "+919876543210",
      "callerName": "Sameer",
      "receiverId": "+918382800528",
      "receiverName": "Vivek",
      "callType": "voice",
      "isGroup": false,
      "status": "completed",
      "duration": 45,
      "createdAt": "2026-09-10T04:30:00.000Z"
    }
  ]
}
```

---

### 6.2 Delete Single Call Record
* **Endpoint:** `DELETE /api/chat/calls/:callId?userId=:userId`
* **Response (200 OK):** `{ "success": true, "message": "Call log deleted" }`

---

### 6.3 Clear All Call History
* **Endpoint:** `DELETE /api/chat/calls/clear/:userId`
* **Response (200 OK):** `{ "success": true, "message": "All call logs cleared" }`

---

### 6.4 Batch Delete Selected Call Records
* **Endpoint:** `POST /api/chat/calls/batch-delete` (or `DELETE /api/chat/calls/batch`)
* **Request Body:** `{ "userId": "+919876543210", "callIds": ["call_101", "call_102"] }`
* **Response (200 OK):** `{ "success": true, "deletedCount": 2 }`

---

## 7. Status (24h Disappearing Stories) REST APIs

### 7.1 Post Status Story
* **Endpoint:** `POST /api/chat/status`
* **Request Body:** `{ "userId": "+919876543210", "type": "image", "mediaUrl": "https://...", "caption": "Hello world!" }`
* **Response (201 Created):** `{ "success": true, "status": { "id": "st_999" } }`

---

### 7.2 Get Contact & My Statuses
* **Endpoint:** `GET /api/chat/status/:userId`
* **Response (200 OK):** `{ "success": true, "myStatus": [...], "contactStatuses": [...] }`

---

### 7.3 Delete Status
* **Endpoint:** `DELETE /api/chat/status/:statusId?userId=:userId`
* **Response (200 OK):** `{ "success": true }`

---

### 7.4 Mark Status Viewed
* **Endpoint:** `POST /api/chat/status/:statusId/view`
* **Request Body:** `{ "viewerId": "+919876543210" }`
* **Response (200 OK):** `{ "success": true }`

---

### 7.5 Get Status Viewers List
* **Endpoint:** `GET /api/chat/status/:statusId/viewers?userId=:userId`
* **Response (200 OK):** `{ "success": true, "viewers": [...] }`

---

### 7.6 React to Status / Reply to Status
* **Endpoint:** `POST /api/chat/status/:statusId/react` -> Body: `{ "userId": "...", "emoji": "❤️" }`
* **Endpoint:** `POST /api/chat/status/:statusId/reply` -> Body: `{ "userId": "...", "text": "Awesome!" }`

---

## 8. Block / Unblock Contact REST APIs

* **Block:** `POST /api/chat/block` -> Body: `{ "userId": "...", "targetUserId": "..." }`
* **Unblock:** `POST /api/chat/unblock` -> Body: `{ "userId": "...", "targetUserId": "..." }`
* **Get Blocked:** `GET /api/chat/blocked/:userId`
* **Block Status:** `GET /api/chat/block-status?userId=...&targetUserId=...`

---

## 9. Media & Voice Note Streaming REST APIs

* **Stream Media:** `GET /api/chat/media/:subDir/:filename`
* **Features:** Supports HTTP 206 Partial Content Range header for smooth seekable audio & video streaming.

---

## 10. Agora RTC Calling Token REST API

* **Endpoint:** `GET /api/agora/token?channelName=:channelName&uid=:uid&role=publisher`
* **Response (200 OK):**
```json
{
  "success": true,
  "token": "007eJxTYGg8v2...agora_dynamic_token",
  "appId": "agora_app_id",
  "channelName": "call_channel_8382_9876",
  "uid": 123456,
  "expiresIn": 86400
}
```

---

## 11. Socket.IO Events Specification

### Client-to-Server (Emit)
| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `join` | `userId` | Registers socket connection |
| `check_user_status` | `targetUserId` | Checks if contact is online |
| `loadConversation` | `otherUserId` | Loads chat history and opens focus |
| `close_chat` | `None` | Clears active chat focus |
| `mark_seen` | `{ otherUserId }` | Double blue ticks read receipt |
| `message` | `{ to, text, type, mediaUrl, replyToId }` | Sends 1-on-1 message |
| `message_reaction` | `{ messageId, emoji, to }` | Adds/changes reaction |
| `edit_message` | `{ messageId, text, to }` | Edits message text |
| `delete_message` | `{ messageId, deleteFor, to }` | Deletes message |
| `pin_message` | `{ messageId, pinned, to, groupId }` | Pins message |
| `typing` | `{ to, isTyping }` | Contact typing indicator |
| `loadGroup` | `groupId` | Joins group room and fetches info/history |
| `mark_group_seen` | `{ groupId }` | Clears unread group count |
| `group_message` | `{ groupId, text, type, mediaUrl }` | Sends group message |
| `group_reaction` | `{ groupId, messageId, emoji }` | Group message reaction |
| `leave_group` | `{ groupId }` | Exits group |
| `group_typing` | `{ groupId, isTyping }` | Group typing indicator |
| `group_call_user` | `{ groupId, callerName, callType, channelName }` | Starts Agora group call |
| `group_call_response`| `{ groupId, channelName, accepted, agoraUid }` | Answers/declines group call |
| `group_call_user_joined` | `{ groupId, channelName, agoraUid, userName }` | Participant joined Agora |
| `group_call_media_status` | `{ groupId, isMuted, isVideoOff }` | Mic/camera toggle in group call |
| `group_call_leave` | `{ groupId, channelName }` | Leaves active group call |
| `group_call_end` | `{ groupId, channelName }` | Ends group call |
| `call_user` | `{ to, callerName, callType, channelName }` | Rings 1-on-1 call |
| `call_ringing` | `{ to, channelName }` | Dial tone trigger |
| `answer_call` | `{ to, channelName }` | Accepts 1-on-1 call |
| `reject_call` | `{ to, channelName, reason }` | Declines 1-on-1 call |
| `end_call` | `{ to, channelName }` | Terminates 1-on-1 call |
| `call_media_status`| `{ to, isMuted, isVideoOff }` | Mic/camera toggle in 1-on-1 call |
| `block_user` / `unblock_user` | `{ targetUserId }` | Real-time block sync |
| `rename_contact` | `{ contactId, customName }` | Contact alias sync |
| `delete_conversation` | `{ otherUserId }` | Conversation removal sync |
| `logout` | `None` | Socket disconnect & offline presence |

### Server-to-Client (Listen)
| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `joined` | `userId` | Handshake confirmed |
| `online_users` | `string[]` | List of online users |
| `user_status` | `{ userId, isOnline }` | Contact presence update |
| `conversation_history` | `Message[]` | 1-on-1 message history |
| `message_saved` | `Message` | Single Gray Tick (✓) |
| `messages_delivered` | `{ to, recipientId }` | Double Gray Tick (✓✓) |
| `messages_seen` | `{ to, by }` | Double Blue Tick (✓✓) |
| `message_received` | `Message` | Inbound 1-on-1 message |
| `message_edited` | `Message` | Real-time edited message |
| `message_deleted` | `{ messageId, deleteFor }` | Real-time deleted message |
| `message_reaction_updated` | `{ messageId, reactions }` | Real-time reaction update |
| `message_pin_updated` | `Message` | Real-time pin update |
| `typing` | `{ from, isTyping }` | Contact typing |
| `group_details` | `Group` | Group metadata & hierarchy members |
| `group_history` | `GroupMessage[]` | Group messages list |
| `group_message_received` | `GroupMessage` | Inbound group message |
| `group_reaction_updated` | `{ messageId, reactions }` | Group reaction update |
| `group_typing` | `{ from, isTyping }` | Group member typing |
| `group_member_removed` | `{ groupId, memberId }` | Member removed |
| `group_member_left` | `{ groupId, userId }` | Member left |
| `incoming_call` | `{ from, callerName, callType, channelName }` | Incoming 1-on-1 call popup & ringtone |
| `call_ringing` | `{ channelName }` | Recipient ringing (dial tone) |
| `call_accepted` | `{ from, channelName }` | 1-on-1 call connected |
| `call_rejected` | `{ from, reason }` | Call declined / busy |
| `call_ended` | `{ channelName, duration }` | Call ended |
| `call_media_status` | `{ isMuted, isVideoOff }` | Peer audio/video toggle |
| `call_log_updated` | `CallLog` | Call history saved |
| `incoming_group_call` | `{ groupId, callerName, callType, channelName }` | Group call invite banner & popup |
| `group_call_accepted` | `{ agoraUid, userName }` | Participant joined group call |
| `group_call_user_joined` | `{ agoraUid, userName }` | Participant joined Agora channel |
| `group_call_user_left` | `{ userId }` | Participant exited call |
| `group_call_peer_media_status` | `{ userId, isMuted, isVideoOff }` | Participant mic/cam toggle |
| `group_call_ended` | `None` | Group call ended |
| `user_profile_changed` | `User` | Profile changed sync |
| `user_blocked` / `user_unblocked` | `{ byUserId }` | Block state sync |

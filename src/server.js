const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
require("dotenv").config();
const { initializeDatabase } = require("./config/database");


// =========================
// Create HTTP Server
// =========================

const server = http.createServer(app);


// =========================
// Create Socket.IO Server
// =========================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


// =========================
// Socket.IO
// =========================

const chatSocket = require("./sockets/chat.socket");

chatSocket(io);


// =========================
// Start Server
// =========================

const PORT = process.env.PORT || 3000;

initializeDatabase().then(() => server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
})).catch((error) => {
    console.error("MySQL startup failed:", error.message);
    process.exit(1);
});
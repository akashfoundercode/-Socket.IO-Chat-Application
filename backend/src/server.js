const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = require("./app");
const { initializeDatabase } = require("./config/database");
const chatSocket = require("./sockets/chat.socket");

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
// Socket.IO Handler
// =========================
chatSocket(io);

// =========================
// Start Server
// =========================
const PORT = process.env.PORT || 3001;

initializeDatabase()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Backend Server running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error("MySQL startup failed:", error.message);
        process.exit(1);
    });

const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = require("./app");
const { initializeDatabase } = require("./config/database");
const chatSocket = require("./sockets/chat.socket");

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
});

app.set("io", io);
chatSocket(io);


const PORT = process.env.PORT || 3001;

initializeDatabase()
    .then(() => {
        server.listen(PORT, "0.0.0.0", () => {
            console.log(`Backend Server running on port ${PORT} (0.0.0.0)`);
        });
    })
    .catch((error) => {
        console.error("MySQL startup failed:", error.message);
        process.exit(1);
    });

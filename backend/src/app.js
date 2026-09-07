const express = require("express");
const cors = require("cors");
const chatRoutes = require("./routes/chat.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();

// =========================
// Middleware
// =========================
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// =========================
// Routes
// =========================
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

// =========================
// Test Health API
// =========================
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Socket Chat Backend API is running"
    });
});

module.exports = app;

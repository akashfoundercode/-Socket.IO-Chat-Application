const express = require("express");
const cors = require("cors");
const chatRoutes = require("./routes/chat.routes");
const authRoutes = require("./routes/auth.routes");
const agoraRoutes = require("./routes/agora.routes");

const app = express();


const path = require("path");

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve persistent media files (voice notes, photos, status media)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/agora", agoraRoutes);


app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Socket Chat Backend API is running"
    });
});

module.exports = app;

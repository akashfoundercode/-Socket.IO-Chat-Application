const express = require("express");
const path = require("path");

const chatRoutes = require("./routes/chat.routes");

const app = express();


// =========================
// Middleware
// =========================

app.use(express.json());

app.use(express.urlencoded({ extended: true }));


// =========================
// Static Files
// =========================

app.use(express.static(path.join(__dirname, "../public")));


// =========================
// Routes
// =========================

app.use("/api/chat", chatRoutes);


// =========================
// Test API
// =========================

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Chat API is working"
    });
});


module.exports = app;
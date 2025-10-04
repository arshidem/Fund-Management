// server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const connectDB = require("./config/db");

dotenv.config();
const app = express();

// ============================
// CREATE HTTP SERVER
// ============================
const server = http.createServer(app);

// ============================
// INITIALIZE SOCKET.IO
// ============================
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://fund-management-iota.vercel.app"
    ],
    credentials: true
  }
});

// ============================
// MIDDLEWARES
// ============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  "http://localhost:5173",
  "https://fund-management-iota.vercel.app"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// ============================
// SOCKET.IO CONNECTION
// ============================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a room based on userId
  socket.on("join", (userId) => {
    console.log(`👤 User ${userId} joined their room`);
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ============================
// ROUTES
// ============================
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const participantRoutes = require("./routes/participantRoutes");
const contributionRoutes = require("./routes/contributionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check route
app.get("/health", (req, res) => {
  res.send("✅ Server is running successfully!");
});

// ============================
// DATABASE & SERVER START
// ============================
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ DB Connection failed:", err);
    process.exit(1);
  });

// ============================
// EXPORT IO (optional if needed in controllers)
// ============================
module.exports = { io };

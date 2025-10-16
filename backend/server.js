// server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

// Routes
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const participantRoutes = require("./routes/participantRoutes");
const contributionRoutes = require("./routes/contributionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const noteRoutes = require("./routes/noteRoutes");

// Models
const User = require("./models/User");
const Notification = require("./models/Notification");

dotenv.config();
const app = express();

// ============================
// MIDDLEWARES
// ============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const allowedOrigins = [
  "http://localhost:5173",
  "https://fund-management-iota.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ============================
// CREATE HTTP SERVER
// ============================
const server = http.createServer(app);

// ============================
// SOCKET.IO SETUP
// ============================
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Authenticate socket connection
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: No token"));

    const decoded = require("jsonwebtoken").verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id name role email");
    if (!user) return next(new Error("Authentication error: User not found"));

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// Handle connections
// Handle connections
io.on("connection", (socket) => {
  console.log(`User ${socket.userId} connected`);

  // 🔹 ADD THIS: Notify all other users that this user came online
  socket.broadcast.emit('userOnline', { userId: socket.userId });

  // Join personal room for notifications
  socket.join(`user-${socket.userId}`);

  // Admin room
  if (socket.user.role === "admin") socket.join("admin");

  // Join/leave chat groups
  socket.on("join-group", (groupId) => socket.join(`group-${groupId}`));
  socket.on("leave-group", (groupId) => socket.leave(`group-${groupId}`));



  // 🔹 ADD THIS: Handle the new 'typing' event (for your current implementation)
  socket.on("typing", (data) => {
    const { chatId, type, isTyping, userId } = data;
    const room = type === "individual" ? `user-${chatId}` : `event-${chatId}`;
    socket.to(room).emit("typing", { 
      userId, 
      chatId, 
      type, 
      isTyping 
    });
  });

  // Real-time notification: mark as read
  socket.on("markNotificationAsRead", async ({ notificationId }) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          $or: [{ recipient: socket.userId }, { broadcastToAll: true }],
        },
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      if (notification) {
        const unreadCount = await Notification.countDocuments({
          recipient: socket.userId,
          isRead: false,
        });
        socket.emit("notificationRead", { notificationId, unreadCount });
      }
    } catch (err) {
      console.error("Socket markNotificationAsRead error:", err);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`User ${socket.userId} disconnected: ${reason}`);
    
    // 🔹 ADD THIS: Notify all other users that this user went offline
    socket.broadcast.emit('userOffline', { userId: socket.userId });
  });
});

// Make io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ============================
// ROUTES
// ============================
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notes", noteRoutes);

// Health check
app.get("/health", (req, res) => res.send("✅ Server running"));

// ============================
// DB & SERVER START
// ============================
const connectDB = require("./config/db");
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB Connection failed:", err);
    process.exit(1);
  });

module.exports = { io };

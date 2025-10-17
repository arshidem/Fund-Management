// server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

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

const allowedOrigins = [
  "http://localhost:5173",
  "https://fund-management-iota.vercel.app",
];

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

app.use(cors(corsOptions));

// Handle preflight requests for all routes
// app.options("/*", (req, res) => {
//   const origin = req.headers.origin;
//   if (allowedOrigins.includes(origin)) {
//     res.setHeader('Access-Control-Allow-Origin', origin);
//   }
//   res.setHeader('Access-Control-Allow-Credentials', 'true');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
//   res.status(200).end();
// });

// ============================
// ENHANCED STATIC FILE SERVING WITH CORS
// ============================

// Create uploads directories if they don't exist
const uploadsDir = path.join(__dirname, "uploads");
const voiceMessagesDir = path.join(__dirname, "uploads", "voice-messages");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(voiceMessagesDir)) {
  fs.mkdirSync(voiceMessagesDir, { recursive: true });
}

// Custom static file middleware with explicit CORS headers
const staticWithCors = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Set CORS headers explicitly
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};

// Apply CORS middleware to static file routes
app.use("/uploads", staticWithCors);
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res, path) => {
    // Set additional headers for audio files
    if (path.endsWith('.webm') || path.endsWith('.mp3') || path.endsWith('.wav')) {
      res.setHeader('Content-Type', getContentType(path));
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));

// Helper function to get content type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.webm': 'audio/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

// ============================
// AUDIO PROXY ROUTE (Alternative solution)
// ============================
app.get("/api/audio/:filename", staticWithCors, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "uploads", "voice-messages", filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Audio file not found' 
      });
    }
    
    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Set content type
    const contentType = getContentType(filePath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle range requests for audio seeking
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);
      res.status(206); // Partial Content
      
      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);
    } else {
      // Stream entire file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
    
  } catch (error) {
    console.error('Audio proxy error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

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
  transports: ['websocket', 'polling']
});

// Authenticate socket connection
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id name role email");
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    console.error("Socket authentication error:", err);
    next(new Error("Authentication error: Invalid token"));
  }
});

// Handle connections
io.on("connection", (socket) => {
  console.log(`User ${socket.userId} connected`);

  // Notify all other users that this user came online
  socket.broadcast.emit('userOnline', { userId: socket.userId });

  // Join personal room for notifications
  socket.join(`user-${socket.userId}`);

  // Admin room
  if (socket.user.role === "admin") {
    socket.join("admin");
  }

  // Join/leave chat groups
  socket.on("join-group", (groupId) => {
    socket.join(`group-${groupId}`);
    console.log(`User ${socket.userId} joined group ${groupId}`);
  });
  
  socket.on("leave-group", (groupId) => {
    socket.leave(`group-${groupId}`);
    console.log(`User ${socket.userId} left group ${groupId}`);
  });

  // Handle typing events
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

  // Handle voice message events
  socket.on("voiceMessagePlay", (data) => {
    const { messageId, recipientId, eventId } = data;
    const room = recipientId ? `user-${recipientId}` : `event-${eventId}`;
    socket.to(room).emit("voiceMessagePlaying", { messageId });
  });

  socket.on("voiceMessageStop", (data) => {
    const { messageId, recipientId, eventId } = data;
    const room = recipientId ? `user-${recipientId}` : `event-${eventId}`;
    socket.to(room).emit("voiceMessageStopped", { messageId });
  });

  socket.on("disconnect", (reason) => {
    console.log(`User ${socket.userId} disconnected: ${reason}`);
    
    // Notify all other users that this user went offline
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "✅ Server running", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test CORS endpoint
app.get("/test-cors", (req, res) => {
  const origin = req.headers.origin;
  res.json({ 
    success: true, 
    message: "CORS is working!", 
    origin: origin,
    allowedOrigins: allowedOrigins
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      error: err.message
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// ============================
// DB & SERVER START
// ============================
const connectDB = require("./config/db");
const PORT = process.env.PORT || 5000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

connectDB()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📁 Static files served from: ${path.join(__dirname, 'uploads')}`);
      console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB Connection failed:", err);
    process.exit(1);
  });

module.exports = { app, io, server };
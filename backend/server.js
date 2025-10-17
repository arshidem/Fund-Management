// server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const path = require("path");
const fs = require("fs");

// Routes
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const participantRoutes = require("./routes/participantRoutes");
const contributionRoutes = require("./routes/contributionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const noteRoutes = require("./routes/noteRoutes");

// Socket
const { initializeSocket } = require("./socket");

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

// Static file serving (keep your existing static file setup)
const staticWithCors = (req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
};

app.use("/uploads", staticWithCors);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads directories if they don't exist
const uploadsDir = path.join(__dirname, "uploads");
const voiceMessagesDir = path.join(__dirname, "uploads", "voice-messages");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(voiceMessagesDir)) {
  fs.mkdirSync(voiceMessagesDir, { recursive: true });
}

// ============================
// CREATE HTTP SERVER & SOCKET
// ============================
const server = http.createServer(app);

// Initialize Socket.IO with all handlers
const io = initializeSocket(server, {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
  transports: ['websocket', 'polling']
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
      console.log(`🔌 Socket.IO initialized with message handlers`);
    });
  })
  .catch((err) => {
    console.error("❌ DB Connection failed:", err);
    process.exit(1);
  });

module.exports = { app, io, server };
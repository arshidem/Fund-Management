const express = require("express");
const router = express.Router();
const {
  createNotification,
  createBroadcastNotification,
  getNotifications,
  markAsRead,
} = require("../controllers/notificationController");

// Create notification for a single user
router.post("/", createNotification);

// Create broadcast notification for all users
router.post("/broadcast", createBroadcastNotification);

// Get all notifications for a user
router.get("/:userId", getNotifications);

// Mark notification as read
router.patch("/read/:notificationId", markAsRead);

module.exports = router;

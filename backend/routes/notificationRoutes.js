const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require('../controllers/notificationController');

// All routes are protected
router.use(protect);

// @route   GET /api/notifications
// @desc    Get current user's notifications
router.get('/', getMyNotifications);

// @route   GET /api/notifications/unread-count
// @desc    Get unread notifications count
router.get('/unread-count', getUnreadCount);

// @route   POST /api/notifications
// @desc    Create a new notification (admin only for broadcasting)
router.post('/', createNotification); // Add adminOnly middleware if needed

// @route   PUT /api/notifications/:id/read
// @desc    Mark a notification as read
router.put('/:id/read', markAsRead);

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read for current user
router.put('/mark-all-read', markAllAsRead);

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
router.delete('/:id', deleteNotification);

module.exports = router;
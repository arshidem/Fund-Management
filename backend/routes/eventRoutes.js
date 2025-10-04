// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  publishEvent,
  getEventStatistics,
  getUserEvents
} = require('../controllers/eventController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ==================== PUBLIC ROUTES ====================
router.get('/', getAllEvents);
router.get('/:id', getEventById);

// ==================== EVENT CREATOR ROUTES ====================
router.post('/', protect, createEvent);
router.put('/:id', protect, updateEvent);
router.delete('/:id', protect, deleteEvent);
router.patch('/:id/publish', protect, publishEvent);
router.get('/:id/statistics', protect, getEventStatistics);
router.get('/user/:userId', protect, getUserEvents);

// ==================== ADMIN-ONLY ROUTES ====================
router.put('/admin/:id', adminOnly, updateEvent);
router.delete('/admin/:id', adminOnly, deleteEvent);
router.patch('/admin/:id/publish', adminOnly, publishEvent);
router.get('/admin/:id/statistics', adminOnly, getEventStatistics);
router.get('/admin/user/:userId', adminOnly, getUserEvents);

module.exports = router;
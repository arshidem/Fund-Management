// routes/participantRoutes.js
const express = require('express');
const router = express.Router();
const {
  joinEvent,
  leaveEvent,
  getEventParticipants,
  getUserParticipations,
  updateParticipantStatus,
  removeParticipant,
  getParticipantDetails,
  inviteParticipant,
  checkUserParticipation
} = require('../controllers/participantController');
const { protect, adminOnly } = require('../middleware/authMiddleware');


// ==================== USER ACTIONS ====================
router.post('/events/:eventId/join', protect, joinEvent);
router.post('/events/:eventId/leave', protect, leaveEvent);

// ==================== CHECK PARTICIPATION ====================
router.get('/events/:eventId/check', protect, checkUserParticipation);

// ==================== USER DATA ====================
router.get('/user/:userId/participations', protect, getUserParticipations);

// ==================== EVENT CREATOR ROUTES ====================
router.get('/events/:eventId/participants', protect, getEventParticipants);
router.post('/events/:eventId/invite', protect, inviteParticipant);

// ==================== ADMIN-ONLY ROUTES ====================
router.get('/admin/events/:eventId/participants', adminOnly, getEventParticipants);
router.put('/admin/:participantId/status', adminOnly, updateParticipantStatus);
router.delete('/admin/:participantId', adminOnly, removeParticipant);

// ==================== GENERIC PARTICIPANT ROUTES (LAST) ====================
router.get('/:participantId', protect, getParticipantDetails);
router.put('/:participantId/status', protect, updateParticipantStatus);
router.delete('/:participantId', protect, removeParticipant);

module.exports = router;
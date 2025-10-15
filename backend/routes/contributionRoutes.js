// routes/contributionRoutes.js
const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createOfflineContribution,
  getEventContributions,
  getUserContributions,
  updateContributionStatus,
  processRefund,
  getContributionStatistics
} = require('../controllers/contributionController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ==================== PAYMENT ROUTES ====================
router.post('/events/:eventId/contributions/razorpay/order', protect, createRazorpayOrder);
router.post('/contributions/:contributionId/verify-razorpay', protect, verifyRazorpayPayment);
router.post('/:eventId/offline', protect, createOfflineContribution);

// ==================== USER ROUTES ====================
router.get('/user/:userId/contributions', protect, getUserContributions);

// ==================== EVENT CREATOR + ADMIN ROUTES ====================
router.get('/events/:eventId/contributions', protect, getEventContributions);
router.get('/events/:eventId/contributions/statistics', protect, getContributionStatistics);

// ==================== ADMIN-ONLY ROUTES ====================
router.put('/:contributionId/status', protect, adminOnly, updateContributionStatus);
router.patch('/:contributionId/refund', protect, adminOnly, processRefund);

module.exports = router;
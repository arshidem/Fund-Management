const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Import user controller methods only
const {
  getAllUsers,
  getUserById,
  getUserProfile,
  getUserActivity,
  approveUser,
  rejectUser,
  blockUser,
  unblockUser,
  updateUserRole,
  bulkAction
} = require('../controllers/userController');

// All routes are protected and admin-only
router.use(protect);
router.use(adminOnly);

// ==================== USER ROUTES ====================

// @route   GET /api/admin/users
// @desc    Get all users with filters and pagination
// @access  Private/Admin
router.get('/users', getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get user by ID
// @access  Private/Admin
router.get('/users/:id', getUserById);

// @route   GET /api/admin/users/:id/profile
// @desc    Get user profile with enhanced data
// @access  Private/Admin
router.get('/users/:id/profile', getUserProfile);

// @route   GET /api/admin/users/:id/activity
// @desc    Get user activity timeline
// @access  Private/Admin
router.get('/users/:id/activity', getUserActivity);

// @route   PUT /api/admin/users/:id/approve
// @desc    Approve user registration
// @access  Private/Admin
router.put('/users/:id/approve', approveUser);

// @route   PUT /api/admin/users/:id/reject
// @desc    Reject user registration
// @access  Private/Admin
router.put('/users/:id/reject', rejectUser);

// @route   PUT /api/admin/users/:id/block
// @desc    Block user
// @access  Private/Admin
router.put('/users/:id/block', blockUser);

// @route   PUT /api/admin/users/:id/unblock
// @desc    Unblock user
// @access  Private/Admin
router.put('/users/:id/unblock', unblockUser);

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Private/Admin
router.put('/users/:id/role', updateUserRole);

// @route   POST /api/admin/users/bulk-action
// @desc    Bulk actions (approve/block multiple users)
// @access  Private/Admin
router.post('/users/bulk-action', bulkAction);

module.exports = router;
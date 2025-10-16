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

  updateUserRole,
  bulkAction
} = require('../controllers/userController');

// All routes are protected and admin-only
router.use(protect);

// ==================== USER ROUTES ====================

// @route   GET /api/admin/users
// @desc    Get all users with filters and pagination
// @access  Private/Admin
router.get('/users', getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get user by ID
// @access  Private/Admin
router.get('/users/:id',adminOnly, getUserById);

// @route   GET /api/admin/users/:id/profile
// @desc    Get user profile with enhanced data
// @access  Private/Admin
router.get('/users/:id/profile',adminOnly, getUserProfile);

// @route   GET /api/admin/users/:id/activity
// @desc    Get user activity timeline
// @access  Private/Admin
router.get('/users/:id/activity',adminOnly, getUserActivity);

// @route   PUT /api/admin/users/:id/approve
// @desc    Approve user registration
// @access  Private/Admin
router.put('/users/:id/approve',adminOnly, approveUser);

// @route   PUT /api/admin/users/:id/reject
// @desc    Reject user registration
// @access  Private/Admin
router.put('/users/:id/reject',adminOnly, rejectUser);



// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Private/Admin
router.put('/users/:id/role',adminOnly, updateUserRole);

// @route   POST /api/admin/users/bulk-action
// @desc    Bulk actions (approve/ multiple users)
// @access  Private/Admin
router.post('/users/bulk-action',adminOnly, bulkAction);

module.exports = router;
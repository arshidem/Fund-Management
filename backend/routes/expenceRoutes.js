// routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const {
  createExpense,
  getEventExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  addReceipt,
  getExpenseStatistics
} = require('../controllers/expenseController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ==================== USER ROUTES (VIEW ONLY) ====================
// All authenticated users can view expenses
router.get('/events/:eventId/expenses', protect, getEventExpenses);
router.get('/:expenseId', protect, getExpenseById);
router.get('/events/:eventId/expenses/statistics', protect, getExpenseStatistics);

// ==================== ADMIN-ONLY ROUTES (FULL ACCESS) ====================
// Only admins can create, update, delete, and manage expenses
router.post('/events/:eventId/expenses', protect, adminOnly, createExpense);
router.put('/:expenseId', protect, adminOnly, updateExpense);
router.delete('/:expenseId', protect, adminOnly, deleteExpense);
router.patch('/:expenseId/receipt', protect, adminOnly, addReceipt);
router.patch('/:expenseId/approve', protect, adminOnly, approveExpense);
router.patch('/:expenseId/reject', protect, adminOnly, rejectExpense);

module.exports = router;
// controllers/expenseController.js
const Expense = require('../models/Expense');
const Event = require('../models/Event');
const User = require('../models/User');

// ==================== CREATE EXPENSE ====================
const createExpense = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      description,
      amount,
      category,
      subCategory,
      date,
      time,
      paymentMethod,
      transactionId,
      vendor,
      location,
      tags,
      priority,
      notes
    } = req.body;

    // Validate required fields
    if (!description || !amount || !category) {
      return res.status(400).json({
        success: false,
        message: 'Description, amount, and category are required'
      });
    }

    // Find event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // NO ADMIN CHECK - handled by route middleware
    // Create expense
    const expense = new Expense({
      event: eventId,
      description,
      amount: parseFloat(amount),
      category,
      subCategory,
      date: date || new Date(),
      time,
      paidBy: req.userId,
      paymentMethod: paymentMethod || 'cash',
      transactionId,
      vendor,
      location,
      tags,
      priority: priority || 'medium',
      notes,
      addedBy: req.userId,
      status: 'approved'
    });

    await expense.save();

    // Populate related data for response
    await expense.populate('paidBy', 'name email');
    await expense.populate('addedBy', 'name email');

    // Update event total expenses
    await event.updateFinancials();

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      expense: expense.toExpenseJSON()
    });

  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating expense',
      error: error.message
    });
  }
};

// ==================== GET EVENT EXPENSES ====================
const getEventExpenses = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      status,
      category,
      page = 1,
      limit = 20,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Find event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // NO ADMIN CHECK - all authenticated users can view expenses
    // Build query
    let query = { event: eventId };
    
    if (status) query.status = status;
    if (category) query.category = category;

    // Search functionality
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { 'vendor.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get expenses with pagination
    const expenses = await Expense.find(query)
      .populate('paidBy', 'name email')
      .populate('addedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const total = await Expense.countDocuments(query);

    // Get expense summary
    const expenseSummary = await Expense.aggregate([
      {
        $match: { 
          event: event._id,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          expenseCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    const expensesWithDetails = expenses.map(expense => 
      expense.toExpenseJSON()
    );

    res.json({
      success: true,
      expenses: expensesWithDetails,
      summary: {
        totalExpenses: total,
        categorySummary: expenseSummary.map(item => ({
          category: item._id,
          totalAmount: item.totalAmount,
          expenseCount: item.expenseCount,
          averageAmount: item.averageAmount
        }))
      },
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get event expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expenses',
      error: error.message
    });
  }
};

// ==================== GET EXPENSE BY ID ====================
const getExpenseById = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findById(expenseId)
      .populate('paidBy', 'name email phone')
      .populate('addedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // NO ADMIN CHECK - all authenticated users can view expenses
    res.json({
      success: true,
      expense: expense.toExpenseJSON()
    });

  } catch (error) {
    console.error('Get expense by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expense',
      error: error.message
    });
  }
};

// ==================== UPDATE EXPENSE ====================
const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const updateData = req.body;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // NO ADMIN CHECK - handled by route middleware
    // Prevent updating certain fields if expense is approved
    if (expense.status === 'approved' && updateData.amount) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update amount of approved expense'
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'status') {
        expense[key] = updateData[key];
      }
    });

    await expense.save();

    // Update event financials if amount changed
    if (updateData.amount) {
      const event = await Event.findById(expense.event);
      await event.updateFinancials();
    }

    await expense.populate('paidBy', 'name email');
    await expense.populate('addedBy', 'name email');

    res.json({
      success: true,
      message: 'Expense updated successfully',
      expense: expense.toExpenseJSON()
    });

  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating expense',
      error: error.message
    });
  }
};

// ==================== DELETE EXPENSE ====================
const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // NO ADMIN CHECK - handled by route middleware
    // Store amount for event update
    const expenseAmount = expense.amount;

    await Expense.findByIdAndDelete(expenseId);

    // Update event financials
    const event = await Event.findById(expense.event);
    event.totalExpenses -= expenseAmount;
    await event.save();

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });

  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting expense',
      error: error.message
    });
  }
};

// ==================== APPROVE EXPENSE ====================
const approveExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { notes } = req.body;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // NO ADMIN CHECK - handled by route middleware
    await expense.approve(req.userId, notes);

    // Update event financials
    const event = await Event.findById(expense.event);
    await event.updateFinancials();

    await expense.populate('paidBy', 'name email');
    await expense.populate('approvedBy', 'name email');

    res.json({
      success: true,
      message: 'Expense approved successfully',
      expense: expense.toExpenseJSON()
    });

  } catch (error) {
    console.error('Approve expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving expense',
      error: error.message
    });
  }
};

// ==================== REJECT EXPENSE ====================
const rejectExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { reason } = req.body;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // NO ADMIN CHECK - handled by route middleware
    await expense.reject(req.userId, reason);

    await expense.populate('paidBy', 'name email');
    await expense.populate('rejectedBy', 'name email');

    res.json({
      success: true,
      message: 'Expense rejected successfully',
      expense: expense.toExpenseJSON()
    });

  } catch (error) {
    console.error('Reject expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting expense',
      error: error.message
    });
  }
};

// ==================== ADD RECEIPT TO EXPENSE ====================
const addReceipt = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { fileUrl, fileName, fileSize } = req.body;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // NO ADMIN CHECK - handled by route middleware
    await expense.addReceipt(fileUrl, fileName, fileSize);

    res.json({
      success: true,
      message: 'Receipt added successfully',
      expense: expense.toExpenseJSON()
    });

  } catch (error) {
    console.error('Add receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding receipt',
      error: error.message
    });
  }
};

// ==================== GET EXPENSE STATISTICS ====================
const getExpenseStatistics = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // NO ADMIN CHECK - all authenticated users can view statistics
    const statistics = await Expense.aggregate([
      {
        $match: {
          event: event._id,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' },
          expenseCount: { $sum: 1 },
          averageExpense: { $avg: '$amount' },
          maxExpense: { $max: '$amount' },
          minExpense: { $min: '$amount' }
        }
      }
    ]);

    const categoryStats = await Expense.aggregate([
      {
        $match: {
          event: event._id,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          percentage: { $avg: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          total: 1,
          count: 1,
          percentage: { $multiply: ['$percentage', 100] },
          _id: 0
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    const monthlyStats = await Expense.aggregate([
      {
        $match: {
          event: event._id,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      statistics: {
        overview: statistics[0] || {
          totalExpenses: 0,
          expenseCount: 0,
          averageExpense: 0,
          maxExpense: 0,
          minExpense: 0
        },
        byCategory: categoryStats,
        monthly: monthlyStats
      }
    });

  } catch (error) {
    console.error('Get expense statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expense statistics',
      error: error.message
    });
  }
};

module.exports = { 
  createExpense,
  getEventExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  addReceipt,
  getExpenseStatistics
};
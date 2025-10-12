const AdminNote = require('../models/AdminNote');
const User = require('../models/User');

// @desc    Get notes for a user
// @access  Private/Admin
exports.getUserNotes = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Verify user exists
    const user = await User.findById(userId).select('name email');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const notes = await AdminNote.find({ userId })
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await AdminNote.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        user,
        notes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get user notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user notes'
    });
  }
};

// @desc    Create admin note
// @access  Private/Admin
exports.createNote = async (req, res) => {
  try {
    const { userId, note, category = 'general', tags = [], isPrivate = true } = req.body;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const adminNote = await AdminNote.create({
      userId,
      adminId: req.userId,
      note,
      category,
      tags,
      isPrivate
    });

    await adminNote.populate('adminId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      data: adminNote
    });

  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating note'
    });
  }
};

// @desc    Update admin note
// @access  Private/Admin
exports.updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, category, tags, isPrivate } = req.body;

    const adminNote = await AdminNote.findById(id);

    if (!adminNote) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Check if admin owns the note or is super admin
    if (adminNote.adminId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this note'
      });
    }

    // Update fields
    if (note !== undefined) adminNote.note = note;
    if (category !== undefined) adminNote.category = category;
    if (tags !== undefined) adminNote.tags = tags;
    if (isPrivate !== undefined) adminNote.isPrivate = isPrivate;

    await adminNote.save();
    await adminNote.populate('adminId', 'name email');

    res.json({
      success: true,
      message: 'Note updated successfully',
      data: adminNote
    });

  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating note'
    });
  }
};

// @desc    Delete admin note
// @access  Private/Admin
exports.deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    const adminNote = await AdminNote.findById(id);

    if (!adminNote) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Check if admin owns the note or is super admin
    if (adminNote.adminId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this note'
      });
    }

    await AdminNote.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });

  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting note'
    });
  }
};

// @desc    Get all notes (for admin dashboard)
// @access  Private/Admin
exports.getAllNotes = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, userId } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let query = {};
    if (category) query.category = category;
    if (userId) query.userId = userId;

    const notes = await AdminNote.find(query)
      .populate('adminId', 'name email')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await AdminNote.countDocuments(query);

    res.json({
      success: true,
      data: notes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Get all notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notes'
    });
  }
};
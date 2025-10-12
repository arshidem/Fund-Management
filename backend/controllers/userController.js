const User = require('../models/User');
const Message = require('../models/Message');
const AdminNote = require('../models/AdminNote');
const Participant = require('../models/Participant');
const { sendNotificationToUser } = require('../services/notificationService');

// @desc    Get all users with filters and pagination
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      role = ''
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = {};

    // Search filter (name or email)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      switch (status) {
        case 'pending':
          query.isApproved = false;
          query.isBlocked = false;
          break;
        case 'approved':
          query.isApproved = true;
          query.isBlocked = false;
          break;
        case 'blocked':
          query.isBlocked = true;
          break;
        case 'rejected':
          query.isApproved = false;
          query.isBlocked = true;
          break;
      }
    }

    // Role filter
    if (role) {
      query.role = role;
    }

    // Get users with pagination
    const users = await User.find(query)
      .select('-otp -otpExpires -subscriptions')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(query);

    // Get counts for different statuses
    const counts = await User.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          pending: [
            { $match: { isApproved: false, isBlocked: false } },
            { $count: 'count' }
          ],
          approved: [
            { $match: { isApproved: true, isBlocked: false } },
            { $count: 'count' }
          ],
          blocked: [
            { $match: { isBlocked: true } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      counts: {
        total: counts[0].total[0]?.count || 0,
        pending: counts[0].pending[0]?.count || 0,
        approved: counts[0].approved[0]?.count || 0,
        blocked: counts[0].blocked[0]?.count || 0
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
};

// @desc    Get user by ID
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-otp -otpExpires -subscriptions');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    });
  }
};

// @desc    Get user profile with enhanced data
// @access  Private/Admin
exports.getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-otp -otpExpires -subscriptions -password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get participation stats from Participant model
    const participationStats = await Participant.aggregate([
      {
        $match: { user: user._id }
      },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          activeEvents: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
            }
          },
          totalContributed: { $sum: '$totalContributed' },
          paidEvents: {
            $sum: {
              $cond: [
                { $in: ['$paymentStatus', ['paid', 'overpaid']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get recent participations
    const recentParticipations = await Participant.find({ user: user._id })
      .populate('event', 'title date location status')
      .sort({ joinedAt: -1 })
      .limit(5);

    // Get note count
    const noteCount = await AdminNote.countDocuments({ userId: user._id });

    // Get message count
    const messageCount = await Message.countDocuments({
      $or: [
        { sender: user._id },
        { recipient: user._id }
      ]
    });

    const stats = participationStats[0] || {
      totalEvents: 0,
      activeEvents: 0,
      totalContributed: 0,
      paidEvents: 0
    };

    res.json({
      success: true,
      data: {
        user,
        stats: {
          ...stats,
          noteCount,
          messageCount
        },
        recentParticipations,
        participationHistory: {
          totalEvents: stats.totalEvents,
          activeParticipations: stats.activeEvents,
          totalContributions: stats.totalContributed,
          fullyPaidEvents: stats.paidEvents
        }
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
};

// @desc    Get user activity timeline
// @access  Private/Admin
exports.getUserActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get combined activity from multiple sources
    const participations = await Participant.find({ user: id })
      .populate('event', 'title date')
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Transform to activity format
    const activities = participations.map(participation => ({
      type: 'participation',
      action: participation.status === 'active' ? 'joined_event' : 'left_event',
      description: `${participation.status === 'active' ? 'Joined' : 'Left'} event: ${participation.event?.title}`,
      timestamp: participation.joinedAt,
      metadata: {
        eventId: participation.event?._id,
        eventTitle: participation.event?.title,
        status: participation.status,
        contribution: participation.totalContributed
      }
    }));

    const total = await Participant.countDocuments({ user: id });

    res.json({
      success: true,
      data: activities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user activity'
    });
  }
};

// @desc    Approve user registration
// @access  Private/Admin
exports.approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'User is already approved'
      });
    }

    // Approve the user
    user.isApproved = true;
    user.isBlocked = false; // Ensure user is not blocked
    user.isActive = true;
    await user.save();

    // Send notification to user
    try {
      await sendNotificationToUser(user._id, {
        title: 'Account Approved',
        message: `Your account has been approved! You can now access all features.`,
        type: 'account_approved',
        actionUrl: '/dashboard',
        priority: 'high'
      }, req);
    } catch (notificationError) {
      console.error('Failed to send approval notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'User approved successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isApproved: user.isApproved,
        isBlocked: user.isBlocked
      }
    });

  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving user'
    });
  }
};

// @desc    Reject user registration
// @access  Private/Admin
exports.rejectUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isBlocked) {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked/rejected'
      });
    }

    // Reject the user (block and don't approve)
    user.isBlocked = true;
    user.isApproved = false;
    user.isActive = false;
    await user.save();

    // Send notification to user
    try {
      await sendNotificationToUser(user._id, {
        title: 'Registration Rejected',
        message: `Your registration has been rejected. ${reason ? `Reason: ${reason}` : 'Please contact admin for more information.'}`,
        type: 'account_rejected',
        actionUrl: '/contact',
        priority: 'high'
      }, req);
    } catch (notificationError) {
      console.error('Failed to send rejection notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'User registration rejected',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isApproved: user.isApproved,
        isBlocked: user.isBlocked
      }
    });

  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting user'
    });
  }
};

// @desc    Block user
// @access  Private/Admin
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isBlocked) {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked'
      });
    }

    // Block the user
    user.isBlocked = true;
    user.isActive = false;
    await user.save();

    // Send notification to user
    try {
      await sendNotificationToUser(user._id, {
        title: 'Account Blocked',
        message: `Your account has been temporarily blocked. ${reason ? `Reason: ${reason}` : 'Please contact admin for more information.'}`,
        type: 'account_blocked',
        actionUrl: '/contact',
        priority: 'high'
      }, req);
    } catch (notificationError) {
      console.error('Failed to send block notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'User blocked successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isApproved: user.isApproved,
        isBlocked: user.isBlocked
      }
    });

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error blocking user'
    });
  }
};

// @desc    Unblock user
// @access  Private/Admin
exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isBlocked) {
      return res.status(400).json({
        success: false,
        message: 'User is not blocked'
      });
    }

    // Unblock the user
    user.isBlocked = false;
    user.isActive = true;
    await user.save();

    // Send notification to user
    try {
      await sendNotificationToUser(user._id, {
        title: 'Account Unblocked',
        message: 'Your account has been unblocked. You can now access all features.',
        type: 'account_unblocked',
        actionUrl: '/dashboard',
        priority: 'high'
      }, req);
    } catch (notificationError) {
      console.error('Failed to send unblock notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'User unblocked successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isApproved: user.isApproved,
        isBlocked: user.isBlocked
      }
    });

  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error unblocking user'
    });
  }
};

// @desc    Update user role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['user', 'admin', 'moderator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: user, admin, moderator'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-demotion
    if (id === req.userId && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role from admin'
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user role'
    });
  }
};

// @desc    Bulk actions (approve/block multiple users)
// @access  Private/Admin
exports.bulkAction = async (req, res) => {
  try {
    const { userIds, action } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    if (!['approve', 'block', 'unblock'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be: approve, block, or unblock'
      });
    }

    let updateQuery = {};
    let message = '';

    switch (action) {
      case 'approve':
        updateQuery = { isApproved: true, isBlocked: false, isActive: true };
        message = 'approved';
        break;
      case 'block':
        updateQuery = { isBlocked: true, isActive: false };
        message = 'blocked';
        break;
      case 'unblock':
        updateQuery = { isBlocked: false, isActive: true };
        message = 'unblocked';
        break;
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updateQuery }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} users ${message} successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk action'
    });
  }
};
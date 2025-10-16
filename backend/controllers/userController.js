const User = require('../models/User');
const Message = require('../models/Message');
const AdminNote = require('../models/AdminNote');
const Participant = require('../models/Participant');
const { sendNotificationToUser } = require('../services/notificationService');
const Contribution = require('../models/Contribution');
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
          break;
        case 'approved':
          query.isApproved = true;
          break;
       
        case 'rejected':
          query.isApproved = false;
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
            { $match: { isApproved: false} },
            { $count: 'count' }
          ],
          approved: [
            { $match: { isApproved: true} },
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
// Enhanced version with monthly breakdown
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

    // Get participation stats
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

    // Get recent participations with detailed contribution data
    const recentParticipations = await Participant.find({ user: user._id })
      .populate('event', 'title date location status totalAmount')
      .sort({ joinedAt: -1 })
      .limit(5)
      .lean();

    // For each participation, get the actual contributions from Contribution model
    const participationsWithContributions = await Promise.all(
      recentParticipations.map(async (participation) => {
        // Get all contributions for this specific participation
        const contributions = await Contribution.find({
          user: user._id,
          event: participation.event?._id
        }).select('amount paymentMethod status paymentDate');

        // Calculate total contributed for this event (only count completed payments)
        const totalContributed = contributions.reduce((sum, contribution) => {
          // Only count completed contributions
          if (contribution.status === 'completed') {
            return sum + (contribution.amount || 0);
          }
          return sum;
        }, 0);

        // Get contribution breakdown
        const contributionBreakdown = contributions.map(contrib => ({
          amount: contrib.amount,
          paymentMethod: contrib.paymentMethod,
          status: contrib.status, // This will show 'completed', 'pending', 'failed', etc.
          date: contrib.paymentDate
        }));

        // Determine overall payment status for this participation
        const hasCompletedPayments = contributions.some(c => c.status === 'completed');
        const hasPendingPayments = contributions.some(c => c.status === 'pending');
        
        let paymentStatus = 'pending';
        if (hasCompletedPayments) {
          paymentStatus = participation.event?.totalAmount 
            ? (totalContributed >= participation.event.totalAmount ? 'paid' : 'partial')
            : 'paid';
        }

        return {
          ...participation,
          totalContributed: totalContributed,
          contributionBreakdown: contributionBreakdown,
          contributionsCount: contributions.length,
          // Add payment status based on actual contributions
          paymentStatus: paymentStatus,
          // Add remaining amount if event has totalAmount
          remainingAmount: participation.event?.totalAmount 
            ? participation.event.totalAmount - totalContributed 
            : 0,
          paymentProgress: participation.event?.totalAmount 
            ? Math.round((totalContributed / participation.event.totalAmount) * 100)
            : 0
        };
      })
    );

    // Get overall contribution statistics - FIXED STATUS CHECK
    const contributionStats = await Contribution.aggregate([
      {
        $match: { user: user._id }
      },
      {
        $group: {
          _id: null,
          totalContributions: { 
            $sum: {
              $cond: [
                { $eq: ['$status', 'completed'] }, 
                '$amount', 
                0
              ]
            }
          },
          contributionCount: { $sum: 1 },
          completedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          failedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
            }
          },
          pendingPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          },
          refundedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0]
            }
          },
          averageContribution: { 
            $avg: {
              $cond: [
                { $eq: ['$status', 'completed'] }, 
                '$amount', 
                null
              ]
            }
          },
          lastContribution: { $max: '$paymentDate' },
          minContribution: { 
            $min: {
              $cond: [
                { $eq: ['$status', 'completed'] }, 
                '$amount', 
                null
              ]
            }
          },
          maxContribution: { 
            $max: {
              $cond: [
                { $eq: ['$status', 'completed'] }, 
                '$amount', 
                null
              ]
            }
          }
        }
      }
    ]);

    // Get note count
    const noteCount = await AdminNote.countDocuments({ userId: user._id });

    const stats = participationStats[0] || {
      totalEvents: 0,
      activeEvents: 0,
      totalContributed: 0,
      paidEvents: 0
    };

    const contributionData = contributionStats[0] || {
      totalContributions: 0,
      contributionCount: 0,
      completedPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      refundedPayments: 0,
      averageContribution: 0,
      lastContribution: null,
      minContribution: 0,
      maxContribution: 0
    };

    res.json({
      success: true,
      data: {
        user,
        stats: {
          ...stats,
          noteCount,
          totalContributions: contributionData.totalContributions,
          contributionCount: contributionData.contributionCount,
          completedPayments: contributionData.completedPayments,
          failedPayments: contributionData.failedPayments,
          pendingPayments: contributionData.pendingPayments,
          refundedPayments: contributionData.refundedPayments,
          averageContribution: Math.round(contributionData.averageContribution || 0),
          lastContribution: contributionData.lastContribution,
          completionRate: contributionData.contributionCount > 0 
            ? Math.round((contributionData.completedPayments / contributionData.contributionCount) * 100)
            : 0
        },
        recentParticipations: participationsWithContributions,
        participationHistory: {
          totalEvents: stats.totalEvents,
          activeParticipations: stats.activeEvents,
          totalContributions: contributionData.totalContributions,
          fullyPaidEvents: stats.paidEvents,
          contributionStats: {
            totalCount: contributionData.contributionCount,
            completionRate: contributionData.contributionCount > 0 
              ? Math.round((contributionData.completedPayments / contributionData.contributionCount) * 100)
              : 0,
            averageAmount: Math.round(contributionData.averageContribution || 0),
            minAmount: contributionData.minContribution || 0,
            maxAmount: contributionData.maxContribution || 0
          }
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

    if (!['approve'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be: approve'
      });
    }

    let updateQuery = {};
    let message = '';

    switch (action) {
      case 'approve':
        updateQuery = { isApproved: true, isActive: true };
        message = 'approved';
      
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
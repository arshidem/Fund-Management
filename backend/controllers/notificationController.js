// controllers/notificationController.js
const Notification = require('../models/Notification');
const User = require('../models/User');

// @desc    Create a new notification
// @access  Private
exports.createNotification = async (req, res) => {
  try {
    const { 
      recipientId, 
      title, 
      message, 
      type = 'general', 
      priority = 'medium',
      broadcastToAll = false,
      actionUrl = '/notifications',
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and message are required' 
      });
    }

    // If not broadcast, validate recipient
    if (!broadcastToAll && !recipientId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient ID is required for individual notifications' 
      });
    }

    const notificationData = {
      sender: req.userId,
      title,
      message,
      type,
      priority,
      broadcastToAll,
      actionUrl,
      metadata
    };

    // Add recipient if not broadcast
    if (!broadcastToAll) {
      notificationData.recipient = recipientId;
    }

    const notification = await Notification.create(notificationData);

    // Populate sender info for real-time emission
    await notification.populate('sender', 'name email');

    res.status(201).json({
      success: true,
      data: notification
    });

    // Emit real-time notification if socket is available
    if (req.io) {
      if (broadcastToAll) {
        // Broadcast to all connected users
        req.io.emit('newNotification', notification);
      } else {
        // Send to specific recipient
        req.io.to(`user-${recipientId}`).emit('newNotification', notification);
      }
    }

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error creating notification' 
    });
  }
};

// @desc    Get all notifications for current user
// @access  Private
// @desc    Get all notifications for current user (deduplicate approval types only)
// @access  Private
exports.getMyNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, unreadOnly } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build base query
    let baseQuery = {
      $or: [
        { recipient: req.userId },
        { broadcastToAll: true }
      ]
    };

    // Add filters
    if (type) baseQuery.type = type;
    if (unreadOnly === 'true') baseQuery.isRead = false;

    // Get notifications in two batches:
    // 1. Approval notifications (to deduplicate)
    // 2. Other notifications (to show all)
    
    const approvalQuery = {
      ...baseQuery,
      type: { $in: ['entry_approval', 'account_approved'] }
    };

    const otherQuery = {
      ...baseQuery,
      type: { $nin: ['entry_approval', 'account_approved'] }
    };

    // Get approval notifications and deduplicate
    const approvalNotifications = await Notification.find(approvalQuery)
      .populate('sender', 'name email')
      .populate({
        path: 'metadata.newUserId',
        select: 'name email'
      })
      .sort({ createdAt: -1 })
      .limit(100) // Get enough to deduplicate properly
      .lean();

    // Deduplicate approval notifications - keep only latest per user
    const uniqueApprovalNotifications = [];
    const seenUsers = new Set();
    
    approvalNotifications.forEach(notification => {
      const userId = notification.metadata?.newUserId?._id?.toString() || 
                    notification.metadata?.newUserId?.toString();
      
      if (userId && !seenUsers.has(userId)) {
        seenUsers.add(userId);
        uniqueApprovalNotifications.push(notification);
      }
    });

    // Get other notifications (messages, payments, etc.) - show all
    const otherNotifications = await Notification.find(otherQuery)
      .populate('sender', 'name email')
      .populate({
        path: 'metadata.newUserId',
        select: 'name email'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Combine results
    const allNotifications = [
      ...uniqueApprovalNotifications.slice(0, Math.ceil(limitNum / 2)), // Half for approvals
      ...otherNotifications.slice(0, Math.ceil(limitNum / 2)) // Half for others
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort by latest
     .slice(0, limitNum); // Final limit

    const total = await Notification.countDocuments(baseQuery);
    const unreadCount = await Notification.getUnreadCount(req.userId);

    res.json({
      success: true,
      data: allNotifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: allNotifications.length,
        pages: Math.ceil(total / limitNum)
      },
      unreadCount
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching notifications' 
    });
  }
};

// @desc    Get unread notifications count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.userId);
    
    res.json({
      success: true,
      data: { unreadCount: count }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching unread count' 
    });
  }
};

// @desc    Mark notification as read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      $or: [
        { recipient: req.userId },
        { broadcastToAll: true }
      ]
    });

    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    // Emit real-time update
    if (req.io) {
      req.io.to(`user-${req.userId}`).emit('notificationRead', {
        notificationId: id,
        unreadCount: await Notification.getUnreadCount(req.userId)
      });
    }

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error marking notification as read' 
    });
  }
};

// @desc    Mark all notifications as read
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        $or: [
          { recipient: req.userId },
          { broadcastToAll: true }
        ],
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    // Emit real-time update
    if (req.io) {
      req.io.to(`user-${req.userId}`).emit('allNotificationsRead', {
        unreadCount: 0
      });
    }

    res.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
        message: `Marked ${result.modifiedCount} notifications as read`
      }
    });

  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error marking all notifications as read' 
    });
  }
};

// @desc    Delete a notification
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      $or: [
        { recipient: req.userId },
        { broadcastToAll: true }
      ]
    });

    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }

    // Emit real-time update for unread count
    if (req.io) {
      req.io.to(`user-${req.userId}`).emit('notificationDeleted', {
        notificationId: id,
        unreadCount: await Notification.getUnreadCount(req.userId)
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error deleting notification' 
    });
  }
};



// @desc    Send payment due notification to user
// @access  Private
exports.sendPaymentDueNotification = async (userId, paymentDetails, req = null) => {
  try {
    const user = await User.findById(userId).select('name email');
    
    const notification = await Notification.create({
      recipient: userId,
      title: 'Payment Due Reminder',
      message: `Your payment of $${paymentDetails.amount} for ${paymentDetails.purpose} is due on ${new Date(paymentDetails.dueDate).toLocaleDateString()}.`,
      type: 'payment_due',
      priority: 'high',
      actionUrl: `/payments/${paymentDetails.paymentId}`,
      metadata: {
        paymentId: paymentDetails.paymentId,
        amount: paymentDetails.amount,
        dueDate: paymentDetails.dueDate,
        purpose: paymentDetails.purpose
      }
    });

    await notification.populate('sender', 'name email');

    // Emit real-time notification
    if (req && req.io) {
      req.io.to(`user-${userId}`).emit('newNotification', notification);
    }

    console.log(`Payment due notification sent to user ${userId}`);
    return notification;

  } catch (error) {
    console.error('Send payment due notification error:', error);
    throw error;
  }
};
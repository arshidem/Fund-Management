// services/notificationService.js
const Notification = require('../models/Notification');
const User = require('../models/User');

// @desc    Send entry approval notification to admin
// @access  Private
exports.sendEntryApprovalNotification = async (newUserId, req = null) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    
    if (admins.length === 0) {
      console.log('No admin users found for entry approval notification');
      return;
    }

    const newUser = await User.findById(newUserId).select('name email createdAt');
    if (!newUser) {
      console.log('New user not found for notification');
      return;
    }
    
    // Create notification for each admin
    const notificationPromises = admins.map(admin => 
      Notification.create({
        recipient: admin._id,
        title: 'New User Registration',
        message: `New user ${newUser.name} (${newUser.email}) has registered and requires approval.`,
        type: 'entry_approval',
        priority: 'high',
        actionUrl: `/admin/users/${newUserId}`,
        metadata: {
          newUserId: newUserId,
          userEmail: newUser.email,
          userName: newUser.name,
          registrationDate: newUser.createdAt
        }
      })
    );

    const notifications = await Promise.all(notificationPromises);

    // Emit real-time notifications
    if (req && req.io) {
      admins.forEach((admin, index) => {
        req.io.to(`user-${admin._id}`).emit('newNotification', {
          ...notifications[index].toObject(),
          isRead: false
        });
      });
    }

    console.log(`Entry approval notifications sent to ${admins.length} admin(s)`);
    return notifications;

  } catch (error) {
    console.error('Send entry approval notification error:', error);
    throw error;
  }
};

// @desc    Send notification to specific user
// @access  Private
exports.sendNotificationToUser = async (userId, notificationData, req = null) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found for notification:', userId);
      return;
    }

    const notification = await Notification.create({
      recipient: userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'general',
      priority: notificationData.priority || 'medium',
      actionUrl: notificationData.actionUrl,
      metadata: notificationData.metadata || {}
    });

    // Emit real-time notification
    if (req && req.io) {
      req.io.to(`user-${userId}`).emit('newNotification', {
        ...notification.toObject(),
        isRead: false
      });
    }

    console.log(`✅ Notification sent to user ${userId}`);
    return notification;

  } catch (error) {
    console.error('Send notification to user error:', error);
    throw error;
  }
};

// @desc    Send message notification (when someone sends a message)
// @access  Private
exports.sendMessageNotification = async (recipientId, messageData, req = null) => {
  try {
    const sender = await User.findById(messageData.senderId).select('name');
    
    const notification = await Notification.create({
      recipient: recipientId,
      title: 'New Message',
      message: `You have a new message from ${sender.name}`,
      type: 'message',
      priority: 'medium',
      actionUrl: `/messages/${messageData.senderId}`,
      metadata: {
        messageId: messageData.messageId,
        senderId: messageData.senderId,
        senderName: sender.name,
        messagePreview: messageData.body?.substring(0, 100) || 'New message'
      }
    });

    // Emit real-time notification
    if (req && req.io) {
      req.io.to(`user-${recipientId}`).emit('newNotification', notification);
      
      // Also emit a specific message event for real-time chat
      req.io.to(`user-${recipientId}`).emit('newMessageNotification', {
        messageId: messageData.messageId,
        senderId: messageData.senderId,
        senderName: sender.name,
        preview: messageData.body?.substring(0, 100) || 'New message',
        timestamp: new Date()
      });
    }

    console.log(`Message notification sent to user ${recipientId}`);
    return notification;

  } catch (error) {
    console.error('Send message notification error:', error);
    throw error;
  }
};

// @desc    Send group message notification
// @access  Private
exports.sendGroupMessageNotification = async (groupId, messageData, req = null) => {
  try {
    const Group = require('../models/Group');
    const group = await Group.findById(groupId).populate('participants.user', '_id');
    
    if (!group) {
      console.log('Group not found for notification');
      return;
    }

    const sender = await User.findById(messageData.senderId).select('name');
    const participants = group.participants.map(p => p.user._id.toString());
    
    // Remove sender from participants to avoid self-notification
    const recipients = participants.filter(id => id !== messageData.senderId);

    const notificationPromises = recipients.map(recipientId =>
      Notification.create({
        recipient: recipientId,
        title: `New Message in ${group.name}`,
        message: `${sender.name} sent a message in ${group.name}`,
        type: 'group_message',
        priority: 'medium',
        actionUrl: `/messages/group/${groupId}`,
        metadata: {
          groupId: groupId,
          groupName: group.name,
          messageId: messageData.messageId,
          senderId: messageData.senderId,
          senderName: sender.name,
          messagePreview: messageData.body?.substring(0, 100) || 'New message'
        }
      })
    );

    const notifications = await Promise.all(notificationPromises);

    // Emit real-time notifications
    if (req && req.io) {
      recipients.forEach((recipientId, index) => {
        req.io.to(`user-${recipientId}`).emit('newNotification', notifications[index]);
      });
    }

    console.log(`Group message notifications sent to ${recipients.length} users`);
    return notifications;

  } catch (error) {
    console.error('Send group message notification error:', error);
    throw error;
  }
};
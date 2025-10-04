const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
  constructor(io) {
    this.io = io;
  }

  // Send notification to specific user
  async sendToUser(userId, notificationData) {
    try {
      const notification = await Notification.create({
        recipient: userId,
        ...notificationData
      });

      // Emit real-time notification
      this.io.to(`user-${userId}`).emit('new-notification', notification);

      return notification;
    } catch (error) {
      console.error('Error sending notification to user:', error);
      throw error;
    }
  }

  // Send notification to all users
  async sendToAllUsers(notificationData) {
    try {
      const users = await User.find({}, '_id');
      const notifications = [];

      for (const user of users) {
        const notification = await Notification.create({
          recipient: user._id,
          ...notificationData
        });
        notifications.push(notification);

        // Emit real-time to each user
        this.io.to(`user-${user._id}`).emit('new-notification', notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending notification to all users:', error);
      throw error;
    }
  }

  // Send to multiple specific users
  async sendToUsers(userIds, notificationData) {
    try {
      const notifications = [];

      for (const userId of userIds) {
        const notification = await Notification.create({
          recipient: userId,
          ...notificationData
        });
        notifications.push(notification);

        this.io.to(`user-${userId}`).emit('new-notification', notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending notification to users:', error);
      throw error;
    }
  }

  // Send to admin users
  async sendToAdmins(notificationData) {
    try {
      const admins = await User.find({ role: 'admin' }, '_id');
      return await this.sendToUsers(admins.map(admin => admin._id), notificationData);
    } catch (error) {
      console.error('Error sending notification to admins:', error);
      throw error;
    }
  }

  // Specific notification types
  async sendUserApprovalRequest(userData) {
    return await this.sendToAdmins({
      type: 'USER_APPROVAL_REQUEST',
      title: 'New User Registration',
      message: `${userData.name} is requesting approval to join the platform`,
      data: { userId: userData._id, userName: userData.name },
      priority: 'HIGH'
    });
  }

  async sendPaymentReminder(userId, paymentData) {
    return await this.sendToUser(userId, {
      type: 'PAYMENT_REMINDER',
      title: 'Payment Reminder',
      message: `Please pay your pending amount: ₹${paymentData.amount}. Due date: ${paymentData.dueDate}`,
      data: paymentData,
      priority: 'URGENT',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  async sendPaymentReceived(userId, paymentData) {
    return await this.sendToUser(userId, {
      type: 'PAYMENT_RECEIVED',
      title: 'Payment Received',
      message: `Payment of ₹${paymentData.amount} received successfully`,
      data: paymentData,
      priority: 'MEDIUM'
    });
  }

  async sendAnnouncementToAll(title, message) {
    return await this.sendToAllUsers({
      type: 'ANNOUNCEMENT',
      title: title,
      message: message,
      priority: 'HIGH'
    });
  }
}

module.exports = NotificationService;
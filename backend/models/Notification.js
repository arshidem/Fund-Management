const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.broadcastToAll;
    }
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['entry_approval', 'payment_due', 'payment_received', 'account_approved', 'general','message', 'warning', 'info'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  broadcastToAll: {
    type: Boolean,
    default: false
  },
  actionUrl: {
    type: String,
    default: '/notifications'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for better query performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ broadcastToAll: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    $or: [
      { recipient: userId },
      { broadcastToAll: true }
    ],
    isRead: false
  });
};

module.exports = mongoose.model('Notification', notificationSchema);
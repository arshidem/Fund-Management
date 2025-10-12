const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Basic Message Info
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // For one-to-one messages; optional for event-group messages
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  // Message text/body
  body: {
    type: String,
    maxlength: 10000,
    trim: true,
    default: ''
  },

  // Message Types & Content
  type: {
    type: String,
    enum: [
      'text',
      'image',
      'audio',
      'document',
      'video',
      'system',
      'multiple'
    ],
    default: 'text'
  },

  // File Attachments
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'audio', 'video', 'document', 'other'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    thumbnail: String,
    filename: String,
    originalName: String,
    size: Number,
    duration: Number,
    mimeType: String,
    waveform: [Number]
  }],

  // Delivery / Read status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: Date,
  readAt: Date,
  isRead: {
    type: Boolean,
    default: false
  },

  // Threading / Reply
  replyTo: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    snippet: String,
    senderName: String
  },

  // Reactions
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    },
    reactedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Forwarding
  forwardedFrom: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    originalSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    forwardedAt: Date
  },
  forwardCount: {
    type: Number,
    default: 0
  },

  // Deleted for specific users
  deletedFor: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Starred messages
  starredBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    starredAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Admin labels and internal notes
  adminLabels: [{
    label: {
      type: String,
      enum: ['urgent', 'follow-up', 'billing', 'verification', 'complaint']
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  internalNotes: [{
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: {
      type: String,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isPrivate: {
      type: Boolean,
      default: true
    }
  }],

  // Reporting & Moderation
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'harassment', 'inappropriate', 'other']
    },
    description: String,
    reportedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending'
    }
  }],

  // Event-based group reference (primary way to attach a message to an event group)
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    index: true,
    default: null
  },

  // Metadata
  metadata: {
    clientMessageId: String,
    deviceId: String,
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// ==================== INDEXES ====================
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ 'attachments.type': 1 });
messageSchema.index({ 'reactions.userId': 1 });
messageSchema.index({ 'starredBy.userId': 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ eventId: 1, createdAt: -1 });
messageSchema.index({ 'replyTo.messageId': 1 });

// ==================== VIRTUALS ====================
messageSchema.virtual('isAudio').get(function() {
  const hasTypeAudio = this.type === 'audio';
  const hasAttachmentAudio = Array.isArray(this.attachments) && this.attachments.some(a => a.type === 'audio');
  return hasTypeAudio || hasAttachmentAudio;
});

messageSchema.virtual('hasAttachments').get(function() {
  return Array.isArray(this.attachments) && this.attachments.length > 0;
});

messageSchema.virtual('reactionCount').get(function() {
  return Array.isArray(this.reactions) ? this.reactions.length : 0;
});

// ==================== METHODS ====================
messageSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

messageSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from same user
  this.reactions = (this.reactions || []).filter(r => !r.userId.equals(userId));
  this.reactions.push({ userId, emoji, reactedAt: new Date() });
  return this.save();
};

messageSchema.methods.removeReaction = function(userId) {
  this.reactions = (this.reactions || []).filter(r => !r.userId.equals(userId));
  return this.save();
};

messageSchema.methods.starMessage = function(userId) {
  const alreadyStarred = (this.starredBy || []).some(s => s.userId.equals(userId));
  if (!alreadyStarred) {
    this.starredBy = this.starredBy || [];
    this.starredBy.push({ userId, starredAt: new Date() });
  }
  return this.save();
};

messageSchema.methods.unstarMessage = function(userId) {
  this.starredBy = (this.starredBy || []).filter(s => !s.userId.equals(userId));
  return this.save();
};

messageSchema.methods.deleteForUser = function(userId) {
  this.deletedFor = this.deletedFor || [];
  const alreadyDeleted = this.deletedFor.some(d => d.userId.equals(userId));
  if (!alreadyDeleted) {
    this.deletedFor.push({ userId, deletedAt: new Date() });
  }
  return this.save();
};

messageSchema.methods.addInternalNote = function(adminId, note, isPrivate = true) {
  this.internalNotes = this.internalNotes || [];
  this.internalNotes.push({ adminId, note, isPrivate, createdAt: new Date() });
  return this.save();
};

// ==================== STATICS ====================
messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    recipient: userId,
    isRead: false
  });
};

messageSchema.statics.getConversation = function(user1Id, user2Id, limit = 50, before = null) {
  const query = {
    $or: [
      { sender: user1Id, recipient: user2Id },
      { sender: user2Id, recipient: user1Id }
    ],
    eventId: { $exists: false }
  };

  if (before) query.createdAt = { $lt: before };

  return this.find(query)
    .populate('sender', 'name email avatar')
    .populate('recipient', 'name email avatar')
    .populate('replyTo.messageId')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// ==================== PRE HOOKS ====================
messageSchema.pre('save', function(next) {
  // Auto-generate snippet for replies
  if (this.replyTo && this.replyTo.messageId && !this.replyTo.snippet) {
    this.replyTo.snippet = (this.body || '').substring(0, 100) + (this.body && this.body.length > 100 ? '...' : '');
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);

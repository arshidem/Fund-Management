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

  // Updated Message Types & Content
  type: {
    type: String,
    enum: [
      'text',
      'image',
      'audio',
      'document',
      'video',
      'system',
      'multiple',
      'voice', // New: Voice message type
      'call'   // New: Call log type
    ],
    default: 'text'
  },

  // Call-specific fields (for call logs)
  callInfo: {
    callType: {
      type: String,
      enum: ['audio', 'video'],
      default: 'audio'
    },
    callStatus: {
      type: String,
      enum: ['initiated', 'ongoing', 'completed', 'missed', 'rejected', 'cancelled', 'failed'],
      default: 'initiated'
    },
    callDuration: {
      type: Number, // in seconds
      default: 0
    },
    callStartedAt: Date,
    callEndedAt: Date,
    participants: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      joinedAt: Date,
      leftAt: Date,
      duration: Number
    }],
    callId: String // Unique identifier for the call session
  },

  // File Attachments (enhanced for voice messages)
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'audio', 'video', 'document', 'other', 'voice'], // Added 'voice'
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
    duration: Number, // For audio/video/voice messages
    mimeType: String,
    waveform: [Number], // For voice message visualization
    sampleRate: Number, // For voice messages
    bitrate: Number, // For voice messages
    channels: Number // For voice messages
  }],

  // Voice message specific fields
  voiceMessage: {
    duration: Number, // in seconds
    fileSize: Number, // in bytes
    mimeType: {
      type: String,
      default: 'audio/mpeg'
    },
    waveform: [Number], // Array of amplitude values for visualization
    isPlaying: {
      type: Boolean,
      default: false
    },
    playbackRate: {
      type: Number,
      default: 1.0
    }
  },

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
    userAgent: String,
    recordingDevice: String, // For voice messages
    recordingQuality: String // For voice messages
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
messageSchema.index({ type: 1 }); // New index for message type
messageSchema.index({ 'callInfo.callStatus': 1 }); // New index for call status
messageSchema.index({ 'callInfo.callId': 1 }); // New index for call sessions

// ==================== VIRTUALS ====================
messageSchema.virtual('isAudio').get(function() {
  const hasTypeAudio = this.type === 'audio';
  const hasAttachmentAudio = Array.isArray(this.attachments) && this.attachments.some(a => a.type === 'audio');
  return hasTypeAudio || hasAttachmentAudio;
});

messageSchema.virtual('isVoiceMessage').get(function() {
  return this.type === 'voice' || (Array.isArray(this.attachments) && this.attachments.some(a => a.type === 'voice'));
});

messageSchema.virtual('isCall').get(function() {
  return this.type === 'call';
});

messageSchema.virtual('hasAttachments').get(function() {
  return Array.isArray(this.attachments) && this.attachments.length > 0;
});

messageSchema.virtual('reactionCount').get(function() {
  return Array.isArray(this.reactions) ? this.reactions.length : 0;
});

messageSchema.virtual('callDurationFormatted').get(function() {
  if (!this.callInfo || !this.callInfo.callDuration) return '0:00';
  const minutes = Math.floor(this.callInfo.callDuration / 60);
  const seconds = this.callInfo.callDuration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

// New methods for voice messages
messageSchema.methods.markAsPlaying = function() {
  this.voiceMessage.isPlaying = true;
  return this.save();
};

messageSchema.methods.markAsStopped = function() {
  this.voiceMessage.isPlaying = false;
  return this.save();
};

// New methods for calls
messageSchema.methods.updateCallStatus = function(status, duration = null) {
  this.callInfo.callStatus = status;
  if (duration !== null) {
    this.callInfo.callDuration = duration;
  }
  if (status === 'completed' || status === 'missed' || status === 'rejected') {
    this.callInfo.callEndedAt = new Date();
  }
  return this.save();
};

messageSchema.methods.addCallParticipant = function(userId) {
  this.callInfo.participants = this.callInfo.participants || [];
  const existingParticipant = this.callInfo.participants.find(p => p.userId.equals(userId));
  if (!existingParticipant) {
    this.callInfo.participants.push({
      userId,
      joinedAt: new Date()
    });
  }
  return this.save();
};

messageSchema.methods.removeCallParticipant = function(userId) {
  if (this.callInfo.participants) {
    const participant = this.callInfo.participants.find(p => p.userId.equals(userId));
    if (participant && !participant.leftAt) {
      participant.leftAt = new Date();
      participant.duration = Math.floor((participant.leftAt - participant.joinedAt) / 1000);
    }
  }
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

// New static methods for calls
messageSchema.statics.createCallLog = function(callData) {
  const {
    sender,
    recipient,
    callType = 'audio',
    callStatus = 'initiated',
    callId
  } = callData;

  return this.create({
    sender,
    recipient,
    type: 'call',
    body: `${callType === 'audio' ? 'Audio' : 'Video'} call ${callStatus}`,
    callInfo: {
      callType,
      callStatus,
      callId,
      callStartedAt: new Date(),
      participants: []
    }
  });
};

messageSchema.statics.getCallHistory = function(userId, limit = 20) {
  return this.find({
    type: 'call',
    $or: [
      { sender: userId },
      { recipient: userId }
    ]
  })
  .populate('sender', 'name avatar')
  .populate('recipient', 'name avatar')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// New static methods for voice messages
messageSchema.statics.createVoiceMessage = function(messageData) {
  const {
    sender,
    recipient,
    audioUrl,
    duration,
    fileSize,
    waveform,
    filename,
    mimeType = 'audio/mpeg'
  } = messageData;

  return this.create({
    sender,
    recipient,
    type: 'voice',
    body: 'Voice message',
    voiceMessage: {
      duration,
      fileSize,
      mimeType,
      waveform: waveform || []
    },
    attachments: [{
      type: 'voice',
      url: audioUrl,
      filename: filename || `voice_message_${Date.now()}`,
      duration: duration,
      size: fileSize,
      mimeType: mimeType,
      waveform: waveform || []
    }]
  });
};

// ==================== PRE HOOKS ====================
messageSchema.pre('save', function(next) {
  // Auto-generate snippet for replies
  if (this.replyTo && this.replyTo.messageId && !this.replyTo.snippet) {
    this.replyTo.snippet = (this.body || '').substring(0, 100) + (this.body && this.body.length > 100 ? '...' : '');
  }

  // Auto-set body for call messages
  if (this.type === 'call' && !this.body) {
    const callType = this.callInfo?.callType === 'video' ? 'Video' : 'Audio';
    const status = this.callInfo?.callStatus || 'initiated';
    this.body = `${callType} call ${status}`;
  }

  // Auto-set body for voice messages
  if (this.type === 'voice' && !this.body) {
    this.body = 'Voice message';
  }

  next();
});

module.exports = mongoose.model('Message', messageSchema);
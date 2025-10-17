const mongoose = require('mongoose');

const audioMessageSchema = new mongoose.Schema({
  // Basic message info
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    index: true
  },

  // Audio file details
  audioFile: {
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    originalName: String,
    fileSize: {
      type: Number, // in bytes
      required: true
    },
    mimeType: {
      type: String,
      default: 'audio/mpeg'
    },
    duration: {
      type: Number, // in seconds
      required: true
    },
    bitrate: {
      type: Number, // in kbps
      default: 128
    },
    sampleRate: {
      type: Number, // in Hz
      default: 44100
    },
    channels: {
      type: Number,
      default: 1, // 1 for mono, 2 for stereo
      enum: [1, 2]
    },
    format: {
      type: String,
      enum: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'webm'],
      default: 'mp3'
    }
  },

  // Audio processing and analysis
  waveform: [{
    type: Number, // Array of amplitude values for visualization
    default: []
  }],
  waveformSamples: {
    type: Number,
    default: 100 // Number of waveform data points
  },
  audioQuality: {
    type: String,
    enum: ['low', 'medium', 'high', 'very_high'],
    default: 'medium'
  },
  noiseReduction: {
    type: Boolean,
    default: false
  },
  normalization: {
    type: Boolean,
    default: false
  },

  // Playback and interaction tracking
  playbackStats: {
    playCount: {
      type: Number,
      default: 0
    },
    lastPlayedAt: Date,
    totalPlayTime: {
      type: Number, // in seconds
      default: 0
    },
    completedListens: {
      type: Number,
      default: 0
    },
    playbackPositions: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      position: Number, // in seconds
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Transcription features
  transcription: {
    text: String,
    language: {
      type: String,
      default: 'en'
    },
    confidence: {
      type: Number, // 0-1, confidence score of transcription
      min: 0,
      max: 1
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'not_attempted'],
      default: 'not_attempted'
    },
    processedAt: Date,
    wordTimestamps: [{
      word: String,
      startTime: Number, // in seconds
      endTime: Number,   // in seconds
      confidence: Number
    }]
  },

  // Privacy and access control
  isEncrypted: {
    type: Boolean,
    default: false
  },
  encryptionKey: String, // For end-to-end encryption
  accessControl: {
    canDownload: {
      type: Boolean,
      default: true
    },
    canForward: {
      type: Boolean,
      default: true
    },
    expiresAt: Date, // Auto-delete after this time
    maxPlays: {
      type: Number,
      default: null // null means unlimited plays
    }
  },

  // Delivery status
  status: {
    type: String,
    enum: ['processing', 'ready', 'failed', 'deleted'],
    default: 'processing'
  },
  processingProgress: {
    type: Number, // 0-100 percentage
    min: 0,
    max: 100,
    default: 0
  },

  // Metadata
  metadata: {
    recordingDevice: String,
    operatingSystem: String,
    appVersion: String,
    recordingTimestamp: Date,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },
    backgroundNoiseLevel: {
      type: Number, // 0-1, estimated noise level
      min: 0,
      max: 1
    },
    voiceActivityDetection: {
      type: Boolean,
      default: false
    }
  },

  // Analytics and insights
  analytics: {
    listenCompletionRate: {
      type: Number, // percentage of users who listen to completion
      min: 0,
      max: 100,
      default: 0
    },
    averageListenTime: {
      type: Number, // in seconds
      default: 0
    },
    peakListenTime: {
      type: String, // time of day when most listens occur
      enum: ['morning', 'afternoon', 'evening', 'night'],
      default: 'evening'
    }
  },

  // Error handling
  errorLog: [{
    stage: String, // upload, processing, transcription, etc.
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],

  // Versioning
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    audioUrl: String,
    version: Number,
    createdAt: Date,
    changes: String
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================
audioMessageSchema.index({ sender: 1, createdAt: -1 });
audioMessageSchema.index({ recipient: 1, createdAt: -1 });
audioMessageSchema.index({ eventId: 1, createdAt: -1 });
audioMessageSchema.index({ 'audioFile.duration': 1 });
audioMessageSchema.index({ 'transcription.status': 1 });
audioMessageSchema.index({ status: 1 });
audioMessageSchema.index({ 'accessControl.expiresAt': 1 });
audioMessageSchema.index({ 'metadata.location': '2dsphere' });
audioMessageSchema.index({ 'playbackStats.lastPlayedAt': -1 });

// ==================== VIRTUALS ====================
audioMessageSchema.virtual('isExpired').get(function() {
  return this.accessControl.expiresAt && this.accessControl.expiresAt < new Date();
});

audioMessageSchema.virtual('playLimitReached').get(function() {
  return this.accessControl.maxPlays && 
         this.playbackStats.playCount >= this.accessControl.maxPlays;
});

audioMessageSchema.virtual('canBePlayed').get(function() {
  return this.status === 'ready' && 
         !this.isExpired && 
         !this.playLimitReached;
});

audioMessageSchema.virtual('fileSizeFormatted').get(function() {
  const bytes = this.audioFile.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

audioMessageSchema.virtual('durationFormatted').get(function() {
  const duration = this.audioFile.duration;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

audioMessageSchema.virtual('averageListenPercentage').get(function() {
  if (this.audioFile.duration === 0) return 0;
  return (this.playbackStats.totalPlayTime / (this.playbackStats.playCount * this.audioFile.duration)) * 100;
});

// ==================== METHODS ====================
audioMessageSchema.methods.incrementPlayCount = function(userId = null, playTime = 0) {
  this.playbackStats.playCount += 1;
  this.playbackStats.lastPlayedAt = new Date();
  this.playbackStats.totalPlayTime += playTime;
  
  if (playTime >= this.audioFile.duration * 0.9) { // 90% considered completed
    this.playbackStats.completedListens += 1;
  }

  if (userId) {
    // Update or add playback position
    const existingPosition = this.playbackStats.playbackPositions.find(
      pos => pos.userId.toString() === userId.toString()
    );
    
    if (existingPosition) {
      existingPosition.position = playTime;
      existingPosition.timestamp = new Date();
    } else {
      this.playbackStats.playbackPositions.push({
        userId,
        position: playTime,
        timestamp: new Date()
      });
    }
  }

  return this.save();
};

audioMessageSchema.methods.updateTranscription = function(transcriptionData) {
  this.transcription = {
    ...this.transcription,
    ...transcriptionData,
    status: 'completed',
    processedAt: new Date()
  };
  return this.save();
};

audioMessageSchema.methods.markAsProcessing = function(progress = 0) {
  this.status = 'processing';
  this.processingProgress = progress;
  return this.save();
};

audioMessageSchema.methods.markAsReady = function() {
  this.status = 'ready';
  this.processingProgress = 100;
  return this.save();
};

audioMessageSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.errorLog.push({
    stage: 'processing',
    error: error.message || error,
    timestamp: new Date()
  });
  return this.save();
};

audioMessageSchema.methods.addWaveformData = function(waveformArray) {
  this.waveform = waveformArray;
  this.waveformSamples = waveformArray.length;
  return this.save();
};

audioMessageSchema.methods.canUserAccess = function(userId) {
  // Check if user is sender, recipient, or event participant
  if (this.sender.toString() === userId.toString()) return true;
  if (this.recipient && this.recipient.toString() === userId.toString()) return true;
  
  // For event messages, we'd need to check event participation
  // This would require additional population/query
  return false;
};

audioMessageSchema.methods.getPlaybackStatsForUser = function(userId) {
  return this.playbackStats.playbackPositions.find(
    pos => pos.userId.toString() === userId.toString()
  );
};

// ==================== STATICS ====================
audioMessageSchema.statics.findByMessageId = function(messageId) {
  return this.findOne({ messageId })
    .populate('sender', 'name avatar')
    .populate('recipient', 'name avatar')
    .populate('eventId', 'name');
};

audioMessageSchema.statics.findByUser = function(userId, options = {}) {
  const { limit = 50, page = 1, type = 'all' } = options;
  const skip = (page - 1) * limit;

  let query = {
    $or: [
      { sender: userId },
      { recipient: userId }
    ]
  };

  if (type === 'sent') {
    query = { sender: userId };
  } else if (type === 'received') {
    query = { recipient: userId };
  }

  return this.find(query)
    .populate('sender', 'name avatar')
    .populate('recipient', 'name avatar')
    .populate('eventId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

audioMessageSchema.statics.findByEvent = function(eventId, options = {}) {
  const { limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;

  return this.find({ eventId })
    .populate('sender', 'name avatar')
    .populate('eventId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

audioMessageSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(userId) },
          { recipient: new mongoose.Types.ObjectId(userId) }
        ]
      }
    },
    {
      $facet: {
        totalMessages: [{ $count: 'count' }],
        totalDuration: [{ $group: { _id: null, total: { $sum: '$audioFile.duration' } } }],
        averageDuration: [{ $group: { _id: null, avg: { $avg: '$audioFile.duration' } } }],
        byFormat: [{ $group: { _id: '$audioFile.format', count: { $sum: 1 } } }],
        recentActivity: [
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          { $project: { duration: '$audioFile.duration', createdAt: 1, format: '$audioFile.format' } }
        ]
      }
    }
  ]);
};

audioMessageSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    'accessControl.expiresAt': { $lt: new Date() }
  });
};

// ==================== PRE HOOKS ====================
audioMessageSchema.pre('save', function(next) {
  // Auto-calculate audio quality based on bitrate and sample rate
  if (this.audioFile.bitrate && this.audioFile.sampleRate) {
    const qualityScore = (this.audioFile.bitrate / 128) * (this.audioFile.sampleRate / 44100);
    if (qualityScore < 0.5) this.audioQuality = 'low';
    else if (qualityScore < 1) this.audioQuality = 'medium';
    else if (qualityScore < 1.5) this.audioQuality = 'high';
    else this.audioQuality = 'very_high';
  }

  // Update analytics
  if (this.playbackStats.playCount > 0) {
    this.analytics.averageListenTime = this.playbackStats.totalPlayTime / this.playbackStats.playCount;
    this.analytics.listenCompletionRate = (this.playbackStats.completedListens / this.playbackStats.playCount) * 100;
  }

  next();
});

audioMessageSchema.post('save', function(doc) {
  // Emit real-time events for processing progress, etc.
  // This would integrate with your socket.io setup
  if (doc.processingProgress > 0 && doc.processingProgress < 100) {
    // Emit processing progress event
    const io = require('../socket'); // Adjust path to your socket setup
    io.to(`user-${doc.sender}`).emit('audioProcessingProgress', {
      messageId: doc.messageId,
      progress: doc.processingProgress
    });
  }
});

module.exports = mongoose.model('AudioMessage', audioMessageSchema);
const mongoose = require("mongoose");

const contributionSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value) {
        return value > 0;
      },
      message: 'Amount must be greater than 0'
    }
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    enum: ['INR', 'USD', 'EUR', 'GBP'], // Add more as needed
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'online', 'bank_transfer', 'upi', 'card'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true,
    required: function() {
      return this.paymentMethod !== 'cash';
    },
    index: true
  },
  gatewayTransactionId: {
    type: String,
    sparse: true
  },
  paymentDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentGateway: {
    type: String,
    enum: ['razorpay', 'stripe', 'paypal', 'manual', null],
    default: null
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  receiptUrl: {
    type: String
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(value) {
        return value <= this.amount;
      },
      message: 'Refund amount cannot exceed original amount'
    }
  },
  refundDate: {
    type: Date
  },
  refundReason: {
    type: String,
    maxlength: 500
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================
contributionSchema.index({ event: 1, user: 1 });
contributionSchema.index({ event: 1, participant: 1 });
contributionSchema.index({ user: 1, paymentDate: -1 });
contributionSchema.index({ status: 1, paymentDate: -1 });
contributionSchema.index({ paymentMethod: 1 });
contributionSchema.index({ createdAt: -1 });

// Compound index for frequent queries
contributionSchema.index({ event: 1, status: 1 });
contributionSchema.index({ user: 1, status: 1 });

// ==================== VIRTUAL FIELDS ====================
contributionSchema.virtual('isSuccessful').get(function() {
  return this.status === 'completed';
});

contributionSchema.virtual('isRefunded').get(function() {
  return this.status === 'refunded';
});

contributionSchema.virtual('netAmount').get(function() {
  return this.amount - this.refundAmount;
});

contributionSchema.virtual('paymentDetails').get(function() {
  return {
    method: this.paymentMethod,
    gateway: this.paymentGateway,
    transactionId: this.transactionId,
    date: this.paymentDate
  };
});

// ==================== METHODS ====================
contributionSchema.methods.markAsCompleted = function(verifiedBy = null) {
  this.status = 'completed';
  if (verifiedBy) {
    this.verifiedBy = verifiedBy;
    this.verifiedAt = new Date();
  }
  return this.save();
};

contributionSchema.methods.processRefund = function(refundAmount, reason, processedBy) {
  this.status = 'refunded';
  this.refundAmount = refundAmount;
  this.refundReason = reason;
  this.refundDate = new Date();
  this.verifiedBy = processedBy;
  this.verifiedAt = new Date();
  return this.save();
};

contributionSchema.methods.toPaymentJSON = function() {
  const obj = this.toObject();
  obj.isSuccessful = this.isSuccessful;
  obj.isRefunded = this.isRefunded;
  obj.netAmount = this.netAmount;
  return obj;
};

// ==================== STATIC METHODS ====================
contributionSchema.statics.getUserTotalContributions = function(userId, eventId) {
  return this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        event: mongoose.Types.ObjectId(eventId),
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalRefunds: { $sum: '$refundAmount' },
        netAmount: { $sum: { $subtract: ['$amount', '$refundAmount'] } },
        paymentCount: { $sum: 1 }
      }
    }
  ]);
};

contributionSchema.statics.getEventContributionsSummary = function(eventId) {
  return this.aggregate([
    {
      $match: {
        event: mongoose.Types.ObjectId(eventId),
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        totalAmount: { $sum: '$amount' },
        totalRefunds: { $sum: '$refundAmount' },
        netAmount: { $sum: { $subtract: ['$amount', '$refundAmount'] } },
        contributionCount: { $sum: 1 }
      }
    },
    {
      $project: {
        paymentMethod: '$_id',
        totalAmount: 1,
        totalRefunds: 1,
        netAmount: 1,
        contributionCount: 1,
        _id: 0
      }
    }
  ]);
};

contributionSchema.statics.findSuccessfulPayments = function(eventId) {
  return this.find({
    event: eventId,
    status: 'completed'
  }).populate('user', 'name email phone')
    .populate('participant')
    .sort({ paymentDate: -1 });
};

// ==================== MIDDLEWARE ====================
contributionSchema.pre('save', function(next) {
  // Auto-set createdBy if not provided (for system-generated payments)
  if (!this.createdBy && this.user) {
    this.createdBy = this.user;
  }
  
  // Validate refund amount
  if (this.refundAmount > this.amount) {
    return next(new Error('Refund amount cannot exceed original amount'));
  }
  
  // Auto-set refund date when refund is processed
  if (this.status === 'refunded' && !this.refundDate) {
    this.refundDate = new Date();
  }
  
  next();
});

contributionSchema.post('save', async function(doc) {
  // Update participant's total contribution when payment is completed
  if (doc.status === 'completed' || doc.status === 'refunded') {
    try {
      const Participant = mongoose.model('Participant');
      const totalContributions = await this.constructor.getUserTotalContributions(doc.user, doc.event);
      
      if (totalContributions.length > 0) {
        await Participant.findOneAndUpdate(
          { event: doc.event, user: doc.user },
          { 
            totalContributed: totalContributions[0].netAmount,
            lastPaymentDate: doc.paymentDate
          }
        );
      }
    } catch (error) {
      console.error('Error updating participant contribution:', error);
    }
  }
});

// ==================== QUERY HELPERS ====================
contributionSchema.query.byUser = function(userId) {
  return this.where({ user: userId });
};

contributionSchema.query.byEvent = function(eventId) {
  return this.where({ event: eventId });
};

contributionSchema.query.successful = function() {
  return this.where({ status: 'completed' });
};

contributionSchema.query.pending = function() {
  return this.where({ status: 'pending' });
};

const Contribution = mongoose.model('Contribution', contributionSchema);

module.exports = Contribution;
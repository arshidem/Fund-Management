const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // === PAYMENT INFORMATION ===
  // Remove totalContributed - now calculated virtually from contributions
  lastPaymentDate: {
    type: Date
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overpaid', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // === PARTICIPATION INFORMATION ===
  joinedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'removed', 'waitlisted', 'invited'],
    default: 'active',
    index: true
  },
  waitlistPosition: {
    type: Number,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Waitlist position must be an integer'
    }
  },
  
  // === ADDITIONAL FIELDS ===
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  invitedAt: {
    type: Date
  },
  respondedAt: {
    type: Date
  },
  response: {
    type: String,
    enum: ['accepted', 'declined', 'pending'],
    default: 'pending'
  },
  
  // === ADMIN FIELDS ===
  notes: {
    type: String,
    maxlength: 500
  },
  adminNotes: {
    type: String,
    maxlength: 1000
  },
  isConfirmed: {
    type: Boolean,
    default: false
  },
  confirmedAt: {
    type: Date
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // === TIMESTAMPS ===
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================
participantSchema.index({ event: 1, user: 1 }, { unique: true });
participantSchema.index({ user: 1, joinedAt: -1 });
participantSchema.index({ event: 1, status: 1 });
participantSchema.index({ event: 1, paymentStatus: 1 });
participantSchema.index({ status: 1, joinedAt: -1 });
participantSchema.index({ waitlistPosition: 1 });

// Compound indexes for common queries
participantSchema.index({ event: 1, user: 1, status: 1 });
participantSchema.index({ user: 1, status: 1 });

// ==================== VIRTUAL FIELDS ====================
// Calculate totalContributed from contributions (real-time)
participantSchema.virtual('totalContributed').get(async function() {
  try {
    const Contribution = mongoose.model('Contribution');
    
    const result = await Contribution.aggregate([
      {
        $match: {
          participant: this._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalRefunds: { $sum: '$refundAmount' }
        }
      }
    ]);
    
    if (result.length > 0) {
      return result[0].totalAmount - result[0].totalRefunds;
    }
    return 0;
  } catch (error) {
    console.error('Error calculating total contributed:', error);
    return 0;
  }
});

// Virtual for contributions relationship
participantSchema.virtual('contributions', {
  ref: 'Contribution',
  localField: '_id',
  foreignField: 'participant'
});

participantSchema.virtual('successfulContributions', {
  ref: 'Contribution',
  localField: '_id',
  foreignField: 'participant',
  match: { status: 'completed' }
});

// All these virtuals depend on contributions and event data
participantSchema.virtual('remainingAmount').get(async function() {
  if (!this.populated('event') || !this.event || !this.event.minimumContribution) return 0;
  
  const totalContributed = await this.totalContributed;
  return Math.max(0, this.event.minimumContribution - totalContributed);
});

participantSchema.virtual('isFullyPaid').get(async function() {
  if (!this.populated('event') || !this.event || !this.event.minimumContribution) return false;
  
  const totalContributed = await this.totalContributed;
  return totalContributed >= this.event.minimumContribution;
});

participantSchema.virtual('isOverpaid').get(async function() {
  if (!this.populated('event') || !this.event || !this.event.minimumContribution) return false;
  
  const totalContributed = await this.totalContributed;
  return totalContributed > this.event.minimumContribution;
});

participantSchema.virtual('paymentPercentage').get(async function() {
  if (!this.populated('event') || !this.event || this.event.minimumContribution === 0) return 0;
  
  const totalContributed = await this.totalContributed;
  return (totalContributed / this.event.minimumContribution) * 100;
});

participantSchema.virtual('daysSinceJoined').get(function() {
  return Math.floor((new Date() - this.joinedAt) / (1000 * 60 * 60 * 24));
});

participantSchema.virtual('isActiveParticipant').get(function() {
  return this.status === 'active' && this.response === 'accepted';
});

participantSchema.virtual('isOnWaitlist').get(function() {
  return this.status === 'waitlisted';
});

// ==================== METHODS ====================
participantSchema.methods.updatePaymentStatus = async function() {
  try {
    // Ensure event is populated for minimum contribution
    if (!this.event || typeof this.event === 'string' || !this.event.minimumContribution) {
      await this.populate('event');
    }

    // If no event data, use safe defaults
    if (!this.event || !this.event.minimumContribution) {
      console.warn('Event not populated properly for payment status update');
      
      const totalContributed = await this.totalContributed;
      this.paymentStatus = totalContributed > 0 ? 'partial' : 'pending';
      return;
    }

    const minContribution = this.event.minimumContribution;
    const totalContributed = await this.totalContributed;
    
    // Update payment status based on actual contributions
    if (totalContributed >= minContribution) {
      this.paymentStatus = totalContributed > minContribution ? 'overpaid' : 'paid';
    } else if (totalContributed > 0) {
      this.paymentStatus = 'partial';
    } else {
      this.paymentStatus = 'pending';
    }
    
    // Update lastPaymentDate from latest contribution
    if (totalContributed > 0) {
      const Contribution = mongoose.model('Contribution');
      const latestContribution = await Contribution.findOne({
        participant: this._id,
        status: 'completed'
      }).sort({ paymentDate: -1 });
      
      if (latestContribution) {
        this.lastPaymentDate = latestContribution.paymentDate;
      }
    }
    
  } catch (error) {
    console.error('Error in updatePaymentStatus:', error);
    const totalContributed = await this.totalContributed;
    this.paymentStatus = totalContributed > 0 ? 'partial' : 'pending';
  }
};

participantSchema.methods.addContribution = async function(amount, paymentData = {}) {
  const Contribution = mongoose.model('Contribution');
  
  // Create contribution record
  const contribution = new Contribution({
    event: this.event,
    participant: this._id,
    user: this.user,
    amount: amount,
    paymentMethod: paymentData.paymentMethod || 'manual',
    paymentDate: paymentData.paymentDate || new Date(),
    status: 'completed',
    currency: paymentData.currency || 'INR',
    transactionId: paymentData.transactionId,
    gatewayTransactionId: paymentData.gatewayTransactionId,
    paymentGateway: paymentData.paymentGateway,
    notes: paymentData.notes,
    createdBy: paymentData.createdBy || this.user
  });
  
  await contribution.save();
  
  // Update payment status (this will recalculate from contributions)
  await this.updatePaymentStatus();
  await this.save();
  
  return contribution;
};

participantSchema.methods.getContributionHistory = async function() {
  const Contribution = mongoose.model('Contribution');
  
  return await Contribution.find({
    participant: this._id
  })
  .sort({ paymentDate: -1 })
  .populate('verifiedBy', 'name email');
};

participantSchema.methods.moveToWaitlist = function(position) {
  this.status = 'waitlisted';
  this.waitlistPosition = position;
  this.response = 'pending';
  return this.save();
};

participantSchema.methods.promoteFromWaitlist = function() {
  this.status = 'active';
  this.waitlistPosition = undefined;
  this.response = 'accepted';
  return this.save();
};

participantSchema.methods.cancelParticipation = function(reason = '') {
  this.status = 'cancelled';
  this.response = 'declined';
  this.notes = reason ? `Cancelled: ${reason}` : this.notes;
  return this.save();
};

participantSchema.methods.confirmParticipation = function(confirmedBy) {
  this.isConfirmed = true;
  this.confirmedAt = new Date();
  this.confirmedBy = confirmedBy;
  return this.save();
};

participantSchema.methods.toParticipantJSON = async function() {
  const obj = this.toObject();
  
  // Get all async virtual values
  const totalContributed = await this.totalContributed;
  const remainingAmount = await this.remainingAmount;
  const isFullyPaid = await this.isFullyPaid;
  const isOverpaid = await this.isOverpaid;
  const paymentPercentage = await this.paymentPercentage;
  
  // Add calculated values
  obj.totalContributed = totalContributed;
  obj.remainingAmount = remainingAmount;
  obj.isFullyPaid = isFullyPaid;
  obj.isOverpaid = isOverpaid;
  obj.paymentPercentage = paymentPercentage;
  obj.daysSinceJoined = this.daysSinceJoined;
  obj.isActiveParticipant = this.isActiveParticipant;
  obj.isOnWaitlist = this.isOnWaitlist;
  
  return obj;
};

// ==================== STATIC METHODS ====================
participantSchema.statics.getEventParticipants = function(eventId, options = {}) {
  const { status, paymentStatus, populateUser = true } = options;
  
  let query = this.find({ event: eventId });
  
  if (status) query = query.where('status').equals(status);
  if (paymentStatus) query = query.where('paymentStatus').equals(paymentStatus);
  
  if (populateUser) {
    query = query.populate('user', 'name email phone avatar');
  }
  
  return query.sort({ joinedAt: 1 });
};

participantSchema.statics.getUserParticipations = function(userId, options = {}) {
  const { status, populateEvent = true } = options;
  
  let query = this.find({ user: userId });
  
  if (status) query = query.where('status').equals(status);
  
  if (populateEvent) {
    query = query.populate('event', 'title date time location status');
  }
  
  return query.sort({ joinedAt: -1 });
};

participantSchema.statics.getPaymentSummary = async function(eventId) {
  const Contribution = mongoose.model('Contribution');
  
  const paymentSummary = await Contribution.aggregate([
    {
      $match: {
        event: mongoose.Types.ObjectId(eventId),
        status: 'completed'
      }
    },
    {
      $lookup: {
        from: 'participants',
        localField: 'participant',
        foreignField: '_id',
        as: 'participantInfo'
      }
    },
    {
      $unwind: '$participantInfo'
    },
    {
      $match: {
        'participantInfo.status': 'active'
      }
    },
    {
      $group: {
        _id: '$participantInfo.paymentStatus',
        participantCount: { $addToSet: '$participant' },
        totalAmount: { $sum: '$amount' },
        totalRefunds: { $sum: '$refundAmount' },
        netAmount: { $sum: { $subtract: ['$amount', '$refundAmount'] } }
      }
    },
    {
      $project: {
        paymentStatus: '$_id',
        participantCount: { $size: '$participantCount' },
        totalAmount: 1,
        totalRefunds: 1,
        netAmount: 1,
        _id: 0
      }
    }
  ]);
  
  return paymentSummary;
};

participantSchema.statics.findOverduePayments = function(eventId) {
  return this.find({
    event: eventId,
    status: 'active',
    paymentStatus: { $in: ['pending', 'partial'] }
  }).populate('user', 'name email phone')
    .populate('event')
    .sort({ joinedAt: 1 });
};

// ==================== MIDDLEWARE ====================
participantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Validate waitlist position
  if (this.status !== 'waitlisted' && this.waitlistPosition) {
    this.waitlistPosition = undefined;
  }
  
  next();
});

// Add middleware to handle cascade deletes
participantSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const Contribution = mongoose.model('Contribution');
    
    // Delete all contributions associated with this participant
    await Contribution.deleteMany({ participant: this._id });
    
    next();
  } catch (error) {
    next(error);
  }
});

participantSchema.pre('deleteMany', async function(next) {
  try {
    const Contribution = mongoose.model('Contribution');
    const participants = await this.model.find(this.getFilter());
    const participantIds = participants.map(p => p._id);
    
    // Delete all contributions associated with these participants
    await Contribution.deleteMany({ participant: { $in: participantIds } });
    
    next();
  } catch (error) {
    next(error);
  }
});

// ==================== QUERY HELPERS ====================
participantSchema.query.byEvent = function(eventId) {
  return this.where({ event: eventId });
};

participantSchema.query.byUser = function(userId) {
  return this.where({ user: userId });
};

participantSchema.query.active = function() {
  return this.where({ status: 'active' });
};

participantSchema.query.waitlisted = function() {
  return this.where({ status: 'waitlisted' });
};

participantSchema.query.fullyPaid = function() {
  return this.where({ paymentStatus: 'paid' }).or([{ paymentStatus: 'overpaid' }]);
};

participantSchema.query.pendingPayment = function() {
  return this.where({ paymentStatus: { $in: ['pending', 'partial'] } });
};

const Participant = mongoose.model('Participant', participantSchema);

module.exports = Participant;
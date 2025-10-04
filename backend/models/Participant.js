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
  totalContributed: {
    type: Number,
    default: 0,
    min: 0
  },
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
participantSchema.virtual('remainingAmount').get(function() {
  if (!this.populated('event')) return 0;
  return Math.max(0, this.event.minimumContribution - this.totalContributed);
});

participantSchema.virtual('isFullyPaid').get(function() {
  if (!this.populated('event')) return false;
  return this.totalContributed >= this.event.minimumContribution;
});

participantSchema.virtual('isOverpaid').get(function() {
  if (!this.populated('event')) return false;
  return this.totalContributed > this.event.minimumContribution;
});

participantSchema.virtual('paymentPercentage').get(function() {
  if (!this.populated('event') || this.event.minimumContribution === 0) return 0;
  return (this.totalContributed / this.event.minimumContribution) * 100;
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
participantSchema.methods.updatePaymentStatus = function() {
  if (!this.populated('event')) {
    throw new Error('Event must be populated to update payment status');
  }

  const minContribution = this.event.minimumContribution;
  
  if (this.totalContributed >= minContribution) {
    this.paymentStatus = this.totalContributed > minContribution ? 'overpaid' : 'paid';
  } else if (this.totalContributed > 0) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'pending';
  }
  
  return this.save();
};

participantSchema.methods.addContribution = async function(amount) {
  const Contribution = mongoose.model('Contribution');
  
  // Create contribution record
  const contribution = new Contribution({
    event: this.event,
    participant: this._id,
    user: this.user,
    amount: amount,
    paymentMethod: 'manual', // This should come from the actual payment method
    status: 'completed',
    createdBy: this.user // This should be the admin/user processing the payment
  });
  
  await contribution.save();
  
  // Update participant totals
  this.totalContributed += amount;
  this.lastPaymentDate = new Date();
  await this.updatePaymentStatus();
  
  return contribution;
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

participantSchema.methods.toParticipantJSON = function() {
  const obj = this.toObject();
  obj.remainingAmount = this.remainingAmount;
  obj.isFullyPaid = this.isFullyPaid;
  obj.isOverpaid = this.isOverpaid;
  obj.paymentPercentage = this.paymentPercentage;
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

participantSchema.statics.getPaymentSummary = function(eventId) {
  return this.aggregate([
    {
      $match: {
        event: mongoose.Types.ObjectId(eventId),
        status: 'active'
      }
    },
    {
      $group: {
        _id: '$paymentStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalContributed' },
        averageAmount: { $avg: '$totalContributed' }
      }
    },
    {
      $project: {
        paymentStatus: '$_id',
        count: 1,
        totalAmount: 1,
        averageAmount: 1,
        _id: 0
      }
    }
  ]);
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
  
  // Auto-update lastPaymentDate when contribution changes
  if (this.isModified('totalContributed') && this.totalContributed > 0 && !this.lastPaymentDate) {
    this.lastPaymentDate = new Date();
  }
  
  // Validate waitlist position
  if (this.status !== 'waitlisted' && this.waitlistPosition) {
    this.waitlistPosition = undefined;
  }
  
  next();
});

participantSchema.post('save', async function(doc) {
  // Update event financials when participant payment status changes
  if (doc.isModified('totalContributed') || doc.isModified('status')) {
    try {
      const Event = mongoose.model('Event');
      await Event.findByIdAndUpdate(doc.event, { $inc: { __v: 1 } }); // Trigger update
    } catch (error) {
      console.error('Error updating event after participant save:', error);
    }
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
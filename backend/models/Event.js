const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  // === BASIC EVENT INFORMATION ===
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    maxlength: 2000
  },
  
  // === DATE & TIME ===
  date: { 
    type: Date, 
    required: true,
    index: true
  },
  time: { 
    type: String, 
    required: true 
  },
  endDate: { 
    type: Date,
    index: true
  },
  endTime: {
    type: String
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  
  // === FINANCIALS ===
  minimumContribution: { 
    type: Number, 
    required: true,
    min: 0
  },
  maximumContribution: { 
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        return !value || value >= this.minimumContribution;
      },
      message: 'Maximum contribution must be greater than or equal to minimum contribution'
    }
  },
  totalCollected: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalExpenses: { 
    type: Number, 
    default: 0,
    min: 0
  },
  estimatedBudget: { 
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  
  // === PARTICIPATION SETTINGS ===
  participationType: {
    type: String,
    enum: ['fixed', 'unlimited'],
    default: 'fixed',
    required: true
  },
  maxParticipants: { 
    type: Number, 
    required: function() { 
      return this.participationType === 'fixed'; 
    },
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Max participants must be an integer'
    }
  },
  
  // === EVENT STATUS & TRACKING ===
  status: { 
    type: String, 
    enum: ['draft', 'published', 'cancelled', 'completed', 'ongoing'],
    default: 'draft',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  publishedAt: {
    type: Date
  },
  
  // === EVENT CREATOR ===
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // === EVENT SETTINGS ===
  category: {
    type: String,
    enum: [
      'trip', 'celebration', 'festival', 'sports', 
      'cultural', 'meeting', 'charity', 'educational', 
      'business', 'social', 'religious', 'other'
    ],
    default: 'other',
    index: true
  },
  
  location: {
    venue: {
      type: String,
      trim: true,
      maxlength: 200
    },
    address: {
      type: String,
      trim: true,
      maxlength: 500
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      trim: true
    },
    onlineLink: {
      type: String,
      trim: true
    },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  eventType: {
    type: String,
    enum: ['in-person', 'virtual', 'hybrid'],
    default: 'in-person'
  },
  
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  
  // === PAYMENT SETTINGS ===
  paymentDeadline: {
    type: Date
  },
  allowLatePayments: {
    type: Boolean,
    default: false
  },
  allowPartialPayments: {
    type: Boolean,
    default: false
  },
  
  // === ADDITIONAL FIELDS ===
  tags: [{
    type: String,
    trim: true
  }],
  coverImage: {
    type: String // URL to image
  },
  gallery: [{
    type: String // Array of image URLs
  }],
  
  // === ANALYTICS ===
  views: {
    type: Number,
    default: 0
  },
  totalInterested: {
    type: Number,
    default: 0
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

// ==================== VIRTUAL FIELDS ====================
eventSchema.virtual('participantCount', {
  ref: 'Participant',
  localField: '_id',
  foreignField: 'event',
  count: true
});

eventSchema.virtual('expenseCount', {
  ref: 'Expense',
  localField: '_id',
  foreignField: 'event',
  count: true
});

eventSchema.virtual('contributionCount', {
  ref: 'Contribution',
  localField: '_id',
  foreignField: 'event',
  count: true
});

eventSchema.virtual('isFull').get(function() {
  if (this.participationType === 'unlimited') return false;
  return this.participantCount >= this.maxParticipants;
});

eventSchema.virtual('availableSpots').get(function() {
  if (this.participationType === 'unlimited') return 'Unlimited';
  return Math.max(0, this.maxParticipants - (this.participantCount || 0));
});

eventSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const eventDate = new Date(this.date);
  return Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
});

eventSchema.virtual('balance').get(function() {
  return this.totalCollected - this.totalExpenses;
});

eventSchema.virtual('budgetUtilization').get(function() {
  if (!this.estimatedBudget || this.estimatedBudget === 0) return 0;
  return (this.totalExpenses / this.estimatedBudget) * 100;
});

eventSchema.virtual('isUpcoming').get(function() {
  return new Date(this.date) > new Date();
});

eventSchema.virtual('isPast').get(function() {
  return new Date(this.date) < new Date();
});

eventSchema.virtual('paymentProgress').get(function() {
  if (!this.minimumContribution || this.minimumContribution === 0) return 0;
  const expectedTotal = (this.participantCount || 0) * this.minimumContribution;
  if (expectedTotal === 0) return 0;
  return (this.totalCollected / expectedTotal) * 100;
});

// ==================== METHODS ====================
eventSchema.methods.publish = function() {
  this.status = 'published';
  this.publishedAt = new Date();
  return this.save();
};

eventSchema.methods.cancel = function(reason = '') {
  this.status = 'cancelled';
  this.isActive = false;
  return this.save();
};

eventSchema.methods.complete = function() {
  this.status = 'completed';
  return this.save();
};

eventSchema.methods.updateFinancials = async function() {
  const Contribution = mongoose.model('Contribution');
  const Expense = mongoose.model('Expense');
  
  // Calculate total collected from successful contributions
  const contributionsSummary = await Contribution.aggregate([
    {
      $match: {
        event: this._id,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalCollected: { $sum: '$amount' },
        totalRefunds: { $sum: '$refundAmount' }
      }
    }
  ]);
  
  // Calculate total expenses
  const expensesSummary = await Expense.aggregate([
    {
      $match: {
        event: this._id,
        status: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: '$amount' }
      }
    }
  ]);
  
  this.totalCollected = contributionsSummary[0] ? 
    (contributionsSummary[0].totalCollected - contributionsSummary[0].totalRefunds) : 0;
  this.totalExpenses = expensesSummary[0] ? expensesSummary[0].totalExpenses : 0;
  
  return this.save();
};

eventSchema.methods.toEventJSON = function() {
  const obj = this.toObject();
  obj.isFull = this.isFull;
  obj.availableSpots = this.availableSpots;
  obj.daysRemaining = this.daysRemaining;
  obj.balance = this.balance;
  obj.budgetUtilization = this.budgetUtilization;
  obj.isUpcoming = this.isUpcoming;
  obj.isPast = this.isPast;
  obj.paymentProgress = this.paymentProgress;
  return obj;
};

// ==================== STATIC METHODS ====================
eventSchema.statics.getActiveEvents = function() {
  return this.find({
    isActive: true,
    status: { $in: ['published', 'ongoing'] }
  }).populate('createdBy', 'name email')
    .sort({ date: 1 });
};

eventSchema.statics.getUpcomingEvents = function(limit = 10) {
  return this.find({
    isActive: true,
    status: 'published',
    date: { $gte: new Date() }
  }).populate('createdBy', 'name email')
    .sort({ date: 1 })
    .limit(limit);
};

eventSchema.statics.getEventsByUser = function(userId) {
  return this.find({ createdBy: userId })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

// ==================== MIDDLEWARE ====================
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-update status based on date
  const now = new Date();
  const eventDate = new Date(this.date);
  
  if (this.status === 'published') {
    if (eventDate <= now && this.status !== 'completed') {
      this.status = 'ongoing';
    }
  }
  
  // Validate endDate
  if (this.endDate && this.endDate < eventDate) {
    return next(new Error('End date cannot be before start date'));
  }
  
  // Validate payment deadline
  if (this.paymentDeadline && this.paymentDeadline > eventDate) {
    return next(new Error('Payment deadline cannot be after event date'));
  }
  
  next();
});

eventSchema.post('save', async function(doc) {
  // Update financials when event is modified
  if (doc.isModified('status') || doc.isModified('isActive')) {
    // You can add additional logic here if needed
  }
});

// ==================== INDEXES ====================
eventSchema.index({ createdBy: 1, createdAt: -1 });
eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ category: 1, status: 1 });
eventSchema.index({ status: 1, isActive: 1 });
eventSchema.index({ 'location.city': 1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ createdAt: -1 });

// Text search index
eventSchema.index({
  title: 'text',
  description: 'text',
  'location.venue': 'text',
  'location.address': 'text'
});

// ==================== QUERY HELPERS ====================
eventSchema.query.active = function() {
  return this.where({ isActive: true });
};

eventSchema.query.published = function() {
  return this.where({ status: 'published' });
};

eventSchema.query.upcoming = function() {
  return this.where({ date: { $gte: new Date() } });
};

eventSchema.query.byCategory = function(category) {
  return this.where({ category });
};

eventSchema.query.byUser = function(userId) {
  return this.where({ createdBy: userId });
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
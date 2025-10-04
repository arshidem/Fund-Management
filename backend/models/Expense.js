const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  
  // === EXPENSE DETAILS ===
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
    validate: {
      validator: function(value) {
        return value > 0;
      },
      message: 'Amount must be greater than 0'
    }
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    index: true
  },
  subCategory: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  // === DATE & TIME ===
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  time: {
    type: String // Optional time of expense
  },
  
  // === PAYMENT INFORMATION ===
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'online', 'bank_transfer', 'upi', 'card', 'other'],
    default: 'cash'
  },
  transactionId: {
    type: String,
    sparse: true
  },
  
  // === RECEIPT & DOCUMENTATION ===
  receipt: {
    url: String,
    fileName: String,
    fileSize: Number,
    uploadedAt: Date
  },
  supportingDocuments: [{
    url: String,
    fileName: String,
    description: String,
    uploadedAt: Date
  }],
  
  // === EXPENSE STATUS & APPROVAL ===
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  
  // === APPROVAL WORKFLOW ===
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedAt: Date,
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  
  // === ADDITIONAL DETAILS ===
  vendor: {
    name: String,
    contact: String,
    gstin: String // For Indian businesses
  },
  location: {
    place: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // === TAGS & ORGANIZATION ===
  tags: [{
    type: String,
    trim: true
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // === NOTES & COMMENTS ===
  notes: {
    type: String,
    maxlength: 1000
  },
  internalNotes: {
    type: String,
    maxlength: 1000 // For admin/internal use only
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
expenseSchema.index({ event: 1, date: -1 });
expenseSchema.index({ event: 1, category: 1 });
expenseSchema.index({ event: 1, status: 1 });
expenseSchema.index({ paidBy: 1, date: -1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ status: 1, date: -1 });
expenseSchema.index({ amount: -1 });
expenseSchema.index({ createdAt: -1 });

// Compound indexes for common queries
expenseSchema.index({ event: 1, status: 1, date: -1 });
expenseSchema.index({ paidBy: 1, status: 1, date: -1 });

// Text search index
expenseSchema.index({
  description: 'text',
  category: 'text',
  'vendor.name': 'text',
  notes: 'text'
});

// ==================== VIRTUAL FIELDS ====================
expenseSchema.virtual('isApproved').get(function() {
  return this.status === 'approved';
});

expenseSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

expenseSchema.virtual('isRejected').get(function() {
  return this.status === 'rejected';
});

expenseSchema.virtual('daysSinceAdded').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

expenseSchema.virtual('expenseDetails').get(function() {
  return {
    description: this.description,
    category: this.category,
    amount: this.amount,
    date: this.date,
    status: this.status
  };
});

// ==================== METHODS ====================
expenseSchema.methods.approve = function(approvedBy, notes = '') {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  if (notes) this.internalNotes = notes;
  return this.save();
};

expenseSchema.methods.reject = function(rejectedBy, reason) {
  this.status = 'rejected';
  this.rejectedBy = rejectedBy;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

expenseSchema.methods.addReceipt = function(fileUrl, fileName, fileSize) {
  this.receipt = {
    url: fileUrl,
    fileName: fileName,
    fileSize: fileSize,
    uploadedAt: new Date()
  };
  return this.save();
};

expenseSchema.methods.addSupportingDocument = function(fileUrl, fileName, description = '') {
  this.supportingDocuments.push({
    url: fileUrl,
    fileName: fileName,
    description: description,
    uploadedAt: new Date()
  });
  return this.save();
};

expenseSchema.methods.updateCategory = function(newCategory, subCategory = null) {
  this.category = newCategory;
  if (subCategory) this.subCategory = subCategory;
  return this.save();
};

expenseSchema.methods.toExpenseJSON = function() {
  const obj = this.toObject();
  obj.isApproved = this.isApproved;
  obj.isPending = this.isPending;
  obj.isRejected = this.isRejected;
  obj.daysSinceAdded = this.daysSinceAdded;
  obj.expenseDetails = this.expenseDetails;
  return obj;
};

// ==================== STATIC METHODS ====================
expenseSchema.statics.getEventExpenses = function(eventId, options = {}) {
  const { status, category, populateUser = true } = options;
  
  let query = this.find({ event: eventId });
  
  if (status) query = query.where('status').equals(status);
  if (category) query = query.where('category').equals(category);
  
  if (populateUser) {
    query = query.populate('paidBy', 'name email phone')
                .populate('addedBy', 'name email')
                .populate('approvedBy', 'name email')
                .populate('rejectedBy', 'name email');
  }
  
  return query.sort({ date: -1, createdAt: -1 });
};

expenseSchema.statics.getExpenseSummary = function(eventId) {
  return this.aggregate([
    {
      $match: {
        event: mongoose.Types.ObjectId(eventId),
        status: 'approved'
      }
    },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        expenseCount: { $sum: 1 },
        averageAmount: { $avg: '$amount' }
      }
    },
    {
      $project: {
        category: '$_id',
        totalAmount: 1,
        expenseCount: 1,
        averageAmount: 1,
        _id: 0
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);
};

expenseSchema.statics.getPendingExpenses = function(eventId = null) {
  let query = { status: 'pending' };
  if (eventId) query.event = eventId;
  
  return this.find(query)
    .populate('event', 'title date')
    .populate('paidBy', 'name email')
    .populate('addedBy', 'name email')
    .sort({ createdAt: 1 });
};

expenseSchema.statics.getExpenseTrend = function(eventId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        event: mongoose.Types.ObjectId(eventId),
        date: { $gte: startDate },
        status: 'approved'
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        },
        totalAmount: { $sum: '$amount' },
        expenseCount: { $sum: 1 }
      }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        totalAmount: 1,
        expenseCount: 1,
        _id: 0
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);
};

// ==================== MIDDLEWARE ====================
expenseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-set addedBy if not provided
  if (!this.addedBy && this.paidBy) {
    this.addedBy = this.paidBy;
  }
  
  next();
});

expenseSchema.post('save', async function(doc) {
  // Update event total expenses when expense is approved/modified
  if (doc.isModified('amount') || doc.isModified('status')) {
    try {
      const Event = mongoose.model('Event');
      await Event.findById(doc.event).then(async (event) => {
        if (event) {
          await event.updateFinancials();
        }
      });
    } catch (error) {
      console.error('Error updating event expenses:', error);
    }
  }
});

// ==================== QUERY HELPERS ====================
expenseSchema.query.byEvent = function(eventId) {
  return this.where({ event: eventId });
};

expenseSchema.query.byCategory = function(category) {
  return this.where({ category });
};

expenseSchema.query.approved = function() {
  return this.where({ status: 'approved' });
};

expenseSchema.query.pending = function() {
  return this.where({ status: 'pending' });
};

expenseSchema.query.byUser = function(userId) {
  return this.where({ paidBy: userId });
};

expenseSchema.query.byDateRange = function(startDate, endDate) {
  return this.where({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  });
};

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
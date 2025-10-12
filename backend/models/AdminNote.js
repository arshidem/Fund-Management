const mongoose = require('mongoose');

const adminNoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  note: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['general', 'warning', 'internal', 'follow_up', 'positive'],
    default: 'general'
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPrivate: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
adminNoteSchema.index({ userId: 1, createdAt: -1 });
adminNoteSchema.index({ adminId: 1 });
adminNoteSchema.index({ category: 1 });
adminNoteSchema.index({ tags: 1 });

module.exports = mongoose.model('AdminNote', adminNoteSchema);
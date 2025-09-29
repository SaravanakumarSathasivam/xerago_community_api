const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['inappropriate_content', 'spam', 'harassment', 'other'],
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  targetContent: {
    model: { type: String, enum: ['Forum', 'Article', 'Event'] },
    refId: { type: mongoose.Schema.Types.ObjectId }
  },
  reason: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
}, {
  timestamps: true
});

reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);



const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Reply content is required'],
    maxlength: [2000, 'Reply cannot exceed 2000 characters']
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isSolution: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Post title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Post content is required'],
    maxlength: [5000, 'Content cannot exceed 5000 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'general',
      'tech',
      'marketing',
      'analytics',
      'ai',
      'announcements',
      'support',
      'feedback'
    ]
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  status: {
    type: String,
    enum: ['active', 'closed', 'archived', 'pinned'],
    default: 'active'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [replySchema],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  lastActivity: {
    type: Date,
    default: Date.now
  },
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
postSchema.index({ category: 1, createdAt: -1 });
postSchema.index({ author: 1 });
postSchema.index({ status: 1 });
postSchema.index({ tags: 1 });
postSchema.index({ lastActivity: -1 });
postSchema.index({ title: 'text', content: 'text' });

// Virtual for reply count
postSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Virtual for like count
postSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for is solved (has solution reply)
postSchema.virtual('isSolved').get(function() {
  return this.replies.some(reply => reply.isSolution);
});

// Pre-save middleware to update last activity
postSchema.pre('save', function(next) {
  if (this.isModified('replies')) {
    this.lastActivity = new Date();
  }
  next();
});

// Method to add reply
postSchema.methods.addReply = function(replyData) {
  this.replies.push(replyData);
  this.lastActivity = new Date();
  return this.save();
};

// Method to like/unlike post
postSchema.methods.toggleLike = function(userId) {
  const likeIndex = this.likes.indexOf(userId);
  if (likeIndex > -1) {
    this.likes.splice(likeIndex, 1);
  } else {
    this.likes.push(userId);
  }
  return this.save();
};

// Method to mark reply as solution
postSchema.methods.markAsSolution = function(replyId) {
  // Remove solution from all replies
  this.replies.forEach(reply => {
    reply.isSolution = false;
  });
  
  // Mark the selected reply as solution
  const reply = this.replies.id(replyId);
  if (reply) {
    reply.isSolution = true;
  }
  
  return this.save();
};

// Method to increment views
postSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Static method to get posts by category
postSchema.statics.getByCategory = function(category, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ category, status: 'active' })
    .populate('author', 'name email avatar department')
    .sort({ lastActivity: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to search posts
postSchema.statics.search = function(query, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({
    $text: { $search: query },
    status: 'active'
  })
    .populate('author', 'name email avatar department')
    .sort({ score: { $meta: 'textScore' }, lastActivity: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get popular posts
postSchema.statics.getPopular = function(limit = 10) {
  return this.find({ status: 'active' })
    .populate('author', 'name email avatar department')
    .sort({ views: -1, likeCount: -1 })
    .limit(limit);
};

// Static method to get recent posts
postSchema.statics.getRecent = function(limit = 10) {
  return this.find({ status: 'active' })
    .populate('author', 'name email avatar department')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Forum', postSchema);

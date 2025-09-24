const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Article title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Article content is required'],
    maxlength: [10000, 'Content cannot exceed 10000 characters']
  },
  excerpt: {
    type: String,
    maxlength: [500, 'Excerpt cannot exceed 500 characters']
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
      'technology',
      'marketing',
      'analytics',
      'ai',
      'business',
      'tutorial',
      'news',
      'case-study',
      'best-practices',
      'tools'
    ]
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: Date
  }],
  readingTime: {
    type: Number, // in minutes
    default: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  publishedAt: Date,
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String
  }],
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
articleSchema.index({ category: 1, publishedAt: -1 });
articleSchema.index({ author: 1 });
articleSchema.index({ status: 1 });
articleSchema.index({ featured: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ title: 'text', content: 'text', excerpt: 'text' });
articleSchema.index({ publishedAt: -1 });

// Virtual for like count
articleSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for bookmark count
articleSchema.virtual('bookmarkCount').get(function() {
  return this.bookmarks.length;
});

// Virtual for comment count
articleSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Virtual for slug
articleSchema.virtual('slug').get(function() {
  return this.title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
});

// Pre-save middleware to calculate reading time and set published date
articleSchema.pre('save', function(next) {
  // Calculate reading time (average 200 words per minute)
  const wordCount = this.content.split(/\s+/).length;
  this.readingTime = Math.ceil(wordCount / 200);
  
  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Method to like/unlike article
articleSchema.methods.toggleLike = function(userId) {
  const likeIndex = this.likes.indexOf(userId);
  if (likeIndex > -1) {
    this.likes.splice(likeIndex, 1);
  } else {
    this.likes.push(userId);
  }
  return this.save();
};

// Method to bookmark/unbookmark article
articleSchema.methods.toggleBookmark = function(userId) {
  const bookmarkIndex = this.bookmarks.indexOf(userId);
  if (bookmarkIndex > -1) {
    this.bookmarks.splice(bookmarkIndex, 1);
  } else {
    this.bookmarks.push(userId);
  }
  return this.save();
};

// Method to add comment
articleSchema.methods.addComment = function(commentData) {
  this.comments.push(commentData);
  return this.save();
};

// Method to like/unlike comment
articleSchema.methods.toggleCommentLike = function(commentId, userId) {
  const comment = this.comments.id(commentId);
  if (comment) {
    const likeIndex = comment.likes.indexOf(userId);
    if (likeIndex > -1) {
      comment.likes.splice(likeIndex, 1);
    } else {
      comment.likes.push(userId);
    }
  }
  return this.save();
};

// Method to increment views
articleSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to publish article
articleSchema.methods.publish = function() {
  this.status = 'published';
  this.publishedAt = new Date();
  return this.save();
};

// Method to unpublish article
articleSchema.methods.unpublish = function() {
  this.status = 'draft';
  return this.save();
};

// Static method to get published articles
articleSchema.statics.getPublished = function(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ status: 'published' })
    .populate('author', 'name email avatar department')
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get featured articles
articleSchema.statics.getFeatured = function(limit = 5) {
  return this.find({ status: 'published', featured: true })
    .populate('author', 'name email avatar department')
    .sort({ publishedAt: -1 })
    .limit(limit);
};

// Static method to get articles by category
articleSchema.statics.getByCategory = function(category, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ category, status: 'published' })
    .populate('author', 'name email avatar department')
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to search articles
articleSchema.statics.search = function(query, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({
    $text: { $search: query },
    status: 'published'
  })
    .populate('author', 'name email avatar department')
    .sort({ score: { $meta: 'textScore' }, publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get popular articles
articleSchema.statics.getPopular = function(limit = 10) {
  return this.find({ status: 'published' })
    .populate('author', 'name email avatar department')
    .sort({ views: -1, likeCount: -1 })
    .limit(limit);
};

// Static method to get recent articles
articleSchema.statics.getRecent = function(limit = 10) {
  return this.find({ status: 'published' })
    .populate('author', 'name email avatar department')
    .sort({ publishedAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Article', articleSchema);

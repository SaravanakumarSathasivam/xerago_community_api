const mongoose = require('mongoose');

const dropdownOptionSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    index: true
  },
  value: {
    type: String,
    required: [true, 'Value is required'],
    trim: true
  },
  label: {
    type: String,
    required: [true, 'Label is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    color: String,
    icon: String,
    parentCategory: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for efficient queries
dropdownOptionSchema.index({ category: 1, order: 1 });
dropdownOptionSchema.index({ category: 1, isActive: 1 });

// Static method to get options by category
dropdownOptionSchema.statics.getByCategory = function(category) {
  return this.find({ category, isActive: true })
    .sort({ order: 1, label: 1 });
};

// Static method to get all categories
dropdownOptionSchema.statics.getCategories = function() {
  return this.distinct('category', { isActive: true });
};

// Static method to seed default options
dropdownOptionSchema.statics.seedDefaultOptions = async function() {
  const defaultOptions = [
    // Event Types
    { category: 'event_type', value: 'workshop', label: 'Workshop', order: 1 },
    { category: 'event_type', value: 'lunch-learn', label: 'Lunch & Learn', order: 2 },
    { category: 'event_type', value: 'presentation', label: 'Presentation', order: 3 },
    { category: 'event_type', value: 'team-building', label: 'Team Building', order: 4 },
    { category: 'event_type', value: 'conference', label: 'Conference', order: 5 },
    { category: 'event_type', value: 'training', label: 'Training', order: 6 },

    // Event Categories
    { category: 'event_category', value: 'ai-innovation', label: 'AI & Innovation', order: 1 },
    { category: 'event_category', value: 'analytics', label: 'Analytics', order: 2 },
    { category: 'event_category', value: 'technology', label: 'Technology', order: 3 },
    { category: 'event_category', value: 'marketing', label: 'Marketing', order: 4 },
    { category: 'event_category', value: 'social', label: 'Social', order: 5 },
    { category: 'event_category', value: 'professional-development', label: 'Professional Development', order: 6 },

    // Event Sort Options
    { category: 'event_sort', value: 'date', label: 'By Date', order: 1 },
    { category: 'event_sort', value: 'popular', label: 'Most Popular', order: 2 },

    // Forum Categories
    { category: 'forum_category', value: 'general', label: 'General Discussion', order: 1 },
    { category: 'forum_category', value: 'tech', label: 'Tech Talk', order: 2 },
    { category: 'forum_category', value: 'marketing', label: 'Marketing Insights', order: 3 },
    { category: 'forum_category', value: 'analytics', label: 'Data & Analytics', order: 4 },
    { category: 'forum_category', value: 'ai', label: 'AI & Innovation', order: 5 },
    { category: 'forum_category', value: 'announcements', label: 'Announcements', order: 6 },

    // Forum Sort Options
    { category: 'forum_sort', value: 'recent', label: 'Most Recent', order: 1 },
    { category: 'forum_sort', value: 'popular', label: 'Most Liked', order: 2 },
    { category: 'forum_sort', value: 'discussed', label: 'Most Discussed', order: 3 },
    { category: 'forum_sort', value: 'unanswered', label: 'UnAnswered', order: 4 },

    // Article Categories
    { category: 'article_category', value: 'marketing', label: 'Marketing', order: 1 },
    { category: 'article_category', value: 'analytics', label: 'Analytics', order: 2 },
    { category: 'article_category', value: 'technology', label: 'Technology', order: 3 },
    { category: 'article_category', value: 'ai-innovation', label: 'AI & Innovation', order: 4 },
    { category: 'article_category', value: 'business', label: 'Business', order: 5 },
    { category: 'article_category', value: 'campaign', label: 'Campaign', order: 6 },

    // Article Types
    { category: 'article_type', value: 'guide', label: 'Guide', order: 1 },
    { category: 'article_type', value: 'tutorial', label: 'Tutorial', order: 2 },
    { category: 'article_type', value: 'checklist', label: 'Checklist', order: 3 },
    { category: 'article_type', value: 'comparison', label: 'Comparison', order: 4 },
    { category: 'article_type', value: 'template', label: 'Template', order: 5 },
    { category: 'article_type', value: 'case-study', label: 'Case Study', order: 6 },

    // Article Difficulty Levels
    { category: 'article_difficulty', value: 'beginner', label: 'Beginner', order: 1 },
    { category: 'article_difficulty', value: 'intermediate', label: 'Intermediate', order: 2 },
    { category: 'article_difficulty', value: 'advanced', label: 'Advanced', order: 3 },

    // Article Sort Options
    { category: 'article_sort', value: 'recent', label: 'Most Recent', order: 1 },
    { category: 'article_sort', value: 'popular', label: 'Most Viewed', order: 2 },
    { category: 'article_sort', value: 'liked', label: 'Most Liked', order: 3 },

    // Admin User Status Filter
    { category: 'admin_user_status', value: 'all', label: 'All Users', order: 1 },
    { category: 'admin_user_status', value: 'active', label: 'Active', order: 2 },
    { category: 'admin_user_status', value: 'suspended', label: 'Suspended', order: 3 },
    { category: 'admin_user_status', value: 'moderators', label: 'Moderators', order: 4 },

    // Report Priority
    { category: 'report_priority', value: 'high', label: 'High', order: 1 },
    { category: 'report_priority', value: 'medium', label: 'Medium', order: 2 },
    { category: 'report_priority', value: 'low', label: 'Low', order: 3 },

    // Report Types
    { category: 'report_type', value: 'inappropriate_content', label: 'Inappropriate Content', order: 1 },
    { category: 'report_type', value: 'spam', label: 'Spam', order: 2 },
    { category: 'report_type', value: 'harassment', label: 'Harassment', order: 3 }
  ];

  // Insert options if they don't exist
  for (const option of defaultOptions) {
    await this.findOneAndUpdate(
      { category: option.category, value: option.value },
      option,
      { upsert: true }
    );
  }

  console.log('Default dropdown options seeded successfully');
};

module.exports = mongoose.model('DropdownOption', dropdownOptionSchema);

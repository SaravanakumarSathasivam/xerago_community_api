const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Achievement name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Achievement description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'participation',
      'knowledge',
      'leadership',
      'collaboration',
      'innovation',
      'mentorship',
      'expertise',
      'community',
      'milestone',
      'special'
    ]
  },
  type: {
    type: String,
    enum: ['badge', 'trophy', 'medal', 'certificate', 'title'],
    default: 'badge'
  },
  icon: {
    type: String,
    required: [true, 'Icon is required']
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  points: {
    type: Number,
    required: [true, 'Points are required'],
    min: [0, 'Points cannot be negative']
  },
  criteria: {
    type: {
      type: String,
      required: [true, 'Criteria type is required'],
      enum: [
        'article_count',
        'forum_posts',
        'forum_replies',
        'event_attendance',
        'event_creation',
        'likes_received',
        'days_active',
        'consecutive_days',
        'points_earned',
        'level_reached',
        'custom'
      ]
    },
    value: {
      type: Number,
      required: [true, 'Criteria value is required'],
      min: [1, 'Criteria value must be at least 1']
    },
    timeframe: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly', 'all_time'],
      default: 'all_time'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement'
  }],
  rewards: {
    points: {
      type: Number,
      default: 0
    },
    title: String,
    specialPrivileges: [String]
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    tags: [String],
    version: {
      type: String,
      default: '1.0.0'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
achievementSchema.index({ category: 1 });
achievementSchema.index({ type: 1 });
achievementSchema.index({ rarity: 1 });
achievementSchema.index({ isActive: 1 });
achievementSchema.index({ 'criteria.type': 1 });

// Virtual for earned count (will be populated from User model)
achievementSchema.virtual('earnedCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'gamification.achievements.achievement',
  count: true
});

// Method to check if user meets criteria
achievementSchema.methods.checkCriteria = async function(userId) {
  const User = mongoose.model('User');
  const Forum = mongoose.model('Forum');
  const Article = mongoose.model('Article');
  const Event = mongoose.model('Event');
  
  const user = await User.findById(userId);
  if (!user) return false;
  
  const now = new Date();
  let startDate;
  
  // Calculate start date based on timeframe
  switch (this.criteria.timeframe) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      startDate = new Date(now.setDate(now.getDate() - now.getDay()));
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(0); // All time
  }
  
  let count = 0;
  
  switch (this.criteria.type) {
    case 'article_count':
      count = await Article.countDocuments({
        author: userId,
        status: 'published',
        createdAt: { $gte: startDate }
      });
      break;
      
    case 'forum_posts':
      count = await Forum.countDocuments({
        author: userId,
        createdAt: { $gte: startDate }
      });
      break;
      
    case 'forum_replies':
      count = await Forum.countDocuments({
        'replies.author': userId,
        'replies.createdAt': { $gte: startDate }
      });
      break;
      
    case 'event_attendance':
      count = await Event.countDocuments({
        'attendees.user': userId,
        'attendees.status': 'attending',
        'attendees.registeredAt': { $gte: startDate }
      });
      break;
      
    case 'event_creation':
      count = await Event.countDocuments({
        organizer: userId,
        createdAt: { $gte: startDate }
      });
      break;
      
    case 'likes_received':
      const articleLikes = await Article.aggregate([
        { $match: { author: mongoose.Types.ObjectId(userId) } },
        { $project: { likeCount: { $size: '$likes' } } },
        { $group: { _id: null, total: { $sum: '$likeCount' } } }
      ]);
      count = articleLikes[0]?.total || 0;
      break;
      
    case 'points_earned':
      count = user.gamification.points;
      break;
      
    case 'level_reached':
      count = user.gamification.level;
      break;
      
    case 'days_active':
      // This would require tracking daily activity
      count = user.loginCount; // Simplified for now
      break;
      
    default:
      return false;
  }
  
  return count >= this.criteria.value;
};

// Static method to get achievements by category
achievementSchema.statics.getByCategory = function(category) {
  return this.find({ category, isActive: true })
    .sort({ points: 1 });
};

// Static method to get achievements by rarity
achievementSchema.statics.getByRarity = function(rarity) {
  return this.find({ rarity, isActive: true })
    .sort({ points: 1 });
};

// Static method to get available achievements for user
achievementSchema.statics.getAvailableForUser = async function(userId) {
  const achievements = await this.find({ isActive: true, isHidden: false });
  const availableAchievements = [];
  
  for (const achievement of achievements) {
    const meetsCriteria = await achievement.checkCriteria(userId);
    if (meetsCriteria) {
      availableAchievements.push(achievement);
    }
  }
  
  return availableAchievements;
};

// Static method to get user's earned achievements
achievementSchema.statics.getEarnedByUser = async function(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId).populate('gamification.achievements.achievement');
  
  if (!user) return [];
  
  return user.gamification.achievements.map(ach => ({
    achievement: ach.achievement,
    earnedAt: ach.earnedAt
  }));
};

module.exports = mongoose.model('Achievement', achievementSchema);

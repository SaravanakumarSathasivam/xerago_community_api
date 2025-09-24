const mongoose = require('mongoose');

const leaderboardEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  rank: {
    type: Number,
    required: true
  },
  badges: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement'
  }],
  achievements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement'
  }],
  stats: {
    articlesCreated: {
      type: Number,
      default: 0
    },
    forumPosts: {
      type: Number,
      default: 0
    },
    forumReplies: {
      type: Number,
      default: 0
    },
    eventsAttended: {
      type: Number,
      default: 0
    },
    eventsCreated: {
      type: Number,
      default: 0
    },
    likesReceived: {
      type: Number,
      default: 0
    },
    daysActive: {
      type: Number,
      default: 0
    }
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'all_time'],
    required: true
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

const leaderboardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['overall', 'articles', 'forums', 'events', 'engagement', 'custom'],
    required: true
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'all_time'],
    required: true
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  entries: [leaderboardEntrySchema],
  totalParticipants: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    generatedAt: {
      type: Date,
      default: Date.now
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    criteria: {
      minPoints: {
        type: Number,
        default: 0
      },
      minActivity: {
        type: Number,
        default: 0
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
leaderboardSchema.index({ type: 1, period: 1, periodStart: -1 });
leaderboardSchema.index({ isActive: 1 });
leaderboardSchema.index({ 'entries.user': 1 });
leaderboardSchema.index({ 'entries.rank': 1 });

// Virtual for top performers
leaderboardSchema.virtual('topPerformers').get(function() {
  return this.entries.slice(0, 10);
});

// Method to add or update entry
leaderboardSchema.methods.updateEntry = function(userId, userData) {
  const existingEntryIndex = this.entries.findIndex(
    entry => entry.user.toString() === userId.toString()
  );
  
  if (existingEntryIndex > -1) {
    // Update existing entry
    this.entries[existingEntryIndex] = {
      ...this.entries[existingEntryIndex].toObject(),
      ...userData,
      user: userId
    };
  } else {
    // Add new entry
    this.entries.push({
      user: userId,
      ...userData
    });
  }
  
  // Sort entries by points (descending)
  this.entries.sort((a, b) => b.points - a.points);
  
  // Update ranks
  this.entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  this.totalParticipants = this.entries.length;
  return this.save();
};

// Method to get user's rank
leaderboardSchema.methods.getUserRank = function(userId) {
  const entry = this.entries.find(
    entry => entry.user.toString() === userId.toString()
  );
  return entry ? entry.rank : null;
};

// Method to get users around a specific rank
leaderboardSchema.methods.getUsersAroundRank = function(rank, range = 2) {
  const startIndex = Math.max(0, rank - range - 1);
  const endIndex = Math.min(this.entries.length, rank + range);
  return this.entries.slice(startIndex, endIndex);
};

// Static method to generate leaderboard
leaderboardSchema.statics.generateLeaderboard = async function(type, period) {
  const User = mongoose.model('User');
  const Article = mongoose.model('Article');
  const Forum = mongoose.model('Forum');
  const Event = mongoose.model('Event');
  
  // Calculate period dates
  const now = new Date();
  let periodStart, periodEnd;
  
  switch (period) {
    case 'daily':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      periodStart = new Date(now.setDate(now.getDate() - now.getDay()));
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'yearly':
      periodStart = new Date(now.getFullYear(), 0, 1);
      periodEnd = new Date(now.getFullYear() + 1, 0, 1);
      break;
    default: // all_time
      periodStart = new Date(0);
      periodEnd = new Date();
  }
  
  // Get all active users
  const users = await User.find({ isActive: true })
    .populate('gamification.achievements.achievement');
  
  const entries = [];
  
  for (const user of users) {
    let points = 0;
    let stats = {
      articlesCreated: 0,
      forumPosts: 0,
      forumReplies: 0,
      eventsAttended: 0,
      eventsCreated: 0,
      likesReceived: 0,
      daysActive: 0
    };
    
    // Calculate points and stats based on type
    switch (type) {
      case 'overall':
        points = user.gamification.points;
        break;
        
      case 'articles':
        const articles = await Article.find({
          author: user._id,
          status: 'published',
          createdAt: { $gte: periodStart, $lt: periodEnd }
        });
        stats.articlesCreated = articles.length;
        points = articles.length * 10; // 10 points per article
        break;
        
      case 'forums':
        const posts = await Forum.find({
          author: user._id,
          createdAt: { $gte: periodStart, $lt: periodEnd }
        });
        const replies = await Forum.find({
          'replies.author': user._id,
          'replies.createdAt': { $gte: periodStart, $lt: periodEnd }
        });
        stats.forumPosts = posts.length;
        stats.forumReplies = replies.length;
        points = posts.length * 5 + replies.length * 3;
        break;
        
      case 'events':
        const attendedEvents = await Event.find({
          'attendees.user': user._id,
          'attendees.status': 'attending',
          'attendees.registeredAt': { $gte: periodStart, $lt: periodEnd }
        });
        const createdEvents = await Event.find({
          organizer: user._id,
          createdAt: { $gte: periodStart, $lt: periodEnd }
        });
        stats.eventsAttended = attendedEvents.length;
        stats.eventsCreated = createdEvents.length;
        points = attendedEvents.length * 8 + createdEvents.length * 15;
        break;
        
      case 'engagement':
        // Calculate likes received
        const articleLikes = await Article.aggregate([
          { $match: { author: user._id } },
          { $project: { likeCount: { $size: '$likes' } } },
          { $group: { _id: null, total: { $sum: '$likeCount' } } }
        ]);
        stats.likesReceived = articleLikes[0]?.total || 0;
        points = stats.likesReceived * 2;
        break;
    }
    
    // Add to entries if user has activity
    if (points > 0 || type === 'overall') {
      entries.push({
        user: user._id,
        points: points,
        level: user.gamification.level,
        rank: 0, // Will be set after sorting
        badges: user.gamification.badges,
        achievements: user.gamification.achievements.map(ach => ach.achievement),
        stats: stats,
        period: period,
        periodStart: periodStart,
        periodEnd: periodEnd
      });
    }
  }
  
  // Sort by points and assign ranks
  entries.sort((a, b) => b.points - a.points);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  // Create or update leaderboard
  const leaderboard = await this.findOneAndUpdate(
    { type, period, periodStart, periodEnd },
    {
      type,
      period,
      periodStart,
      periodEnd,
      entries,
      totalParticipants: entries.length,
      isActive: true,
      'metadata.generatedAt': new Date()
    },
    { upsert: true, new: true }
  );
  
  return leaderboard;
};

// Static method to get current leaderboard
leaderboardSchema.statics.getCurrent = function(type = 'overall', period = 'all_time') {
  return this.findOne({ type, period, isActive: true })
    .populate('entries.user', 'name email avatar department')
    .populate('entries.badges')
    .populate('entries.achievements')
    .sort({ 'metadata.generatedAt': -1 });
};

// Static method to get user's position
leaderboardSchema.statics.getUserPosition = function(userId, type = 'overall', period = 'all_time') {
  return this.findOne({ type, period, isActive: true })
    .populate('entries.user', 'name email avatar department')
    .then(leaderboard => {
      if (!leaderboard) return null;
      
      const userEntry = leaderboard.entries.find(
        entry => entry.user._id.toString() === userId.toString()
      );
      
      return userEntry ? {
        rank: userEntry.rank,
        points: userEntry.points,
        level: userEntry.level,
        stats: userEntry.stats
      } : null;
    });
};

module.exports = mongoose.model('Leaderboard', leaderboardSchema);

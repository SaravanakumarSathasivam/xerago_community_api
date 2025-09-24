const User = require('../models/User');
const Achievement = require('../models/Achievement');
const Leaderboard = require('../models/Leaderboard');
const config = require('../config/config');
const logger = require('./logger');

/**
 * Award points to user for specific action
 */
const awardPoints = async (userId, action, metadata = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let points = 0;
    
    // Calculate points based on action
    switch (action) {
      case 'article_create':
        points = config.gamification.points.articleCreate;
        break;
      case 'article_like':
        points = config.gamification.points.articleLike;
        break;
      case 'forum_post':
        points = config.gamification.points.forumPost;
        break;
      case 'forum_reply':
        points = config.gamification.points.forumReply;
        break;
      case 'event_attend':
        points = config.gamification.points.eventAttend;
        break;
      case 'event_create':
        points = config.gamification.points.eventCreate;
        break;
      default:
        points = 0;
    }

    if (points > 0) {
      await user.addPoints(points);
      
      logger.logUserAction(userId, 'points_awarded', {
        action,
        points,
        totalPoints: user.gamification.points,
        metadata
      });

      // Check for new achievements
      await checkAndAwardAchievements(userId);
    }

    return { points, totalPoints: user.gamification.points };
  } catch (error) {
    logger.error('Error awarding points:', error);
    throw error;
  }
};

/**
 * Check and award achievements to user
 */
const checkAndAwardAchievements = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const availableAchievements = await Achievement.getAvailableForUser(userId);
    const newAchievements = [];

    for (const achievement of availableAchievements) {
      // Check if user already has this achievement
      const hasAchievement = user.gamification.achievements.some(
        ach => ach.achievement.toString() === achievement._id.toString()
      );

      if (!hasAchievement) {
        await user.addAchievement(achievement._id);
        newAchievements.push(achievement);

        logger.logUserAction(userId, 'achievement_earned', {
          achievementId: achievement._id,
          achievementName: achievement.name,
          points: achievement.points
        });
      }
    }

    return newAchievements;
  } catch (error) {
    logger.error('Error checking achievements:', error);
    throw error;
  }
};

/**
 * Get user's gamification stats
 */
const getUserGamificationStats = async (userId) => {
  try {
    const user = await User.findById(userId)
      .populate('gamification.achievements.achievement')
      .populate('gamification.badges');

    if (!user) {
      throw new Error('User not found');
    }

    const stats = {
      points: user.gamification.points,
      level: user.gamification.level,
      badges: user.gamification.badges,
      achievements: user.gamification.achievements,
      nextLevelPoints: (user.gamification.level * 100) - user.gamification.points,
      progressToNextLevel: (user.gamification.points % 100) / 100
    };

    return stats;
  } catch (error) {
    logger.error('Error getting gamification stats:', error);
    throw error;
  }
};

/**
 * Get leaderboard data
 */
const getLeaderboard = async (type = 'overall', period = 'all_time', limit = 10) => {
  try {
    let leaderboard = await Leaderboard.getCurrent(type, period);
    
    if (!leaderboard) {
      // Generate leaderboard if it doesn't exist
      leaderboard = await Leaderboard.generateLeaderboard(type, period);
    }

    return {
      type,
      period,
      entries: leaderboard.entries.slice(0, limit),
      totalParticipants: leaderboard.totalParticipants,
      generatedAt: leaderboard.metadata.generatedAt
    };
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    throw error;
  }
};

/**
 * Get user's position in leaderboard
 */
const getUserLeaderboardPosition = async (userId, type = 'overall', period = 'all_time') => {
  try {
    const position = await Leaderboard.getUserPosition(userId, type, period);
    return position;
  } catch (error) {
    logger.error('Error getting user leaderboard position:', error);
    throw error;
  }
};

/**
 * Create custom achievement
 */
const createAchievement = async (achievementData) => {
  try {
    const achievement = new Achievement(achievementData);
    await achievement.save();
    
    logger.logUserAction(achievementData.createdBy, 'achievement_created', {
      achievementId: achievement._id,
      achievementName: achievement.name
    });

    return achievement;
  } catch (error) {
    logger.error('Error creating achievement:', error);
    throw error;
  }
};

/**
 * Get all achievements
 */
const getAllAchievements = async (category = null, rarity = null) => {
  try {
    let query = { isActive: true };
    
    if (category) {
      query.category = category;
    }
    
    if (rarity) {
      query.rarity = rarity;
    }

    const achievements = await Achievement.find(query)
      .sort({ points: 1 });

    return achievements;
  } catch (error) {
    logger.error('Error getting achievements:', error);
    throw error;
  }
};

/**
 * Get user's earned achievements
 */
const getUserAchievements = async (userId) => {
  try {
    const achievements = await Achievement.getEarnedByUser(userId);
    return achievements;
  } catch (error) {
    logger.error('Error getting user achievements:', error);
    throw error;
  }
};

/**
 * Calculate user's level based on points
 */
const calculateUserLevel = (points) => {
  return Math.floor(points / 100) + 1;
};

/**
 * Calculate points needed for next level
 */
const calculatePointsToNextLevel = (currentPoints) => {
  const currentLevel = calculateUserLevel(currentPoints);
  const nextLevelPoints = currentLevel * 100;
  return nextLevelPoints - currentPoints;
};

/**
 * Get level progress percentage
 */
const getLevelProgress = (currentPoints) => {
  const currentLevel = calculateUserLevel(currentPoints);
  const levelStartPoints = (currentLevel - 1) * 100;
  const levelEndPoints = currentLevel * 100;
  const progress = (currentPoints - levelStartPoints) / (levelEndPoints - levelStartPoints);
  return Math.min(progress * 100, 100);
};

/**
 * Generate leaderboard for specific period
 */
const generatePeriodLeaderboard = async (type, period) => {
  try {
    const leaderboard = await Leaderboard.generateLeaderboard(type, period);
    return leaderboard;
  } catch (error) {
    logger.error('Error generating leaderboard:', error);
    throw error;
  }
};

/**
 * Get gamification analytics
 */
const getGamificationAnalytics = async () => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalAchievements = await Achievement.countDocuments({ isActive: true });
    
    const topUsers = await User.find({ isActive: true })
      .select('name email gamification.points gamification.level')
      .sort({ 'gamification.points': -1 })
      .limit(10);

    const achievementStats = await Achievement.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const levelDistribution = await User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$gamification.level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    return {
      totalUsers,
      totalAchievements,
      topUsers,
      achievementStats,
      levelDistribution
    };
  } catch (error) {
    logger.error('Error getting gamification analytics:', error);
    throw error;
  }
};

/**
 * Award bonus points for special events
 */
const awardBonusPoints = async (userId, reason, points, metadata = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await user.addPoints(points);
    
    logger.logUserAction(userId, 'bonus_points_awarded', {
      reason,
      points,
      totalPoints: user.gamification.points,
      metadata
    });

    return { points, totalPoints: user.gamification.points };
  } catch (error) {
    logger.error('Error awarding bonus points:', error);
    throw error;
  }
};

/**
 * Reset user's gamification data (admin only)
 */
const resetUserGamification = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.gamification.points = 0;
    user.gamification.level = 1;
    user.gamification.badges = [];
    user.gamification.achievements = [];

    await user.save();
    
    logger.logUserAction(userId, 'gamification_reset', {
      resetBy: 'admin'
    });

    return user;
  } catch (error) {
    logger.error('Error resetting user gamification:', error);
    throw error;
  }
};

/**
 * Get achievement categories
 */
const getAchievementCategories = async () => {
  try {
    const categories = await Achievement.distinct('category', { isActive: true });
    return categories;
  } catch (error) {
    logger.error('Error getting achievement categories:', error);
    throw error;
  }
};

/**
 * Get achievement rarities
 */
const getAchievementRarities = async () => {
  try {
    const rarities = await Achievement.distinct('rarity', { isActive: true });
    return rarities;
  } catch (error) {
    logger.error('Error getting achievement rarities:', error);
    throw error;
  }
};

module.exports = {
  awardPoints,
  checkAndAwardAchievements,
  getUserGamificationStats,
  getLeaderboard,
  getUserLeaderboardPosition,
  createAchievement,
  getAllAchievements,
  getUserAchievements,
  calculateUserLevel,
  calculatePointsToNextLevel,
  getLevelProgress,
  generatePeriodLeaderboard,
  getGamificationAnalytics,
  awardBonusPoints,
  resetUserGamification,
  getAchievementCategories,
  getAchievementRarities
};

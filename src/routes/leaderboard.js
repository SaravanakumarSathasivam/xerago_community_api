const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const User = require('../models/User');
const Forum = require('../models/Forum');
const Article = require('../models/Article');
const Event = require('../models/Event');

const router = express.Router();

// Get leaderboard (public)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const users = await User.getLeaderboard(20);
    const leaderboard = users.map((u, idx) => ({
      id: u._id.toString(),
      name: u.name,
      department: u.department,
      avatar: u.avatar,
      points: u.gamification.points,
      level: u.gamification.level,
      // The UI shows badges as strings; we expose an empty array by default
      badges: [],
      weeklyPoints: 0,
      monthlyPoints: 0,
      postsCount: 0,
      helpfulAnswers: 0,
      streak: 0,
      rank: idx + 1,
    }));
    res.json({ success: true, data: { leaderboard } });
  } catch (err) {
    next(err);
  }
});

// Get user's position (requires auth)
router.get('/position', authenticate, async (req, res, next) => {
  try {
    const all = await User.find({ isActive: true })
      .select('gamification.points')
      .sort({ 'gamification.points': -1 });
    const position = all.findIndex((u) => u._id.toString() === req.user._id.toString()) + 1;
    res.json({ success: true, data: { position } });
  } catch (err) {
    next(err);
  }
});

// Get achievements (public)
router.get('/achievements', optionalAuth, (req, res) => {
  const achievements = [
    { id: 'first-post', name: 'First Post', description: 'Made your first discussion post', rarity: 'common', icon: '🎯' },
    { id: 'helpful-member', name: 'Helpful Member', description: 'Received 10 likes on your posts', rarity: 'common', icon: '👍' },
    { id: 'knowledge-sharer', name: 'Knowledge Sharer', description: 'Shared 5 knowledge articles', rarity: 'uncommon', icon: '📚' },
    { id: 'top-contributor', name: 'Top Contributor', description: 'Ranked in top 10 contributors this month', rarity: 'rare', icon: '🏆' },
    { id: 'innovation-leader', name: 'Innovation Leader', description: 'Led 3 innovative discussions', rarity: 'epic', icon: '💡' },
    { id: 'community-champion', name: 'Community Champion', description: 'Helped 50+ colleagues with answers', rarity: 'legendary', icon: '🌟' },
  ];
  res.json({ success: true, data: { achievements } });
});

// Get user's achievements (requires auth)
router.get('/my-achievements', authenticate, (req, res) => {
  const badges = req.user?.gamification?.badges || [];
  res.json({ success: true, data: { achievements: badges } });
});

module.exports = router;

// Helper for date ranges
function getPeriodRange(period) {
  const now = new Date();
  let start, end;
  switch (period) {
    case 'weekly':
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    default:
      start = new Date(0);
      end = now;
  }
  return { start, end };
}

// GET /api/leaderboard/summary?period=weekly|monthly|all
router.get('/summary', optionalAuth, async (req, res, next) => {
  try {
    const period = req.query.period || 'all';
    const { start, end } = getPeriodRange(period);

    const [postsCount, articleCount, repliesCount, eventCreatedCount, eventAttendanceCount, users] = await Promise.all([
      Forum.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Article.countDocuments({ status: 'published', createdAt: { $gte: start, $lt: end } }),
      Forum.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $project: { repliesCount: { $size: '$replies' } } },
        { $group: { _id: null, total: { $sum: '$repliesCount' } } },
      ]),
      Event.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Event.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $project: { attendeesCount: { $size: '$attendees' } } },
        { $group: { _id: null, total: { $sum: '$attendeesCount' } } },
      ]),
      User.getLeaderboard(20),
    ]);

    const repliesTotal = repliesCount[0]?.total || 0;
    const attendanceTotal = eventAttendanceCount[0]?.total || 0;

    const leaderboard = users.map((u, idx) => ({
      id: u._id.toString(),
      name: u.name,
      department: u.department,
      avatar: u.avatar,
      points: u.gamification.points,
      level: u.gamification.level,
      badges: [],
      rank: idx + 1,
    }));

    res.json({
      success: true,
      data: {
        period,
        metrics: {
          forumPosts: postsCount,
          forumReplies: repliesTotal,
          articles: articleCount,
          eventsCreated: eventCreatedCount,
          eventAttendance: attendanceTotal,
        },
        leaderboard,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/leaderboard/achievements (derived basic set for now)
router.get('/achievements', optionalAuth, async (req, res, next) => {
  try {
    // Derive some community-wide counts for context
    const [articles, posts] = await Promise.all([
      Article.countDocuments({ status: 'published' }),
      Forum.countDocuments({}),
    ]);
    const achievements = [
      { id: 'first-post', name: 'First Post', description: 'Made your first discussion post', rarity: 'common', icon: '🎯' },
      { id: 'helpful-member', name: 'Helpful Member', description: 'Received 10 likes on your posts', rarity: 'common', icon: '👍' },
      { id: 'knowledge-sharer', name: 'Knowledge Sharer', description: `Shared 5 knowledge articles (Total: ${articles})`, rarity: 'uncommon', icon: '📚' },
      { id: 'top-contributor', name: 'Top Contributor', description: 'Ranked in top 10 contributors this month', rarity: 'rare', icon: '🏆' },
      { id: 'innovation-leader', name: 'Innovation Leader', description: 'Led 3 innovative discussions', rarity: 'epic', icon: '💡' },
      { id: 'community-champion', name: 'Community Champion', description: `Helped colleagues with answers (Posts: ${posts})`, rarity: 'legendary', icon: '🌟' },
    ];
    res.json({ success: true, data: { achievements } });
  } catch (err) {
    next(err);
  }
});

// GET /api/leaderboard/community-stats
router.get('/community-stats', optionalAuth, async (req, res, next) => {
  try {
    const [activeMembers, totalPosts, totalArticles, helpfulAnswers] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Forum.countDocuments({}),
      Article.countDocuments({ status: 'published' }),
      Forum.aggregate([
        { $project: { repliesCount: { $size: '$replies' } } },
        { $group: { _id: null, total: { $sum: '$repliesCount' } } }
      ])
    ]);
    res.json({ success: true, data: {
      activeMembers,
      totalPosts,
      totalArticles,
      helpfulAnswers: helpfulAnswers[0]?.total || 0
    } });
  } catch (err) { next(err); }
});

// GET /api/leaderboard/my-summary (requires auth)
router.get('/my-summary', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    // Earned achievements: flatten user's badges/achievements to ids/names
    await user.populate('gamification.achievements.achievement');
    const earned = (user.gamification?.achievements || []).map((a) => ({
      id: a.achievement._id.toString(),
      name: a.achievement.name,
      icon: a.achievement.icon,
      rarity: a.achievement.rarity,
      earnedAt: a.earnedAt
    }));

    // Next level progress (every 100 points -> +1 level in current logic)
    const points = user.gamification?.points || 0;
    const level = user.gamification?.level || 1;
    const currentLevelFloor = (level - 1) * 100;
    const progressInLevel = Math.max(0, points - currentLevelFloor);
    const progressPercent = Math.min(100, Math.round((progressInLevel / 100) * 100));
    const pointsToNext = Math.max(0, 100 - progressInLevel);

    res.json({ success: true, data: {
      points,
      level,
      progressPercent,
      pointsToNext,
      earnedAchievements: earned
    } });
  } catch (err) { next(err); }
});


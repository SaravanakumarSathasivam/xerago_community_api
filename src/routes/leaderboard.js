const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const User = require('../models/User');

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

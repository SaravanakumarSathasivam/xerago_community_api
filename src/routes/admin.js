const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, adminSchemas } = require('../middleware/validation');
const User = require('../models/User');
const Event = require('../models/Event');
const Article = require('../models/Article');
const Forum = require('../models/Forum');
const Achievement = require('../models/Achievement');
const Setting = require('../models/Setting');
const Report = require('../models/Report');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Get platform statistics
router.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, activeUsers, totalPosts, totalArticles, pendingReports] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      Forum.countDocuments({}),
      Article.countDocuments({ status: 'published' }),
      Report.countDocuments({ status: 'pending' })
    ]);
    res.json({ success: true, data: { stats: {
      totalUsers,
      activeUsers,
      totalPosts,
      totalArticles,
      pendingReports,
      newUsersThisWeek: 0,
      engagementRate: 0,
      averageSessionTime: '0m'
    } } });
  } catch (err) { next(err); }
});

// Get all users
router.get('/users', validate(adminSchemas.getUsers, 'query'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, department, isActive, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (department) filter.department = new RegExp(department, 'i');
    if (typeof isActive === 'boolean' || isActive === 'true' || isActive === 'false') filter.isActive = isActive === true || isActive === 'true';
    if (search) filter.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { department: new RegExp(search, 'i') },
    ];
    const users = await User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await User.countDocuments(filter);
    res.json({ success: true, data: { users, total } });
  } catch (err) { next(err); }
});

// Update user role
router.put('/users/:id/role', validate(adminSchemas.updateUserRole), async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const newRole = req.body.role;
    const currentUser = req.user; // Authenticated user making the request

    if (currentUser.id === targetUserId) {
      return res.status(403).json({ success: false, message: 'You cannot change your own role.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Only Super Admin can change roles to 'admin' or 'super_admin'
    if (newRole === 'admin' && currentUser.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only Super Admins can grant Admin roles.' });
    }

    // Super Admin cannot change another Super Admin's role
    if (targetUser.role === 'super_admin' && currentUser.role === 'super_admin' && newRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: "Super Admins cannot change another Super Admin's role." });
    }

    // Prevent non-super_admin from changing existing admin to user
    if (targetUser.role === 'admin' && newRole === 'user' && currentUser.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Only Super Admins can demote an Admin.' });
    }

    const user = await User.findByIdAndUpdate(targetUserId, { role: newRole }, { new: true });
    res.json({ success: true, message: 'User role updated successfully', data: { user } });
  } catch (err) { next(err); }
});

// Update user status
router.put('/users/:id/status', validate(adminSchemas.updateUserStatus), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User status updated successfully', data: { user } });
  } catch (err) { next(err); }
});

// Approve or change article status
router.put('/articles/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body; // 'draft' | 'published' | 'archived'
    const article = await Article.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    res.json({ success: true, message: 'Article status updated', data: { article } });
  } catch (err) { next(err); }
});

// Get reports
router.get('/reports', async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Report.countDocuments(filter);
    res.json({ success: true, data: { reports, total } });
  } catch (err) { next(err); }
});

// Analytics endpoint with engagement, DAU, growth metrics
router.get('/analytics', async (req, res, next) => {
  try {
    // 1) Engagement rate: total (likes+replies) / totalPosts
    const totalPosts = await Forum.countDocuments({});
    const totalArticles = await Article.countDocuments({});
    const totalEvents = await Event.countDocuments({});
    const engagementAgg = await Forum.aggregate([
      { $project: { interactions: { $add: [{ $size: '$likes' }, { $size: '$replies' }] } } },
      { $group: { _id: null, totalInteractions: { $sum: '$interactions' } } }
    ]);
    const totalInteractions = engagementAgg[0]?.totalInteractions || 0;
    const engagementRate = totalPosts > 0 ? Math.round((totalInteractions / totalPosts) * 100) : 0;

    // 2) Avg session time (mock calculation: we can track via session logs in future)
    const averageSessionTime = '12m'; // Placeholder; integrate session tracking if available

    // 3) Daily active users (last 7 days)
    const now = new Date();
    const dailyActiveUsers = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);
      const count = await User.countDocuments({ updatedAt: { $gte: dayStart, $lt: dayEnd } });
      dailyActiveUsers.push({ date: dayStart.toISOString().slice(0, 10), users: count });
    }

    // 4) Content growth: posts created this month vs last month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const postsThisMonth = await Forum.countDocuments({ createdAt: { $gte: thisMonthStart } });
    const postsLastMonth = await Forum.countDocuments({ createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd } });
    const contentGrowth = postsLastMonth > 0 ? Math.round(((postsThisMonth - postsLastMonth) / postsLastMonth) * 100) : 0;

    // 5) Top categories by posts
    const categories = ['ai', 'marketing', 'technology', 'analytics', 'general'];
    const topCategories = [];
    for (const cat of categories) {
      const agg = await Forum.aggregate([
        { $match: { category: cat } },
        { $project: { likesCount: { $size: '$likes' }, repliesCount: { $size: '$replies' } } },
        { $group: { _id: null, posts: { $sum: 1 }, engagement: { $sum: { $add: ['$likesCount', '$repliesCount'] } } } }
      ]);
      topCategories.push({
        name: cat === 'ai' ? 'AI & Innovation' : cat.charAt(0).toUpperCase() + cat.slice(1),
        posts: agg[0]?.posts || 0,
        engagement: agg[0]?.engagement || 0
      });
    }

    res.json({
      success: true,
      data: {
        engagementRate,
        averageSessionTime,
        dailyActiveUsers,
        contentGrowth,
        topCategories,
      }
    });
  } catch (err) { next(err); }
});

// -------- Content: Forums Moderation --------
router.get('/forums/posts', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, approvalStatus } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { content: new RegExp(search, 'i') }
      ];
    }
    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }
    const posts = await Forum.find(filter)
      .populate('author', 'name email department avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Forum.countDocuments(filter);
    res.json({ success: true, data: { posts, total } });
  } catch (err) { next(err); }
});

router.delete('/forums/posts/:id', async (req, res, next) => {
  try {
    const deleted = await Forum.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) { next(err); }
});

router.put('/forums/posts/:id/approval', async (req, res, next) => {
  try {
    const { approvalStatus } = req.body; // 'pending' | 'approved' | 'rejected'
    const post = await Forum.findByIdAndUpdate(
      req.params.id,
      {
        approvalStatus,
        approvedBy: req.user._id,
        approvedAt: new Date()
      },
      { new: true }
    ).populate('author', 'name email department avatar');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post approval status updated', data: { post } });
  } catch (err) { next(err); }
});

// -------- Content: Articles Review --------
router.get('/articles', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$or = [
      { title: new RegExp(search, 'i') },
      { content: new RegExp(search, 'i') }
    ];
    const items = await Article.find(filter)
      .populate('author', 'name email department avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Article.countDocuments(filter);
    res.json({ success: true, data: { articles: items, total } });
  } catch (err) { next(err); }
});

// existing PUT /articles/:id/status handles status updates

// -------- Content: Reports moderation --------
router.put('/reports/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body; // 'pending' | 'resolved' | 'dismissed'
    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report status updated', data: { report } });
  } catch (err) { next(err); }
});

// -------- Gamification: Achievements CRUD --------
router.get('/achievements', async (req, res, next) => {
  try {
    const items = await Achievement.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: { achievements: items } });
  } catch (err) { next(err); }
});

router.post('/achievements', async (req, res, next) => {
  try {
    const created = await Achievement.create(req.body);
    res.status(201).json({ success: true, data: { achievement: created } });
  } catch (err) { next(err); }
});

router.put('/achievements/:id', async (req, res, next) => {
  try {
    const updated = await Achievement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Achievement not found' });
    res.json({ success: true, data: { achievement: updated } });
  } catch (err) { next(err); }
});

router.delete('/achievements/:id', async (req, res, next) => {
  try {
    const deleted = await Achievement.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Achievement not found' });
    res.json({ success: true, message: 'Achievement deleted' });
  } catch (err) { next(err); }
});

// -------- Gamification: Point System Settings --------
router.get('/settings/points', async (req, res, next) => {
  try {
    const defaults = {
      articleCreate: 10,
      articleLike: 2,
      forumPost: 5,
      forumReply: 3,
      eventAttend: 8,
      eventCreate: 15,
    };
    const saved = await Setting.getValue('gamification.points', defaults);
    res.json({ success: true, data: { points: { ...defaults, ...saved } } });
  } catch (err) { next(err); }
});

router.put('/settings/points', async (req, res, next) => {
  try {
    const allowedKeys = ['articleCreate','articleLike','forumPost','forumReply','eventAttend','eventCreate'];
    const incoming = req.body?.points || {};
    const sanitized = {};
    for (const k of allowedKeys) {
      const v = Number(incoming[k]);
      if (!Number.isNaN(v) && v >= 0 && v <= 1000) sanitized[k] = v;
    }
    const updated = await Setting.setValue('gamification.points', sanitized);
    res.json({ success: true, message: 'Point settings updated', data: { points: updated } });
  } catch (err) { next(err); }
});

module.exports = router;



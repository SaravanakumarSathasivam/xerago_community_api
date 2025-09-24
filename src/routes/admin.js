const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, adminSchemas } = require('../middleware/validation');
const User = require('../models/User');
const Event = require('../models/Event');
const Article = require('../models/Article');
const Forum = require('../models/Forum');
const Achievement = require('../models/Achievement');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Get platform statistics
router.get('/stats', (req, res) => {
  // Implementation for getting platform statistics
  res.json({
    success: true,
    data: { stats: {} }
  });
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
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
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
router.get('/reports', (req, res) => {
  // Implementation for getting reports
  res.json({
    success: true,
    data: { reports: [] }
  });
});

module.exports = router;

// Bootstrap minimal sample documents to initialize collections (admin only)
// router.post('/bootstrap-samples', async (req, res, next) => {
//   try {
//     // 1) Sample non-admin user
//     const sampleUser = await User.findOneAndUpdate(
//       { email: 'sample.user@xerago.com' },
//       {
//         name: 'Sample User',
//         email: 'sample.user@xerago.com',
//         password: 'TempPass@123',
//         department: 'Marketing',
//         isEmailVerified: true
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     // 2) Sample event
//     const sampleEvent = await Event.findOneAndUpdate(
//       { title: 'Sample Event' },
//       {
//         title: 'Sample Event',
//         description: 'Kickoff demo event',
//         organizer: sampleUser._id,
//         category: 'other',
//         type: 'offline',
//         location: { name: 'HQ' },
//         startDate: new Date(Date.now() + 24*60*60*1000),
//         endDate: new Date(Date.now() + 26*60*60*1000),
//         capacity: 50,
//         tags: ['Demo'],
//         status: 'published'
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     // 3) Sample article
//     const sampleArticle = await Article.findOneAndUpdate(
//       { title: 'Sample Article' },
//       {
//         title: 'Sample Article',
//         content: 'This is a sample knowledge article body.',
//         author: sampleUser._id,
//         category: 'technology',
//         tags: ['Sample','Demo'],
//         status: 'published',
//         publishedAt: new Date()
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     // 4) Sample forum post
//     const samplePost = await Forum.findOneAndUpdate(
//       { title: 'Sample Discussion' },
//       {
//         title: 'Sample Discussion',
//         content: 'Welcome to the forum! This is a starter thread.',
//         author: sampleUser._id,
//         category: 'general',
//         tags: ['welcome']
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     // 5) Sample achievement
//     const sampleAchievement = await Achievement.findOneAndUpdate(
//       { name: 'First Login' },
//       {
//         name: 'First Login',
//         description: 'Logged in to the portal for the first time',
//         category: 'milestone',
//         type: 'badge',
//         icon: '🏁',
//         color: '#10B981',
//         rarity: 'common',
//         points: 5,
//         criteria: { type: 'days_active', value: 1, timeframe: 'all_time' }
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     res.json({
//       success: true,
//       data: {
//         user: sampleUser,
//         event: sampleEvent,
//         article: sampleArticle,
//         post: samplePost,
//         achievement: sampleAchievement
//       }
//     });
//   } catch (err) {
//     next(err);
//   }
// });

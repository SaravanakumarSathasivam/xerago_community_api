const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate, forumSchemas } = require('../middleware/validation');
const { searchLimiter, createUserLimiter } = require('../middleware/rateLimiter');
const { uploadForumAttachments } = require('../middleware/upload');
const Forum = require('../models/Forum');

const router = express.Router();

// Map Forum model -> frontend post shape used in UI
const mapPostToFrontend = (postDoc, currentUserId) => {
  return {
    id: postDoc._id.toString(),
    title: postDoc.title,
    content: postDoc.content,
    author: {
      name: postDoc.author?.name || 'Unknown',
      department: postDoc.author?.department || 'General',
      avatar: postDoc.author?.avatar,
    },
    category: postDoc.category || 'general',
    createdAt: postDoc.createdAt?.toISOString(),
    likes: postDoc.likes?.length || 0,
    replies: postDoc.replies?.length || 0,
    tags: postDoc.tags || [],
    isLiked: currentUserId ? postDoc.likes?.some((u) => u.toString() === currentUserId.toString()) : false,
  };
};

// Get forum posts (public)
router.get('/posts', searchLimiter, optionalAuth, validate(forumSchemas.getPosts, 'query'), async (req, res, next) => {
  try {
    const posts = await Forum.find({}).populate('author', 'name email avatar department').sort({ createdAt: -1 });
    const mapped = posts.map((p) => mapPostToFrontend(p, req.user?._id));
    res.json({ success: true, data: { posts: mapped } });
  } catch (err) {
    next(err);
  }
});

// Get specific post (public)
router.get('/posts/:id', optionalAuth, async (req, res, next) => {
  try {
    const post = await Forum.findById(req.params.id).populate('author', 'name email avatar department');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: { post: mapPostToFrontend(post, req.user?._id) } });
  } catch (err) {
    next(err);
  }
});

// All routes below require authentication
router.use(authenticate);

// Create forum post
router.post('/posts', createUserLimiter(60 * 1000, 10, 'Too many posts, please try again later.'), uploadForumAttachments, validate(forumSchemas.createPost), async (req, res, next) => {
  try {
    const { title, content, category, tags } = req.body;
    const normalizedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

    const post = await Forum.create({
      title,
      content,
      author: req.user._id,
      category: category || 'general',
      tags: normalizedTags,
      likes: [],
      replies: [],
    });

    const created = await Forum.findById(post._id).populate('author', 'name email avatar department');
    res.status(201).json({ success: true, data: { post: mapPostToFrontend(created, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Update forum post
router.put('/posts/:id', validate(forumSchemas.updatePost), (req, res) => {
  // Implementation for updating forum post
  res.json({
    success: true,
    message: 'Post updated successfully'
  });
});

// Delete forum post
router.delete('/posts/:id', (req, res) => {
  // Implementation for deleting forum post
  res.json({
    success: true,
    message: 'Post deleted successfully'
  });
});

// Add reply to post
router.post('/posts/:id/replies', createUserLimiter(60 * 1000, 20, 'Too many replies, please try again later.'), validate(forumSchemas.addReply), async (req, res, next) => {
  try {
    const { content } = req.body;
    const post = await Forum.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    post.replies.push({ author: req.user._id, content, createdAt: new Date(), likes: [] });
    await post.save();
    const populated = await Forum.findById(req.params.id).populate('author', 'name email avatar department');
    res.json({ success: true, data: { post: mapPostToFrontend(populated, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Like/unlike post
router.post('/posts/:id/like', createUserLimiter(60 * 1000, 30, 'Too many like actions, please try again later.'), async (req, res, next) => {
  try {
    const post = await Forum.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    const idx = post.likes.findIndex((u) => u.toString() === req.user._id.toString());
    if (idx >= 0) post.likes.splice(idx, 1);
    else post.likes.push(req.user._id);
    await post.save();
    const populated = await Forum.findById(req.params.id).populate('author', 'name email avatar department');
    res.json({ success: true, data: { post: mapPostToFrontend(populated, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

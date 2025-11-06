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
      id: postDoc.author?._id?.toString(),
      name: postDoc.author?.name || 'Unknown',
      department: postDoc.author?.department || 'General',
      avatar: postDoc.author?.avatar,
    },
    category: postDoc.category || 'general',
    createdAt: postDoc.createdAt?.toISOString(),
    updatedAt: postDoc.updatedAt?.toISOString(),
    likes: postDoc.likes?.length || 0,
    replies: postDoc.replies?.length || 0,
    tags: postDoc.tags || [],
    attachments: postDoc.attachments || [],
    views: postDoc.views || 0,
    isLiked: currentUserId ? postDoc.likes?.some((u) => u.toString() === currentUserId.toString()) : false,
    isEdited: postDoc.isEdited || false,
    editedAt: postDoc.editedAt?.toISOString(),
    approvalStatus: postDoc.approvalStatus || 'pending',
  };
};

// Map reply to frontend shape
const mapReplyToFrontend = (replyDoc, currentUserId) => {
  return {
    id: replyDoc._id.toString(),
    content: replyDoc.content,
    author: {
      id: replyDoc.author?._id?.toString(),
      name: replyDoc.author?.name || 'Unknown',
      department: replyDoc.author?.department || 'General',
      avatar: replyDoc.author?.avatar,
    },
    createdAt: replyDoc.createdAt?.toISOString(),
    likes: replyDoc.likes?.length || 0,
    isLiked: currentUserId ? replyDoc.likes?.some((u) => u.toString() === currentUserId.toString()) : false,
    isEdited: replyDoc.isEdited || false,
    isSolution: replyDoc.isSolution || false,
  };
};

// Get forum posts (public)
router.get('/posts', searchLimiter, optionalAuth, validate(forumSchemas.getPosts, 'query'), async (req, res, next) => {
  try {
    const { sort, filter, order = 'desc', category, search } = req.query;

    const isAdminOrMod = req.user?.role === 'admin' || req.user?.role === 'moderator';

    const match = {};
    if (!isAdminOrMod) match.approvalStatus = 'approved';
    if (category && category !== 'all') match.category = category;
    if (search) {
      match.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const normalized = String(sort || filter || '').toLowerCase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: match },
    ];

    // Apply filter behavior based on sort option
    switch (normalized) {
      case 'recent':
        pipeline.push({ $match: { createdAt: { $gte: sevenDaysAgo } } });
        break;
      case 'updated':
        pipeline.push({ $match: { updatedAt: { $gte: sevenDaysAgo } } });
        break;
      case 'popular':
        pipeline.push({ $match: { likesCount: { $gt: 0 } } });
        break;
      case 'discussed':
        pipeline.push({ $match: { $expr: { $gt: [ { $size: { $ifNull: ['$replies', []] } }, 0 ] } } });
        break;
      case 'unanswered':
        // Use direct array size check to be robust regardless of $addFields
        pipeline.push({ $match: { $expr: { $eq: [ { $size: { $ifNull: ['$replies', []] } }, 0 ] } } });
        break;
      case 'views':
        pipeline.push({ $match: { views: { $gt: 0 } } });
        break;
      default:
        break;
    }

    // Add computed counts after filter for mapping convenience where needed
    pipeline.push({ $addFields: { likesCount: { $size: { $ifNull: ['$likes', []] } }, repliesCount: { $size: { $ifNull: ['$replies', []] } } } });

    // Default ordering after filter
    pipeline.push({ $sort: { createdAt: -1 } });

    // Debug: confirm received params and pipeline filter mode
    if (process.env.NODE_ENV !== 'production') {
      try { console.log('[forums:list] query=', req.query, 'pipelineStages=', pipeline.length); } catch {}
    }
    const posts = await Forum.aggregate(pipeline);
    // Need author populated → refetch with populate by ids order preserved
    const ids = posts.map((p) => p._id);
    const docs = await Forum.find({ _id: { $in: ids } })
      .populate('author', 'name email avatar department');
    // preserve order per ids
    const docById = new Map(docs.map((d) => [String(d._id), d]));
    const ordered = ids.map((id) => docById.get(String(id))).filter(Boolean);
    const mapped = ordered.map((p) => mapPostToFrontend(p, req.user?._id));
    res.json({ success: true, data: { posts: mapped } });
  } catch (err) {
    next(err);
  }
});

// Get specific post (public) with replies
router.get('/posts/:id', optionalAuth, async (req, res, next) => {
  try {
    const post = await Forum.findById(req.params.id)
      .populate('author', 'name email avatar department')
      .populate('replies.author', 'name email avatar department');
    
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    
    // Check approval status for non-admin users
    if (req.user?.role !== 'admin' && req.user?.role !== 'moderator' && post.approvalStatus !== 'approved') {
      // Only show to author
      if (post.author._id.toString() !== req.user?._id?.toString()) {
        return res.status(403).json({ success: false, message: 'Post not approved yet' });
      }
    }
    
    // Increment views
    await post.incrementViews();
    
    const mappedPost = mapPostToFrontend(post, req.user?._id);
    const mappedReplies = post.replies.map((r) => mapReplyToFrontend(r, req.user?._id));
    
    res.json({ 
      success: true, 
      data: { 
        post: { ...mappedPost, replies: mappedReplies }
      } 
    });
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
    
    // Normalize tags - handle array, comma-separated string, or JSON stringified array
    let normalizedTags = [];
    if (Array.isArray(tags)) {
      normalizedTags = tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string') {
      // Try to parse as JSON first (handles FormData JSON.stringify)
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) {
          normalizedTags = parsed.map((t) => String(t).trim()).filter(Boolean);
        } else {
          // If not an array after parsing, treat as comma-separated
          normalizedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      } catch (e) {
        // Not JSON, treat as comma-separated string
        normalizedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    // Auto-approve if admin/moderator, otherwise pending
    const approvalStatus = (req.user.role === 'admin' || req.user.role === 'moderator') ? 'approved' : 'pending';

    // Process attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: file.url || `/uploads/${file.path.replace(/\\/g, '/').split('uploads/')[1]}`
    })) : [];
    
    const post = await Forum.create({
      title,
      content,
      author: req.user._id,
      category: category || 'general',
      tags: normalizedTags,
      attachments,
      likes: [],
      replies: [],
      approvalStatus,
      ...(approvalStatus === 'approved' ? { approvedBy: req.user._id, approvedAt: new Date() } : {})
    });

    const created = await Forum.findById(post._id).populate('author', 'name email avatar department');
    res.status(201).json({ success: true, data: { post: mapPostToFrontend(created, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Update forum post
router.put('/posts/:id', uploadForumAttachments, validate(forumSchemas.updatePost), async (req, res, next) => {
  try {
    const post = await Forum.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    
    // Check ownership or admin/mod role
    if (post.author.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this post' });
    }

    const { title, content, category, tags } = req.body;
    
    // Normalize tags - handle array, comma-separated string, or JSON stringified array
    let normalizedTags = [];
    if (Array.isArray(tags)) {
      normalizedTags = tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string') {
      // Try to parse as JSON first (handles FormData JSON.stringify)
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) {
          normalizedTags = parsed.map((t) => String(t).trim()).filter(Boolean);
        } else {
          // If not an array after parsing, treat as comma-separated
          normalizedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      } catch (e) {
        // Not JSON, treat as comma-separated string
        normalizedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    // Process new attachments
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: file.url || `/uploads/${file.path.replace(/\\/g, '/').split('uploads/')[1]}`
      }));
      
      // Merge with existing attachments or replace based on requirements
      post.attachments = [...(post.attachments || []), ...newAttachments];
    }

    // Update fields
    if (title) post.title = title;
    if (content) post.content = content;
    if (category) post.category = category;
    if (normalizedTags.length > 0) post.tags = normalizedTags;
    post.isEdited = true;
    post.editedAt = new Date();

    await post.save();
    const updated = await Forum.findById(post._id).populate('author', 'name email avatar department');
    res.json({ success: true, data: { post: mapPostToFrontend(updated, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Delete forum post
router.delete('/posts/:id', async (req, res, next) => {
  try {
    const post = await Forum.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    
    // Check ownership or admin/mod role
    if (post.author.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    await Forum.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Add reply to post
router.post('/posts/:id/replies', createUserLimiter(60 * 1000, 20, 'Too many replies, please try again later.'), validate(forumSchemas.addReply), async (req, res, next) => {
  try {
    const { content } = req.body;
    const post = await Forum.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    
    post.replies.push({ author: req.user._id, content, createdAt: new Date(), likes: [] });
    await post.save();
    
    const populated = await Forum.findById(req.params.id)
      .populate('author', 'name email avatar department')
      .populate('replies.author', 'name email avatar department');
    
    const mappedPost = mapPostToFrontend(populated, req.user._id);
    const mappedReplies = populated.replies.map((r) => mapReplyToFrontend(r, req.user._id));
    
    res.json({ 
      success: true, 
      data: { 
        post: { ...mappedPost, replies: mappedReplies }
      } 
    });
  } catch (err) {
    next(err);
  }
});

// Like/unlike reply
router.post('/posts/:id/replies/:replyId/like', createUserLimiter(60 * 1000, 30, 'Too many like actions, please try again later.'), async (req, res, next) => {
  try {
    const post = await Forum.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    
    const reply = post.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });
    
    const idx = reply.likes.findIndex((u) => u.toString() === req.user._id.toString());
    if (idx >= 0) reply.likes.splice(idx, 1);
    else reply.likes.push(req.user._id);
    
    await post.save();
    
    const populated = await Forum.findById(req.params.id)
      .populate('author', 'name email avatar department')
      .populate('replies.author', 'name email avatar department');
    
    const mappedPost = mapPostToFrontend(populated, req.user._id);
    const mappedReplies = populated.replies.map((r) => mapReplyToFrontend(r, req.user._id));
    
    res.json({ 
      success: true, 
      data: { 
        post: { ...mappedPost, replies: mappedReplies }
      } 
    });
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

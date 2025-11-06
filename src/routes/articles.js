const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate, articleSchemas, frontendSchemas } = require('../middleware/validation');
const { searchLimiter, createUserLimiter } = require('../middleware/rateLimiter');
const { uploadArticleImages } = require('../middleware/upload');
const Article = require('../models/Article');

const router = express.Router();

// Map Article model -> frontend article shape used in UI
const mapArticleToFrontend = (doc, currentUserId) => {
  const isLiked = currentUserId ? doc.likes?.some((u) => u.toString() === currentUserId.toString()) : false;
  const isBookmarked = currentUserId ? doc.bookmarks?.some((u) => u.toString() === currentUserId.toString()) : false;
  return {
    id: doc._id.toString(),
    title: doc.title,
    content: doc.content,
    author: {
      name: doc.author?.name || 'Unknown',
      department: doc.author?.department || 'General',
      avatar: doc.author?.avatar,
    },
    category: toFrontendCategory(doc.category),
    type: toFrontendType(doc),
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
    views: doc.views || 0,
    likes: doc.likes?.length || 0,
    bookmarks: doc.bookmarks?.length || 0,
    tags: doc.tags || [],
    readTime: doc.readingTime || 0,
    difficulty: 'Intermediate',
    isBookmarked,
    isLiked,
    attachments: (doc.attachments || []).map((f) => ({
      filename: f.filename,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      url: f.url,
    })),
  };
};

const toFrontendCategory = (backendCategory) => {
  // Map backend enum to frontend labels where possible
  const map = {
    marketing: 'Marketing',
    analytics: 'Analytics',
    technology: 'Technology',
    ai: 'AI & Innovation',
    business: 'Business',
    'best-practices': 'Technology',
    tools: 'Technology',
    tutorial: 'Technology',
    news: 'Technology',
    'case-study': 'Technology',
  };
  return map[backendCategory] || 'Technology';
};

const toFrontendType = (doc) => {
  // Derive a type similar to UI (Guide/Tutorial/Checklist/Comparison)
  if (doc.tags?.some((t) => /tutorial/i.test(t))) return 'Tutorial';
  if (doc.tags?.some((t) => /checklist/i.test(t))) return 'Checklist';
  if (doc.tags?.some((t) => /comparison|vs\b/i.test(t))) return 'Comparison';
  return 'Guide';
};

// Get articles (public) - only approved/published
router.get('/', searchLimiter, optionalAuth, validate(articleSchemas.getArticles, 'query'), async (req, res, next) => {
  try {
    const { sort, order = 'desc', category, search } = req.query;
    const match = { status: 'published' };
    if (category && category !== 'all') match.category = category;
    if (search) {
      match.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const normalized = String(sort || '').toLowerCase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: match },
      { $addFields: {
          likesCount: { $size: { $ifNull: ['$likes', []] } },
          bookmarksCount: { $size: { $ifNull: ['$bookmarks', []] } },
        }
      },
    ];

    switch (normalized) {
      case 'recent':
        pipeline.push({ $match: { publishedAt: { $gte: sevenDaysAgo } } });
        break;
      case 'updated':
        pipeline.push({ $match: { updatedAt: { $gte: sevenDaysAgo } } });
        break;
      case 'views':
        pipeline.push({ $match: { views: { $gt: 0 } } });
        break;
      case 'likes':
        pipeline.push({ $match: { likesCount: { $gt: 0 } } });
        break;
      case 'bookmarks':
        pipeline.push({ $match: { bookmarksCount: { $gt: 0 } } });
        break;
      default:
        break;
    }

    pipeline.push({ $sort: { publishedAt: -1 } });

    const rows = await Article.aggregate(pipeline);
    const ids = rows.map((r) => r._id);
    const docs = await Article.find({ _id: { $in: ids } }).populate('author', 'name email avatar department');
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
    const mapped = ordered.map((a) => mapArticleToFrontend(a, req.user?._id));
    res.json({ success: true, data: { articles: mapped } });
  } catch (err) {
    next(err);
  }
});

// Get specific article (public)
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id).populate('author', 'name email avatar department');
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    res.json({ success: true, data: { article: mapArticleToFrontend(article, req.user?._id) } });
  } catch (err) {
    next(err);
  }
});

// All routes below require authentication
router.use(authenticate);

// Create article (requires admin approval before publishing)
router.post('/', uploadArticleImages, validate(frontendSchemas.createArticle), async (req, res, next) => {
  try {
    const { title, content, category, tags } = req.body;
    // Normalize tags from array / comma string / JSON string
    let normalizedTags = [];
    if (Array.isArray(tags)) normalizedTags = tags.map((t) => String(t).trim()).filter(Boolean);
    else if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags);
        normalizedTags = Array.isArray(parsed) ? parsed.map((t) => String(t).trim()).filter(Boolean) : tags.split(',').map((t) => t.trim()).filter(Boolean);
      } catch {
        normalizedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    // Map frontend category label to backend enum best-effort
    const categoryMap = {
      Marketing: 'marketing',
      Analytics: 'analytics',
      Technology: 'technology',
      'AI & Innovation': 'ai',
    };
    const backendCategory = categoryMap[category] || 'technology';

    // Map uploaded files to attachments
    const attachments = (req.files || []).map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: file.url || `/uploads/${file.path.replace(/\\/g, '/').split('uploads/')[1]}`,
    }));

    const article = await Article.create({
      title,
      content,
      author: req.user._id,
      category: backendCategory,
      tags: normalizedTags,
      status: 'draft', // pending admin approval → admin will set to 'published'
      featured: false,
      attachments,
    });

    const created = await Article.findById(article._id).populate('author', 'name email avatar department');
    res.status(201).json({ success: true, data: { article: mapArticleToFrontend(created, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Update article (only before approval; once published cannot be edited by author)
router.put('/:id', validate(frontendSchemas.updateArticle), async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });

    // Only owner or admin/mod can edit
    const isOwner = article.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized to edit' });

    // If published and not admin, block edits
    if (article.status === 'published' && !isAdmin) {
      return res.status(400).json({ success: false, message: 'Approved articles cannot be edited' });
    }

    const { title, content, category, tags } = req.body;
    if (title !== undefined) article.title = title;
    if (content !== undefined) article.content = content;
    if (category !== undefined) article.category = category;
    if (tags !== undefined) {
      let normalized = [];
      if (Array.isArray(tags)) normalized = tags.map((t) => String(t).trim()).filter(Boolean);
      else if (typeof tags === 'string') {
        try {
          const parsed = JSON.parse(tags);
          normalized = Array.isArray(parsed) ? parsed.map((t) => String(t).trim()).filter(Boolean) : tags.split(',').map((t) => t.trim()).filter(Boolean);
        } catch {
          normalized = tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
      article.tags = normalized;
    }

    await article.save();
    const updated = await Article.findById(article._id).populate('author', 'name email avatar department');
    res.json({ success: true, data: { article: mapArticleToFrontend(updated, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Delete article (admin only)
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Only admin can delete articles' });
    const deleted = await Article.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Article not found' });
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (err) { next(err); }
});

// Like/unlike article
router.post('/:id/like', createUserLimiter(60 * 1000, 30, 'Too many like actions, please try again later.'), async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    await article.toggleLike(req.user._id);
    const populated = await Article.findById(req.params.id).populate('author', 'name email avatar department');
    res.json({ success: true, data: { article: mapArticleToFrontend(populated, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Bookmark/unbookmark article
router.post('/:id/bookmark', createUserLimiter(60 * 1000, 30, 'Too many bookmark actions, please try again later.'), async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    await article.toggleBookmark(req.user._id);
    const populated = await Article.findById(req.params.id).populate('author', 'name email avatar department');
    res.json({ success: true, data: { article: mapArticleToFrontend(populated, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Add comment to article
router.post('/:id/comments', createUserLimiter(60 * 1000, 10, 'Too many comments, please try again later.'), validate(articleSchemas.addComment), async (req, res, next) => {
  try {
    const { content } = req.body;
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    await article.addComment({ author: req.user._id, content });
    const populated = await Article.findById(req.params.id).populate('author', 'name email avatar department');
    res.json({ success: true, data: { article: mapArticleToFrontend(populated, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

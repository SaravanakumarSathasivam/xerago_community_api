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

// Get articles (public)
router.get('/', searchLimiter, optionalAuth, validate(articleSchemas.getArticles, 'query'), async (req, res, next) => {
  try {
    const articles = await Article.find({ status: 'published' })
      .populate('author', 'name email avatar department')
      .sort({ publishedAt: -1 });
    const mapped = articles.map((a) => mapArticleToFrontend(a, req.user?._id));
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

// Create article
router.post('/', uploadArticleImages, validate(frontendSchemas.createArticle), async (req, res, next) => {
  try {
    const { title, content, category, tags } = req.body;
    const normalizedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

    // Map frontend category label to backend enum best-effort
    const categoryMap = {
      Marketing: 'marketing',
      Analytics: 'analytics',
      Technology: 'technology',
      'AI & Innovation': 'ai',
    };
    const backendCategory = categoryMap[category] || 'technology';

    const article = await Article.create({
      title,
      content,
      author: req.user._id,
      category: backendCategory,
      tags: normalizedTags,
      status: 'published',
      featured: false,
    });

    const created = await Article.findById(article._id).populate('author', 'name email avatar department');
    res.status(201).json({ success: true, data: { article: mapArticleToFrontend(created, req.user._id) } });
  } catch (err) {
    next(err);
  }
});

// Update article
router.put('/:id', validate(frontendSchemas.updateArticle), (req, res) => {
  // Implementation for updating article
  res.json({
    success: true,
    message: 'Article updated successfully'
  });
});

// Delete article
router.delete('/:id', (req, res) => {
  // Implementation for deleting article
  res.json({
    success: true,
    message: 'Article deleted successfully'
  });
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

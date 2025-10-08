const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimiter');
const Article = require('../models/Article');
const Forum = require('../models/Forum');
const Event = require('../models/Event');

const router = express.Router();

// Normalize different entities to a common feed item shape
function mapArticleToFeedItem(doc) {
  return {
    id: doc._id.toString(),
    type: 'article',
    title: doc.title,
    description: doc.excerpt || doc.content?.slice(0, 200) || '',
    author: {
      name: doc.author?.name || 'Unknown',
      department: doc.author?.department || 'General',
      avatar: doc.author?.avatar || null,
    },
    timestamp: (doc.publishedAt || doc.createdAt || new Date()).toISOString(),
    engagement: {
      likes: (doc.likes || []).length,
      comments: (doc.comments || []).length,
    },
    meta: {
      category: doc.category,
    },
  };
}

function mapForumToFeedItem(doc) {
  return {
    id: doc._id.toString(),
    type: 'discussion',
    title: doc.title,
    description: doc.content?.slice(0, 200) || '',
    author: {
      name: doc.author?.name || 'Unknown',
      department: doc.author?.department || 'General',
      avatar: doc.author?.avatar || null,
    },
    timestamp: (doc.createdAt || new Date()).toISOString(),
    engagement: {
      likes: (doc.likes || []).length,
      replies: (doc.replies || []).length,
    },
    meta: {
      category: doc.category,
    },
  };
}

function mapEventToFeedItem(doc) {
  return {
    id: doc._id.toString(),
    type: 'event',
    title: doc.title,
    description: doc.description?.slice(0, 200) || '',
    author: {
      name: doc.organizer?.name || 'Unknown',
      department: doc.organizer?.department || 'General',
      avatar: doc.organizer?.avatar || null,
    },
    timestamp: (doc.createdAt || doc.startDate || new Date()).toISOString(),
    engagement: {
      attendees: (doc.attendees || []).length,
      interested: 0,
    },
    meta: {
      date: doc.startDate,
      endDate: doc.endDate,
      location: doc.location?.name || 'TBD',
    },
  };
}

// GET /api/feed?page=1&limit=5
router.get('/', searchLimiter, optionalAuth, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '5', 10), 1);
    const skip = (page - 1) * limit;

    // Pull latest across entities, then merge and paginate in-memory
    // To keep queries efficient, fetch up to first 50 recent per type then merge
    const [articles, forums, events] = await Promise.all([
      Article.find({ status: 'published' })
        .populate('author', 'name email avatar department')
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(50),
      Forum.find({})
        .populate('author', 'name email avatar department')
        .sort({ createdAt: -1 })
        .limit(50),
      Event.find({})
        .populate('organizer', 'name email avatar department')
        .sort({ createdAt: -1 })
        .limit(50),
    ]);

    const feed = [
      ...articles.map(mapArticleToFeedItem),
      ...forums.map(mapForumToFeedItem),
      ...events.map(mapEventToFeedItem),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const total = feed.length;
    const paged = feed.slice(skip, skip + limit);

    res.json({
      success: true,
      data: { items: paged, page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;



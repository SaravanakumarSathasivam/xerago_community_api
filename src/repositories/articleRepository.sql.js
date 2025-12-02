const prisma = require('../db/prisma');

const mapSqlArticleToFrontend = (row, currentUserId) => {
  const likesCount = row.likes?.length || 0;
  const bookmarksCount = row.bookmarks?.length || 0;
  const isLiked = !!row.likes?.find((l) => l.userId === String(currentUserId));
  const isBookmarked = !!row.bookmarks?.find((b) => b.userId === String(currentUserId));

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    status: row.status.toLowerCase(),
    featured: row.featured,
    views: row.views,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    tags: row.tags.map((t) => t.value),
    attachments: row.attachments.map((a) => ({
      filename: a.filename,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      url: a.url,
    })),
    likes: likesCount,
    bookmarks: bookmarksCount,
    isLiked,
    isBookmarked,
    author: { id: row.authorId },
  };
};

const buildWhere = ({ category, search, status, isAdmin }) => {
  const where = {};

  if (!isAdmin) {
    where.status = 'PUBLISHED';
  } else if (status && status !== 'all') {
    where.status = status.toUpperCase();
  }

  if (category && category !== 'all') {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

const buildOrderBy = (sort, order) => {
  const dir = order === 'asc' ? 'asc' : 'desc';
  switch ((sort || '').toLowerCase()) {
    case 'recent':
      return { publishedAt: dir };
    case 'updated':
      return { updatedAt: dir };
    case 'popular':
      return { views: dir };
    case 'likes':
      return { likes: { _count: dir } };
    case 'bookmarks':
      return { bookmarks: { _count: dir } };
    default:
      return { createdAt: 'desc' };
  }
};

module.exports = {
  async list({ sort, order, category, search, status, currentUser }) {
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
    const where = buildWhere({ category, search, status, isAdmin });
    const orderBy = buildOrderBy(sort, order);

    const rows = await prisma.article.findMany({
      where,
      orderBy,
      include: {
        tags: true,
        attachments: true,
        likes: true,
        bookmarks: true,
      },
    });

    const mapped = rows.map((r) => mapSqlArticleToFrontend(r, currentUser?._id));
    const published = mapped.filter((a) => a.status === 'published');
    const pending = mapped.filter((a) => a.status !== 'published');

    return { articles: mapped, published, pending };
  },

  async getById(id, currentUser) {
    const row = await prisma.article.findUnique({
      where: { id },
      include: {
        tags: true,
        attachments: true,
        likes: true,
        bookmarks: true,
      },
    });
    if (!row) return null;
    return mapSqlArticleToFrontend(row, currentUser?._id);
  },

  async create({ data, currentUser, attachments }) {
    const { title, content, category, tags = [] } = data;

    const created = await prisma.article.create({
      data: {
        title,
        content,
        category,
        authorId: String(currentUser._id),
        status: 'DRAFT',
        featured: false,
        tags: {
          create: tags.map((t) => ({ value: t })),
        },
        attachments: {
          create: attachments.map((f) => ({
            filename: f.filename,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
            url: f.url,
          })),
        },
      },
      include: {
        tags: true,
        attachments: true,
        likes: true,
        bookmarks: true,
      },
    });

    return mapSqlArticleToFrontend(created, currentUser._id);
  },

  async update(id, { title, content, category, tags }, currentUser) {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;

    const updated = await prisma.article.update({
      where: { id },
      data: {
        ...updates,
        ...(tags !== undefined && {
          tags: {
            deleteMany: {},
            create: tags.map((t) => ({ value: t })),
          },
        }),
      },
      include: {
        tags: true,
        attachments: true,
        likes: true,
        bookmarks: true,
      },
    });

    return mapSqlArticleToFrontend(updated, currentUser._id);
  },

  async delete(id) {
    await prisma.article.delete({ where: { id } });
  },

  async toggleLike(id, userId) {
    const key = { articleId: id, userId: String(userId) };
    const existing = await prisma.articleLike.findUnique({
      where: { articleId_userId: key },
    });

    if (existing) {
      await prisma.articleLike.delete({ where: { articleId_userId: key } });
    } else {
      await prisma.articleLike.create({ data: key });
    }

    return this.getById(id, { _id: userId });
  },

  async toggleBookmark(id, userId) {
    const key = { articleId: id, userId: String(userId) };
    const existing = await prisma.articleBookmark.findUnique({
      where: { articleId_userId: key },
    });

    if (existing) {
      await prisma.articleBookmark.delete({ where: { articleId_userId: key } });
    } else {
      await prisma.articleBookmark.create({ data: key });
    }

    return this.getById(id, { _id: userId });
  },
};



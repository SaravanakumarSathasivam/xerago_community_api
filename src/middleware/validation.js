const Joi = require("joi");
const { formatValidationErrors } = require("./errorHandler");

/**
 * Validation middleware factory
 */
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const formattedErrors = formatValidationErrors(error.details);

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formattedErrors,
      });
    }

    // Replace the original data with validated and sanitized data
    req[property] = value;
    next();
  };
};

/**
 * Common validation schemas
 */
const commonSchemas = {
  // ObjectId validation
  objectId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),

  // Email validation
  email: Joi.string().email().lowercase().trim().required(),

  // Password validation
  password: Joi.string().min(6).max(128).required(),

  // Name validation
  name: Joi.string().min(2).max(50).trim().required(),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid("asc", "desc").default("desc"),
    sortBy: Joi.string().default("createdAt"),
  }),

  // Search validation
  search: Joi.object({
    q: Joi.string().min(1).max(100).trim(),
    category: Joi.string().trim(),
    tags: Joi.array().items(Joi.string().trim()),
    dateFrom: Joi.date(),
    dateTo: Joi.date(),
  }),
};

/**
 * User validation schemas
 */
const userSchemas = {
  register: Joi.object({
    name: commonSchemas.name,
    email: commonSchemas.email,
    password: commonSchemas.password,
    department: Joi.string().max(50).trim().optional(),
    bio: Joi.string().max(500).trim().optional(),
  }),

  login: Joi.object({
    email: commonSchemas.email,
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(50).trim().optional(),
    department: Joi.string().max(50).trim().optional(),
    bio: Joi.string().max(500).trim().optional(),
    avatar: Joi.string().uri().optional(),
    socialLinks: Joi.object({
      linkedin: Joi.string().uri().optional(),
      twitter: Joi.string().uri().optional(),
      github: Joi.string().uri().optional(),
    }).optional(),
    preferences: Joi.object({
      notifications: Joi.object({
        email: Joi.boolean().optional(),
        push: Joi.boolean().optional(),
        forum: Joi.boolean().optional(),
        events: Joi.boolean().optional(),
      }).optional(),
      theme: Joi.string().valid("light", "dark", "auto").optional(),
    }).optional(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required(),
  }),

  forgotPassword: Joi.object({
    email: commonSchemas.email,
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
  }),

  verifyEmail: Joi.object({
    token: Joi.string().required(),
  }),

  resendVerification: Joi.object({
    email: commonSchemas.email,
  }),

  verifyOtp: Joi.object({
    email: commonSchemas.email,
    code: Joi.string()
      .length(6)
      .pattern(/^[0-9]{6}$/)
      .required(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

/**
 * Forum validation schemas
 */
const forumSchemas = {
  createPost: Joi.object({
    title: Joi.string().min(5).max(200).trim().required(),
    content: Joi.string().min(10).max(5000).trim().required(),
    category: Joi.string()
      .valid(
        "general",
        "tech",
        "marketing",
        "analytics",
        "ai",
        "announcements",
        "support",
        "feedback"
      )
      .required(),
    // tags: Joi.array().items(
    //   Joi.string().min(1).max(30).trim()
    // ).max(10).optional(),

    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(30).trim()).max(10),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
          } catch (err) {
            // not JSON, treat as comma-separated
            return value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
          }
          return helpers.error("any.invalid");
        }, "Flexible tag parser")
      )
      .optional(),
    priority: Joi.string()
      .valid("low", "medium", "high", "urgent")
      .default("medium"),
  }),

  updatePost: Joi.object({
    title: Joi.string().min(5).max(200).trim().optional(),
    content: Joi.string().min(10).max(5000).trim().optional(),
    category: Joi.string()
      .valid(
        "general",
        "tech",
        "marketing",
        "analytics",
        "ai",
        "announcements",
        "support",
        "feedback"
      )
      .optional(),
    // tags: Joi.array().items(
    //   Joi.string().min(1).max(30).trim()
    // ).max(10).optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(30).trim()).max(10),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
          } catch (err) {
            // not JSON, treat as comma-separated
            return value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
          }
          return helpers.error("any.invalid");
        }, "Flexible tag parser")
      )
      .optional(),
    priority: Joi.string().valid("low", "medium", "high", "urgent").optional(),
    status: Joi.string()
      .valid("active", "closed", "archived", "pinned")
      .optional(),
  }),

  addReply: Joi.object({
    content: Joi.string().min(5).max(2000).trim().required(),
  }),

  updateReply: Joi.object({
    content: Joi.string().min(5).max(2000).trim().required(),
  }),

  getPosts: Joi.object({
    ...commonSchemas.pagination.describe(),
    search: Joi.string().max(200).trim().optional(),
    sort: Joi.string()
      .valid('recent', 'updated', 'popular', 'discussed', 'unanswered', 'views')
      .optional(),
    order: Joi.string().valid('asc', 'desc').optional(),
    category: Joi.string()
      .valid(
        "general",
        "tech",
        "marketing",
        "analytics",
        "ai",
        "announcements",
        "support",
        "feedback"
      )
      .optional(),
    status: Joi.string()
      .valid("active", "closed", "archived", "pinned")
      .optional(),
    author: commonSchemas.objectId.optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
  }),
};

/**
 * Article validation schemas
 */
const articleSchemas = {
  createArticle: Joi.object({
    title: Joi.string().min(5).max(200).trim().required(),
    content: Joi.string().min(50).max(10000).trim().required(),
    excerpt: Joi.string().max(500).trim().optional(),
    category: Joi.string()
      .valid(
        "technology",
        "marketing",
        "analytics",
        "ai",
        "business",
        "tutorial",
        "news",
        "case-study",
        "best-practices",
        "tools"
      )
      .required(),
    tags: Joi.array()
      .items(Joi.string().min(1).max(30).trim())
      .max(10)
      .optional(),
    featured: Joi.boolean().default(false),
    seo: Joi.object({
      metaTitle: Joi.string().max(60).trim().optional(),
      metaDescription: Joi.string().max(160).trim().optional(),
      keywords: Joi.array().items(Joi.string().trim()).max(10).optional(),
    }).optional(),
  }),

  updateArticle: Joi.object({
    title: Joi.string().min(5).max(200).trim().optional(),
    content: Joi.string().min(50).max(10000).trim().optional(),
    excerpt: Joi.string().max(500).trim().optional(),
    category: Joi.string()
      .valid(
        "technology",
        "marketing",
        "analytics",
        "ai",
        "business",
        "tutorial",
        "news",
        "case-study",
        "best-practices",
        "tools"
      )
      .optional(),
    tags: Joi.array()
      .items(Joi.string().min(1).max(30).trim())
      .max(10)
      .optional(),
    featured: Joi.boolean().optional(),
    status: Joi.string().valid("draft", "published", "archived").optional(),
    seo: Joi.object({
      metaTitle: Joi.string().max(60).trim().optional(),
      metaDescription: Joi.string().max(160).trim().optional(),
      keywords: Joi.array().items(Joi.string().trim()).max(10).optional(),
    }).optional(),
  }),

  addComment: Joi.object({
    content: Joi.string().min(5).max(1000).trim().required(),
  }),

  getArticles: Joi.object({
    ...commonSchemas.pagination.describe(),
    search: Joi.string().max(200).trim().optional(),
    sort: Joi.string().valid('recent', 'updated', 'popular', 'likes', 'bookmarks').optional(),
    order: Joi.string().valid('asc', 'desc').optional(),
    category: Joi.string().max(100).trim().optional(), // Allow frontend labels
    status: Joi.string().valid("draft", "published", "archived").optional(),
    featured: Joi.boolean().optional(),
    author: commonSchemas.objectId.optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
  }),
};

/**
 * Event validation schemas
 */
const eventSchemas = {
  createEvent: Joi.object({
    title: Joi.string().min(5).max(200).trim().required(),
    description: Joi.string().min(20).max(2000).trim().required(),
    category: Joi.string()
      .valid(
        "workshop",
        "seminar",
        "meeting",
        "training",
        "conference",
        "social",
        "team-building",
        "presentation",
        "webinar",
        "other"
      )
      .required(),
    type: Joi.string().valid("online", "offline", "hybrid").default("offline"),
    location: Joi.object({
      name: Joi.string().max(100).trim().optional(),
      address: Joi.string().max(200).trim().optional(),
      city: Joi.string().max(50).trim().optional(),
      state: Joi.string().max(50).trim().optional(),
      country: Joi.string().max(50).trim().optional(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional(),
      }).optional(),
    }).optional(),
    onlineDetails: Joi.object({
      platform: Joi.string().max(50).trim().optional(),
      meetingLink: Joi.string().uri().optional(),
      meetingId: Joi.string().max(50).trim().optional(),
      password: Joi.string().max(50).trim().optional(),
    }).optional(),
    startDate: Joi.date().greater("now").required(),
    endDate: Joi.date().greater(Joi.ref("startDate")).required(),
    timezone: Joi.string().default("UTC"),
    capacity: Joi.number().integer().min(1).optional(),
    visibility: Joi.string()
      .valid("public", "private", "invite-only")
      .default("public"),
    tags: Joi.array()
      .items(Joi.string().min(1).max(30).trim())
      .max(10)
      .optional(),
    requirements: Joi.array()
      .items(Joi.string().max(200).trim())
      .max(5)
      .optional(),
    agenda: Joi.array()
      .items(
        Joi.object({
          time: Joi.string().max(20).trim().required(),
          title: Joi.string().max(100).trim().required(),
          description: Joi.string().max(500).trim().optional(),
          speaker: Joi.string().max(100).trim().optional(),
        })
      )
      .max(20)
      .optional(),
    registrationDeadline: Joi.date().less(Joi.ref("startDate")).optional(),
    allowWaitlist: Joi.boolean().default(true),
    requiresApproval: Joi.boolean().default(false),
  }),

  updateEvent: Joi.object({
    title: Joi.string().min(5).max(200).trim().optional(),
    description: Joi.string().min(20).max(2000).trim().optional(),
    category: Joi.string()
      .valid(
        "workshop",
        "seminar",
        "meeting",
        "training",
        "conference",
        "social",
        "team-building",
        "presentation",
        "webinar",
        "other"
      )
      .optional(),
    type: Joi.string().valid("online", "offline", "hybrid").optional(),
    location: Joi.object({
      name: Joi.string().max(100).trim().optional(),
      address: Joi.string().max(200).trim().optional(),
      city: Joi.string().max(50).trim().optional(),
      state: Joi.string().max(50).trim().optional(),
      country: Joi.string().max(50).trim().optional(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional(),
      }).optional(),
    }).optional(),
    onlineDetails: Joi.object({
      platform: Joi.string().max(50).trim().optional(),
      meetingLink: Joi.string().uri().optional(),
      meetingId: Joi.string().max(50).trim().optional(),
      password: Joi.string().max(50).trim().optional(),
    }).optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    timezone: Joi.string().optional(),
    capacity: Joi.number().integer().min(1).optional(),
    visibility: Joi.string()
      .valid("public", "private", "invite-only")
      .optional(),
    tags: Joi.array()
      .items(Joi.string().min(1).max(30).trim())
      .max(10)
      .optional(),
    requirements: Joi.array()
      .items(Joi.string().max(200).trim())
      .max(5)
      .optional(),
    agenda: Joi.array()
      .items(
        Joi.object({
          time: Joi.string().max(20).trim().required(),
          title: Joi.string().max(100).trim().required(),
          description: Joi.string().max(500).trim().optional(),
          speaker: Joi.string().max(100).trim().optional(),
        })
      )
      .max(20)
      .optional(),
    registrationDeadline: Joi.date().optional(),
    allowWaitlist: Joi.boolean().optional(),
    requiresApproval: Joi.boolean().optional(),
    status: Joi.string()
      .valid("draft", "published", "cancelled", "completed")
      .optional(),
  }),

  rsvp: Joi.object({
    status: Joi.string()
      .valid("attending", "maybe", "not_attending")
      .default("attending"),
  }),

  addFeedback: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(500).trim().optional(),
  }),

  getEvents: Joi.object({
    ...commonSchemas.pagination.describe(),
    search: Joi.string().max(200).trim().optional(),
    sort: Joi.string().valid('date', 'popular', 'recent').optional(),
    order: Joi.string().valid('asc', 'desc').optional(),
    category: Joi.string()
      .valid(
        "workshop",
        "seminar",
        "meeting",
        "training",
        "conference",
        "social",
        "team-building",
        "presentation",
        "webinar",
        "other"
      )
      .optional(),
    type: Joi.string().valid("online", "offline", "hybrid").optional(),
    status: Joi.string()
      .valid("draft", "published", "cancelled", "completed")
      .optional(),
    city: Joi.string().trim().optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
  }),
};

/**
 * Frontend-aligned simplified schemas (accept UI payload shapes)
 */
const frontendSchemas = {
  // Events: UI sends title, description, date, endDate, location (string), type, category, maxAttendees, tags (string or array)
  createEvent: Joi.object({
    title: Joi.string().min(2).max(200).trim().required(),
    description: Joi.string().min(5).max(5000).trim().required(),
    date: Joi.alternatives().try(Joi.date(), Joi.string()).required(),
    endDate: Joi.alternatives().try(Joi.date(), Joi.string()).optional(),
    location: Joi.string().max(200).trim().required(),
    type: Joi.string().max(50).trim().optional(),
    category: Joi.string().max(100).trim().optional(),
    maxAttendees: Joi.alternatives()
      .try(Joi.number().integer().min(1), Joi.string())
      .optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(30).trim()).max(20),
        Joi.string().max(500)
      )
      .optional(),
  }),

  updateEvent: Joi.object({
    title: Joi.string().min(2).max(200).trim().optional(),
    description: Joi.string().min(5).max(5000).trim().optional(),
    date: Joi.alternatives().try(Joi.date(), Joi.string()).optional(),
    endDate: Joi.alternatives().try(Joi.date(), Joi.string()).optional(),
    location: Joi.string().max(200).trim().optional(),
    maxAttendees: Joi.alternatives()
      .try(Joi.number().integer().min(1), Joi.string())
      .optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(30).trim()).max(20),
        Joi.string().max(500)
      )
      .optional(),
    status: Joi.string()
      .valid("draft", "published", "cancelled", "completed")
      .optional(),
  }),

  // Articles: UI sends title, content, category (label), type, tags (string or array), difficulty
  createArticle: Joi.object({
    title: Joi.string().min(5).max(200).trim().required(),
    content: Joi.string().min(20).max(10000).trim().required(),
    category: Joi.string().max(100).trim().required(),
    type: Joi.string().max(50).trim().optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(30).trim()).max(20),
        Joi.string().max(500)
      )
      .optional(),
    difficulty: Joi.string().max(50).trim().optional(),
  }),

  updateArticle: Joi.object({
    title: Joi.string().min(5).max(200).trim().optional(),
    content: Joi.string().min(20).max(10000).trim().optional(),
    category: Joi.string().max(100).trim().optional(),
    type: Joi.string().max(50).trim().optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(30).trim()).max(20),
        Joi.string().max(500)
      )
      .optional(),
    difficulty: Joi.string().max(50).trim().optional(),
    status: Joi.string().valid("draft", "published", "archived").optional(),
  }),
};

/**
 * Admin validation schemas
 */
const adminSchemas = {
  updateUserRole: Joi.object({
    role: Joi.string().valid("user", "moderator", "admin").required(),
  }),

  updateUserStatus: Joi.object({
    isActive: Joi.boolean().required(),
  }),

  getUsers: Joi.object({
    ...commonSchemas.pagination.describe(),
    role: Joi.string().valid("user", "moderator", "admin").optional(),
    department: Joi.string().trim().optional(),
    isActive: Joi.boolean().optional(),
    search: Joi.string().trim().optional(),
  }),
};

module.exports = {
  validate,
  commonSchemas,
  userSchemas,
  forumSchemas,
  articleSchemas,
  eventSchemas,
  frontendSchemas,
  adminSchemas,
};

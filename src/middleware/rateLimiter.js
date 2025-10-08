const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const logger = require('../utils/logger');

// Store for tracking rate limits (in production, use Redis)
const rateLimitStore = new Map();

// Custom store for rate limiting
const customStore = {
  incr: (key, cb) => {
    const now = new Date();
    const windowMs = config.rateLimit.windowMs;

    if (!rateLimitStore.has(key)) {
      const resetDate = new Date(now.getTime() + windowMs);
      rateLimitStore.set(key, { count: 1, resetTime: resetDate });
      return cb(null, 1, resetDate);
    }

    const record = rateLimitStore.get(key);

    if (now > record.resetTime) {
      // Reset the window
      const resetDate = new Date(now.getTime() + windowMs);
      rateLimitStore.set(key, { count: 1, resetTime: resetDate });
      return cb(null, 1, resetDate);
    }

    record.count++;
    return cb(null, record.count, record.resetTime);
  },
  
  decrement: (key) => {
    if (rateLimitStore.has(key)) {
      const record = rateLimitStore.get(key);
      if (record.count > 0) {
        record.count--;
      }
    }
  },
  
  resetKey: (key) => {
    rateLimitStore.delete(key);
  }
};

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(config.rateLimit.windowMs / 1000)
    });
  }
});

// Strict rate limiter for authentication endpoints (relaxed in development to ease testing)
const isDev = String(config.nodeEnv).toLowerCase() === 'development';
const authLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 15 * 60 * 1000, // 1 min in dev, 15 min otherwise
  max: isDev ? 1000 : 10, // Allow many attempts in dev for testing
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: isDev ? 60 : 900 // seconds
    });
  }
});

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore,
  handler: (req, res) => {
    logger.warn(`Password reset rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts, please try again later.',
      retryAfter: 3600 // 1 hour in seconds
    });
  }
});

// Email verification rate limiter
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: {
    success: false,
    message: 'Too many email verification attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore,
  handler: (req, res) => {
    logger.warn(`Email verification rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many email verification attempts, please try again later.',
      retryAfter: 3600 // 1 hour in seconds
    });
  }
});

// File upload rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    message: 'Too many file uploads, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore,
  handler: (req, res) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many file uploads, please try again later.',
      retryAfter: 3600 // 1 hour in seconds
    });
  }
});

// Search rate limiter
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 searches per minute
  message: {
    success: false,
    message: 'Too many search requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore,
  handler: (req, res) => {
    logger.warn(`Search rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many search requests, please try again later.',
      retryAfter: 60 // 1 minute in seconds
    });
  }
});

// Comment/Reply rate limiter
const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 comments per minute
  message: {
    success: false,
    message: 'Too many comments, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore,
  handler: (req, res) => {
    logger.warn(`Comment rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many comments, please try again later.',
      retryAfter: 60 // 1 minute in seconds
    });
  }
});

// Create custom rate limiter
const createCustomLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: customStore,
    handler: (req, res) => {
      logger.warn(`Custom rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        message: message || 'Too many requests, please try again later.',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// User-specific rate limiter
const createUserLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      return req.user ? req.user._id.toString() : req.ip;
    },
    message: {
      success: false,
      message: message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: customStore,
    handler: (req, res) => {
      const identifier = req.user ? req.user._id.toString() : req.ip;
      logger.warn(`User rate limit exceeded for: ${identifier}`);
      res.status(429).json({
        success: false,
        message: message || 'Too many requests, please try again later.',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Clean up expired rate limit records
const cleanupRateLimitStore = () => {
  const now = new Date();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

// Get rate limit info for a key
const getRateLimitInfo = (key) => {
  const record = rateLimitStore.get(key);
  if (!record) {
    return { count: 0, resetTime: null, remaining: null };
  }

  const now = new Date();
  if (now > record.resetTime) {
    return { count: 0, resetTime: null, remaining: null };
  }

  return {
    count: record.count,
    resetTime: record.resetTime,
    remaining: Math.max(0, config.rateLimit.maxRequests - record.count)
  };
};

// Reset rate limit for a key
const resetRateLimit = (key) => {
  rateLimitStore.delete(key);
};

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  uploadLimiter,
  searchLimiter,
  commentLimiter,
  createCustomLimiter,
  createUserLimiter,
  getRateLimitInfo,
  resetRateLimit,
  cleanupRateLimitStore
};

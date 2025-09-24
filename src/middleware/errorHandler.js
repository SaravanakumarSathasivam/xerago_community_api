const { logger } = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const config = require('../config/config');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = { message, statusCode: 400 };
  }

  // Rate limit errors
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = { message, statusCode: 429 };
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  const responsePayload = {
    success: false,
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  };
  res.status(statusCode).json(responsePayload);

  // Persist error audit log (non-blocking)
  try {
    AuditLog.create({
      method: req.method,
      route: req.originalUrl,
      statusCode,
      user: req.user?._id,
      requestBody: req.body,
      responseBody: responsePayload
    }).catch(() => {});
  } catch {}
};

/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Handle async errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled Promise Rejection:', {
      message: err.message,
      stack: err.stack
    });
    
    // Close server & exit process
    process.exit(1);
  });
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', {
      message: err.message,
      stack: err.stack
    });
    
    // Close server & exit process
    process.exit(1);
  });
};

/**
 * Handle SIGTERM signal
 */
const handleSIGTERM = () => {
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
  });
};

/**
 * Handle SIGINT signal
 */
const handleSIGINT = () => {
  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    process.exit(0);
  });
};

/**
 * Validation error formatter
 */
const formatValidationErrors = (errors) => {
  const formatted = {};
  
  if (Array.isArray(errors)) {
    errors.forEach(error => {
      if (error.path) {
        formatted[error.path] = error.message;
      }
    });
  } else if (errors.details) {
    errors.details.forEach(error => {
      formatted[error.path.join('.')] = error.message;
    });
  }
  
  return formatted;
};

/**
 * Database error handler
 */
const handleDatabaseError = (err) => {
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    switch (err.code) {
      case 11000:
        return new AppError('Duplicate field value', 400);
      case 11001:
        return new AppError('Duplicate field value', 400);
      default:
        return new AppError('Database error', 500);
    }
  }
  
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return new AppError(message, 400);
  }
  
  if (err.name === 'CastError') {
    return new AppError('Invalid ID format', 400);
  }
  
  return err;
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  AppError,
  handleUnhandledRejection,
  handleUncaughtException,
  handleSIGTERM,
  handleSIGINT,
  formatValidationErrors,
  handleDatabaseError
};

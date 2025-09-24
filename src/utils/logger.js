const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
require('fs').mkdirSync(logsDir, { recursive: true });

// Create logger instance
const logger = winston.createLogger({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: { service: 'xerago-community-api' },
  transports: [
    // Write all logs to console in development
    new winston.transports.Console({
      format: config.nodeEnv === 'development' ? consoleFormat : logFormat
    }),
    
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('Request received', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user._id : null
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    logger.info('Response sent', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user ? req.user._id : null
    });
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Add error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user._id : null,
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  next(err);
};

// Utility functions
const logUserAction = (userId, action, details = {}) => {
  logger.info('User action', {
    userId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
};

const logSecurityEvent = (event, details = {}) => {
  logger.warn('Security event', {
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

const logPerformance = (operation, duration, details = {}) => {
  logger.info('Performance metric', {
    operation,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString()
  });
};

const logDatabaseOperation = (operation, collection, duration, details = {}) => {
  logger.debug('Database operation', {
    operation,
    collection,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString()
  });
};

const logEmailSent = (to, subject, template, details = {}) => {
  logger.info('Email sent', {
    to,
    subject,
    template,
    details,
    timestamp: new Date().toISOString()
  });
};

const logFileUpload = (userId, filename, size, details = {}) => {
  logger.info('File upload', {
    userId,
    filename,
    size: `${size} bytes`,
    details,
    timestamp: new Date().toISOString()
  });
};

const logFileDelete = (userId, filename, details = {}) => {
  logger.info('File deleted', {
    userId,
    filename,
    details,
    timestamp: new Date().toISOString()
  });
};

// Create child logger with additional context
const createChildLogger = (context) => {
  return logger.child(context);
};

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Export logger and utilities
module.exports = {
  logger,
  // Proxy level methods for legacy imports using logger.error/warn/info
  error: (...args) => logger.error(...args),
  warn: (...args) => logger.warn(...args),
  info: (...args) => logger.info(...args),
  debug: (...args) => logger.debug(...args),
  requestLogger,
  errorLogger,
  logUserAction,
  logSecurityEvent,
  logPerformance,
  logDatabaseOperation,
  logEmailSent,
  logFileUpload,
  logFileDelete,
  createChildLogger,
  levels
};

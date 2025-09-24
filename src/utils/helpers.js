const crypto = require('crypto');
const moment = require('moment');
const _ = require('lodash');

/**
 * Generate a random string of specified length
 */
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a random number between min and max (inclusive)
 */
const generateRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Generate a slug from a string
 */
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
};

/**
 * Capitalize first letter of each word
 */
const capitalizeWords = (str) => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

/**
 * Format date to human readable format
 */
const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return moment(date).format(format);
};

/**
 * Get relative time (e.g., "2 hours ago")
 */
const getRelativeTime = (date) => {
  return moment(date).fromNow();
};

/**
 * Check if date is today
 */
const isToday = (date) => {
  return moment(date).isSame(moment(), 'day');
};

/**
 * Check if date is yesterday
 */
const isYesterday = (date) => {
  return moment(date).isSame(moment().subtract(1, 'day'), 'day');
};

/**
 * Get start and end of day for a date
 */
const getDayBounds = (date) => {
  return {
    start: moment(date).startOf('day').toDate(),
    end: moment(date).endOf('day').toDate()
  };
};

/**
 * Get start and end of week for a date
 */
const getWeekBounds = (date) => {
  return {
    start: moment(date).startOf('week').toDate(),
    end: moment(date).endOf('week').toDate()
  };
};

/**
 * Get start and end of month for a date
 */
const getMonthBounds = (date) => {
  return {
    start: moment(date).startOf('month').toDate(),
    end: moment(date).endOf('month').toDate()
  };
};

/**
 * Sanitize HTML content
 */
const sanitizeHtml = (html) => {
  // Basic HTML sanitization - in production, use a proper library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

/**
 * Truncate text to specified length
 */
const truncateText = (text, length = 100, suffix = '...') => {
  if (text.length <= length) return text;
  return text.substring(0, length).trim() + suffix;
};

/**
 * Extract text from HTML
 */
const extractTextFromHtml = (html) => {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

/**
 * Generate pagination metadata
 */
const generatePaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null
  };
};

/**
 * Calculate reading time for text
 */
const calculateReadingTime = (text) => {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

/**
 * Generate search query for MongoDB text search
 */
const generateSearchQuery = (searchTerm, fields = []) => {
  if (!searchTerm) return {};
  
  const searchRegex = new RegExp(searchTerm, 'i');
  
  if (fields.length === 0) {
    return { $text: { $search: searchTerm } };
  }
  
  const orConditions = fields.map(field => ({
    [field]: searchRegex
  }));
  
  return { $or: orConditions };
};

/**
 * Sort array of objects by multiple fields
 */
const sortByMultipleFields = (array, sortFields) => {
  return array.sort((a, b) => {
    for (const field of sortFields) {
      const { field: fieldName, order = 'asc' } = field;
      const aVal = _.get(a, fieldName);
      const bVal = _.get(b, fieldName);
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

/**
 * Group array by field
 */
const groupBy = (array, field) => {
  return _.groupBy(array, field);
};

/**
 * Remove duplicates from array
 */
const removeDuplicates = (array, field = null) => {
  if (field) {
    return _.uniqBy(array, field);
  }
  return [...new Set(array)];
};

/**
 * Deep clone object
 */
const deepClone = (obj) => {
  return _.cloneDeep(obj);
};

/**
 * Merge objects deeply
 */
const deepMerge = (target, source) => {
  return _.merge(target, source);
};

/**
 * Check if object is empty
 */
const isEmpty = (obj) => {
  return _.isEmpty(obj);
};

/**
 * Pick specific fields from object
 */
const pickFields = (obj, fields) => {
  return _.pick(obj, fields);
};

/**
 * Omit specific fields from object
 */
const omitFields = (obj, fields) => {
  return _.omit(obj, fields);
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate URL format
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Generate file extension from MIME type
 */
const getFileExtension = (mimeType) => {
  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
  };
  
  return mimeToExt[mimeType] || '';
};

/**
 * Format file size in human readable format
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate random color
 */
const generateRandomColor = () => {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Calculate distance between two coordinates
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Debounce function
 */
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Retry function with exponential backoff
 */
const retry = async (fn, maxAttempts = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
};

/**
 * Sleep function
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate UUID v4
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Check if string is a valid MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Convert string to title case
 */
const toTitleCase = (str) => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

/**
 * Generate initials from name
 */
const generateInitials = (name) => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
};

module.exports = {
  generateRandomString,
  generateRandomNumber,
  generateSlug,
  capitalizeWords,
  formatDate,
  getRelativeTime,
  isToday,
  isYesterday,
  getDayBounds,
  getWeekBounds,
  getMonthBounds,
  sanitizeHtml,
  truncateText,
  extractTextFromHtml,
  generatePaginationMeta,
  calculateReadingTime,
  generateSearchQuery,
  sortByMultipleFields,
  groupBy,
  removeDuplicates,
  deepClone,
  deepMerge,
  isEmpty,
  pickFields,
  omitFields,
  isValidEmail,
  isValidUrl,
  getFileExtension,
  formatFileSize,
  generateRandomColor,
  calculateDistance,
  debounce,
  throttle,
  retry,
  sleep,
  generateUUID,
  isValidObjectId,
  toTitleCase,
  generateInitials
};

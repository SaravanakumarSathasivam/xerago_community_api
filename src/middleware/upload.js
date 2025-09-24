const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const logger = require('../utils/logger');

// Ensure upload directory exists
const ensureUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = config.upload.uploadPath;
    
    // Create subdirectories based on file type
    if (file.mimetype.startsWith('image/')) {
      uploadPath = path.join(uploadPath, 'images');
    } else if (file.mimetype === 'application/pdf') {
      uploadPath = path.join(uploadPath, 'documents');
    } else {
      uploadPath = path.join(uploadPath, 'others');
    }
    
    ensureUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    cb(null, `${name}_${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Check file type
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 5 // Maximum 5 files per request
  }
});

// Middleware for single file upload
const uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    
    uploadMiddleware(req, res, (err) => {
      if (err) {
        logger.error('File upload error:', err);
        
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 10MB.'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum 5 files allowed.'
              });
            case 'LIMIT_UNEXPECTED_FILE':
              return res.status(400).json({
                success: false,
                message: 'Unexpected file field.'
              });
            default:
              return res.status(400).json({
                success: false,
                message: 'File upload error.'
              });
          }
        }
        
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      // Add file info to request
      if (req.file) {
        req.file.url = `/uploads/${path.relative(config.upload.uploadPath, req.file.path)}`;
      }
      
      next();
    });
  };
};

// Middleware for multiple files upload
const uploadMultiple = (fieldName = 'files', maxCount = 5) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(fieldName, maxCount);
    
    uploadMiddleware(req, res, (err) => {
      if (err) {
        logger.error('File upload error:', err);
        
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 10MB.'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({
                success: false,
                message: `Too many files. Maximum ${maxCount} files allowed.`
              });
            case 'LIMIT_UNEXPECTED_FILE':
              return res.status(400).json({
                success: false,
                message: 'Unexpected file field.'
              });
            default:
              return res.status(400).json({
                success: false,
                message: 'File upload error.'
              });
          }
        }
        
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      // Add file info to request
      if (req.files && req.files.length > 0) {
        req.files = req.files.map(file => ({
          ...file,
          url: `/uploads/${path.relative(config.upload.uploadPath, file.path)}`
        }));
      }
      
      next();
    });
  };
};

// Middleware for specific field uploads
const uploadFields = (fields) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.fields(fields);
    
    uploadMiddleware(req, res, (err) => {
      if (err) {
        logger.error('File upload error:', err);
        
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 10MB.'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({
                success: false,
                message: 'Too many files.'
              });
            case 'LIMIT_UNEXPECTED_FILE':
              return res.status(400).json({
                success: false,
                message: 'Unexpected file field.'
              });
            default:
              return res.status(400).json({
                success: false,
                message: 'File upload error.'
              });
          }
        }
        
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      // Add file info to request
      if (req.files) {
        Object.keys(req.files).forEach(fieldName => {
          req.files[fieldName] = req.files[fieldName].map(file => ({
            ...file,
            url: `/uploads/${path.relative(config.upload.uploadPath, file.path)}`
          }));
        });
      }
      
      next();
    });
  };
};

// Middleware for avatar upload
const uploadAvatar = uploadSingle('avatar');

// Middleware for article images
const uploadArticleImages = uploadMultiple('images', 3);

// Middleware for event images
const uploadEventImages = uploadMultiple('images', 5);

// Middleware for forum attachments
const uploadForumAttachments = uploadMultiple('attachments', 3);

// Utility function to delete file
const deleteFile = (filePath) => {
  try {
    const fullPath = path.join(config.upload.uploadPath, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info(`File deleted: ${fullPath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error deleting file:', error);
    return false;
  }
};

// Utility function to get file info
const getFileInfo = (filePath) => {
  try {
    const fullPath = path.join(config.upload.uploadPath, filePath);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    }
    return { exists: false };
  } catch (error) {
    logger.error('Error getting file info:', error);
    return { exists: false };
  }
};

// Clean up old files (utility function)
const cleanupOldFiles = (daysOld = 30) => {
  try {
    const uploadPath = config.upload.uploadPath;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const cleanupDir = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          cleanupDir(filePath);
        } else if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up old file: ${filePath}`);
        }
      });
    };
    
    if (fs.existsSync(uploadPath)) {
      cleanupDir(uploadPath);
    }
  } catch (error) {
    logger.error('Error cleaning up old files:', error);
  }
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadAvatar,
  uploadArticleImages,
  uploadEventImages,
  uploadForumAttachments,
  deleteFile,
  getFileInfo,
  cleanupOldFiles
};

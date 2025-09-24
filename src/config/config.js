require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/xerago_community',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
    expire: process.env.JWT_EXPIRE || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-here',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d'
  },
  
  // Email Configuration
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: {
      email: process.env.FROM_EMAIL || 'noreply@xerago.com',
      name: process.env.FROM_NAME || 'Xerago Community'
    }
  },
  
  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  },
  
  // Admin Configuration
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@xerago.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123#'
  },
  
  // Gamification Configuration
  gamification: {
    points: {
      articleCreate: parseInt(process.env.POINTS_ARTICLE_CREATE) || 10,
      articleLike: parseInt(process.env.POINTS_ARTICLE_LIKE) || 2,
      forumPost: parseInt(process.env.POINTS_FORUM_POST) || 5,
      forumReply: parseInt(process.env.POINTS_FORUM_REPLY) || 3,
      eventAttend: parseInt(process.env.POINTS_EVENT_ATTEND) || 8,
      eventCreate: parseInt(process.env.POINTS_EVENT_CREATE) || 15
    }
  }
};

module.exports = config;

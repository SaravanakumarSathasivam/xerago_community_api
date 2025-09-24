# Xerago Community API

A comprehensive backend API for the Xerago Community Platform built with Node.js, Express, and MongoDB.

## Features

- **Authentication & Authorization** - JWT-based auth with role management
- **User Management** - User profiles, roles, and permissions
- **Discussion Forums** - Categories, posts, threads, and replies
- **Knowledge Base** - Articles, documentation, and search
- **Events Management** - Event creation, RSVPs, and notifications
- **Gamification** - Points system, leaderboards, and achievements
- **Admin Dashboard** - User management and content moderation
- **File Uploads** - Image and document handling
- **Email Notifications** - Automated email system
- **Rate Limiting** - API protection and throttling

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi
- **Testing**: Jest & Supertest
- **Documentation**: JSDoc

## Project Structure

```
xerago-community-api/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── config.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── forumController.js
│   │   ├── articleController.js
│   │   ├── eventController.js
│   │   ├── leaderboardController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── validation.js
│   │   ├── upload.js
│   │   └── rateLimiter.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Forum.js
│   │   ├── Article.js
│   │   ├── Event.js
│   │   ├── Leaderboard.js
│   │   └── Achievement.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── forums.js
│   │   ├── articles.js
│   │   ├── events.js
│   │   ├── leaderboard.js
│   │   └── admin.js
│   ├── utils/
│   │   ├── logger.js
│   │   ├── helpers.js
│   │   ├── email.js
│   │   └── gamification.js
│   └── app.js
├── tests/
│   ├── auth.test.js
│   ├── users.test.js
│   ├── forums.test.js
│   ├── articles.test.js
│   ├── events.test.js
│   └── leaderboard.test.js
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd xerago-community-api
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

4. Start MongoDB (make sure MongoDB is running on your system)

5. Run the application:
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

Copy `env.example` to `.env` and configure the following variables:

- `PORT` - Server port (default: 3001)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT secret key
- `SMTP_*` - Email configuration
- `CORS_ORIGIN` - Frontend URL for CORS

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Forgot password
- `POST /api/auth/reset-password` - Reset password

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users` - Get all users (admin)
- `PUT /api/users/:id` - Update user (admin)
- `DELETE /api/users/:id` - Delete user (admin)

### Forums
- `GET /api/forums/categories` - Get forum categories
- `GET /api/forums/posts` - Get forum posts
- `POST /api/forums/posts` - Create forum post
- `GET /api/forums/posts/:id` - Get specific post
- `PUT /api/forums/posts/:id` - Update post
- `DELETE /api/forums/posts/:id` - Delete post
- `POST /api/forums/posts/:id/replies` - Add reply to post

### Articles
- `GET /api/articles` - Get all articles
- `POST /api/articles` - Create article
- `GET /api/articles/:id` - Get specific article
- `PUT /api/articles/:id` - Update article
- `DELETE /api/articles/:id` - Delete article
- `POST /api/articles/:id/like` - Like article
- `GET /api/articles/search` - Search articles

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get specific event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/:id/rsvp` - RSVP to event
- `GET /api/events/upcoming` - Get upcoming events

### Leaderboard
- `GET /api/leaderboard` - Get leaderboard
- `GET /api/leaderboard/achievements` - Get achievements
- `POST /api/leaderboard/achievements` - Create achievement

### Admin
- `GET /api/admin/stats` - Get platform statistics
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/role` - Update user role
- `GET /api/admin/reports` - Get reports

## Testing

Run tests:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

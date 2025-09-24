const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Article = require('../src/models/Article');

describe('Articles', () => {
  let token;
  let userId;

  beforeAll(async () => {
    // Create a test user and get token
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(userData);

    token = response.body.data.token;
    userId = response.body.data.user.id;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Article.deleteMany({});
  });

  describe('GET /api/articles', () => {
    it('should get articles', async () => {
      const response = await request(app)
        .get('/api/articles')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.articles)).toBe(true);
    });
  });

  describe('POST /api/articles', () => {
    it('should create a new article', async () => {
      const articleData = {
        title: 'Test Article',
        content: 'This is a test article content with more than 50 characters to meet validation requirements.',
        category: 'technology',
        tags: ['test', 'example']
      };

      const response = await request(app)
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send(articleData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created');
    });

    it('should not create article without authentication', async () => {
      const articleData = {
        title: 'Test Article',
        content: 'This is a test article content with more than 50 characters to meet validation requirements.',
        category: 'technology'
      };

      const response = await request(app)
        .post('/api/articles')
        .send(articleData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

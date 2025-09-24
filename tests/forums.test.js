const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Forum = require('../src/models/Forum');

describe('Forums', () => {
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
    await Forum.deleteMany({});
  });

  describe('GET /api/forums/posts', () => {
    it('should get forum posts', async () => {
      const response = await request(app)
        .get('/api/forums/posts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.posts)).toBe(true);
    });
  });

  describe('POST /api/forums/posts', () => {
    it('should create a new forum post', async () => {
      const postData = {
        title: 'Test Forum Post',
        content: 'This is a test forum post content',
        category: 'general',
        tags: ['test', 'example']
      };

      const response = await request(app)
        .post('/api/forums/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(postData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created');
    });

    it('should not create post without authentication', async () => {
      const postData = {
        title: 'Test Forum Post',
        content: 'This is a test forum post content',
        category: 'general'
      };

      const response = await request(app)
        .post('/api/forums/posts')
        .send(postData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

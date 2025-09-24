const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Leaderboard', () => {
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
  });

  describe('GET /api/leaderboard', () => {
    it('should get leaderboard', async () => {
      const response = await request(app)
        .get('/api/leaderboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.leaderboard)).toBe(true);
    });
  });

  describe('GET /api/leaderboard/position', () => {
    it('should get user position with authentication', async () => {
      const response = await request(app)
        .get('/api/leaderboard/position')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.position).toBeDefined();
    });

    it('should not get position without authentication', async () => {
      const response = await request(app)
        .get('/api/leaderboard/position')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/leaderboard/achievements', () => {
    it('should get achievements', async () => {
      const response = await request(app)
        .get('/api/leaderboard/achievements')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.achievements)).toBe(true);
    });
  });
});

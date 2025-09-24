const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Event = require('../src/models/Event');

describe('Events', () => {
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
    await Event.deleteMany({});
  });

  describe('GET /api/events', () => {
    it('should get events', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.events)).toBe(true);
    });
  });

  describe('POST /api/events', () => {
    it('should create a new event', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'This is a test event description with more than 20 characters.',
        category: 'workshop',
        type: 'online',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // Day after tomorrow
        onlineDetails: {
          platform: 'Zoom',
          meetingLink: 'https://zoom.us/j/123456789'
        }
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send(eventData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created');
    });

    it('should not create event without authentication', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'This is a test event description with more than 20 characters.',
        category: 'workshop',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 25 * 60 * 60 * 1000)
      };

      const response = await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

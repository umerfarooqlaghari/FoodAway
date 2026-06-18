const request = require('supertest');
const app = require('../src/index');
const { db, initDB } = require('../src/db');

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to run tests safely (never use production DATABASE_URL)');
  await db.exec('TRUNCATE TABLE favorites, chat_messages, reviews, orders, food_items, surprise_bags, stores, users RESTART IDENTITY CASCADE');
  await initDB();
});

describe('Auth Endpoints', () => {
  let userToken;

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.message).toBe('User registered successfully');
  });

  it('should fail to register a duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another User',
        email: 'test@example.com',
        password: 'password123'
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toBe('Email already exists');
  });

  it('should login successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.role).toBe('Customers');
  });

  it('should fail login with bad password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });
    expect(res.statusCode).toEqual(401);
  });
});

const request = require('supertest');
const app = require('../src/index');
const { db, initDB } = require('../src/db');

let customerToken;
let adminToken;

beforeAll(async () => {
  db.exec('PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS favorites; DROP TABLE IF EXISTS chat_messages; DROP TABLE IF EXISTS reviews; DROP TABLE IF EXISTS orders; DROP TABLE IF EXISTS food_items; DROP TABLE IF EXISTS surprise_bags; DROP TABLE IF EXISTS stores; DROP TABLE IF EXISTS users; PRAGMA foreign_keys = ON;');
  initDB();

  // Create Customer
  await request(app).post('/api/auth/register').send({
    name: 'Customer', email: 'customer@example.com', password: 'pass', role: 'Customers'
  });
  const resCust = await request(app).post('/api/auth/login').send({ email: 'customer@example.com', password: 'pass' });
  customerToken = resCust.body.token;

  // Create SellersAdmin
  await request(app).post('/api/auth/register').send({
    name: 'Admin', email: 'admin@example.com', password: 'pass', role: 'SellersAdmin'
  });
  const resAdmin = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'pass' });
  adminToken = resAdmin.body.token;
});

describe('RBAC Guards', () => {
  it('should prevent unauthenticated access', async () => {
    const res = await request(app).get('/api/bags');
    expect(res.statusCode).toEqual(401);
  });

  it('should prevent Customers from creating stores', async () => {
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'My Store', address: '123' });
    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toContain('Forbidden');
  });

  it('should allow SellersAdmin to create stores', async () => {
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Store', address: '456', lat: 0, lng: 0 });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id');
  });
});

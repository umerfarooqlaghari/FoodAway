const request = require('supertest');
const app = require('../src/index');
const { db, initDB } = require('../src/db');

let adminToken;
let storeId;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to run tests safely (never use production DATABASE_URL)');
  await db.exec('TRUNCATE TABLE favorites, chat_messages, reviews, orders, food_items, surprise_bags, stores, users RESTART IDENTITY CASCADE');
  await initDB();

  await request(app).post('/api/auth/register').send({
    name: 'API Admin', email: 'apiadmin@example.com', password: 'pass', role: 'SellersAdmin'
  });
  const resAdmin = await request(app).post('/api/auth/login').send({ email: 'apiadmin@example.com', password: 'pass' });
  adminToken = resAdmin.body.token;
});

describe('Core API Endpoints', () => {
  it('should create a store', async () => {
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Store', address: '789 Main St', lat: 10.0, lng: 20.0 });
    expect(res.statusCode).toEqual(200);
    expect(res.body.name).toBe('Test Store');
    storeId = res.body.id;
  });

  it('should create a surprise bag for the store', async () => {
    const res = await request(app)
      .post('/api/bags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ store_id: storeId, price: 5.99, quantity: 10, pickup_time: '18:00' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.quantity).toBe(10);
  });

  it('should fetch available bags', async () => {
    const res = await request(app)
      .get('/api/bags')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].store_name).toBe('Test Store');
    expect(res.body[0].price).toBe(5.99);
  });
});

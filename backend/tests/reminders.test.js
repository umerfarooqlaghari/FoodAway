const request = require('supertest');
const app = require('../src/index');
const { db, initDB } = require('../src/db');

let adminToken;
let superAdminToken;
let customerToken;
let inactiveCustomerToken;
let storeId;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to run tests safely (never use production DATABASE_URL)');
  await db.exec('TRUNCATE TABLE favorites, chat_messages, reviews, orders, food_items, surprise_bags, stores, users RESTART IDENTITY CASCADE');
  await initDB();

  // Create SuperAdmin
  await request(app).post('/api/auth/register').send({
    name: 'Super Admin', email: 'superadmin@example.com', password: 'pass', role: 'SuperAdmin'
  });
  const resSuper = await request(app).post('/api/auth/login').send({ email: 'superadmin@example.com', password: 'pass' });
  superAdminToken = resSuper.body.token;

  // Create SellersAdmin
  await request(app).post('/api/auth/register').send({
    name: 'Seller Admin', email: 'selleradmin@example.com', password: 'pass', role: 'SellersAdmin'
  });
  const resAdmin = await request(app).post('/api/auth/login').send({ email: 'selleradmin@example.com', password: 'pass' });
  adminToken = resAdmin.body.token;

  // Create Customer 1 (Active)
  await request(app).post('/api/auth/register').send({
    name: 'Active Customer', email: 'active@example.com', password: 'pass', role: 'Customers'
  });
  const resCust = await request(app).post('/api/auth/login').send({ email: 'active@example.com', password: 'pass' });
  customerToken = resCust.body.token;

  // Create Customer 2 (Inactive - never ordered)
  await request(app).post('/api/auth/register').send({
    name: 'Inactive Customer', email: 'inactive@example.com', password: 'pass', role: 'Customers'
  });
  const resInac = await request(app).post('/api/auth/login').send({ email: 'inactive@example.com', password: 'pass' });
  inactiveCustomerToken = resInac.body.token;

  // Create store
  const resStore = await request(app)
    .post('/api/stores')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Reminder Store', address: '123 Alert Ln', lat: 10.0, lng: 20.0 });
  storeId = resStore.body.id;
});

describe('Reminder and Engagement Endpoints', () => {
  it('should trigger inactivity reminders and find inactive users', async () => {
    // Create a bag
    const resBag = await request(app)
      .post('/api/bags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ store_id: storeId, price: 3.00, original_price: 10.00, quantity: 1, pickup_time: '18:00' });
    const bagId = resBag.body.id;

    // Active customer places order
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ id: bagId, type: 'bag', quantity: 1, price: 3.00 }]
      });

    // SuperAdmin triggers inactivity reminders
    const resReminders = await request(app)
      .post('/api/superadmin/trigger-inactivity-reminders')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send();

    expect(resReminders.statusCode).toEqual(200);
    expect(resReminders.body.count).toBeGreaterThanOrEqual(1);
  });

  it('should restrict trigger-inactivity-reminders endpoint to SuperAdmin only', async () => {
    const res = await request(app)
      .post('/api/superadmin/trigger-inactivity-reminders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send();
    expect(res.statusCode).toEqual(403);
  });
});

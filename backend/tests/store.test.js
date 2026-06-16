const request = require('supertest');
const app = require('../src/index');
const { db } = require('../src/db');

describe('Store Location Features API', () => {
  let adminToken;
  let testStoreId;

  beforeAll(async () => {
    // Register superadmin to get token for tests
    db.prepare('DELETE FROM users WHERE email = ?').run('testadmin@alpha-devs.cloud');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Admin', email: 'testadmin@alpha-devs.cloud', password: 'password', role: 'SuperAdmin' });
    
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testadmin@alpha-devs.cloud', password: 'password' });
    
    adminToken = loginRes.body.token;
  });

  afterAll(() => {
    if (testStoreId) {
      db.prepare('DELETE FROM stores WHERE id = ?').run(testStoreId);
    }
    db.prepare('DELETE FROM users WHERE email = ?').run('testadmin@alpha-devs.cloud');
  });

  it('should fail to create a store without latitude and longitude', async () => {
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Store', address: '123 Test St' });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Latitude and Longitude are required');
  });

  it('should create a store with valid latitude and longitude', async () => {
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Store Location', address: '123 Test St', lat: 40.7128, lng: -74.0060 });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.name).toEqual('Test Store Location');
    expect(res.body.lat).toEqual(40.7128);
    expect(res.body.lng).toEqual(-74.0060);
    expect(res.body.is_active).toEqual(1);
    testStoreId = res.body.id;
  });

  it('should update store location and toggle availability', async () => {
    const res = await request(app)
      .put(`/api/stores/${testStoreId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: 0, lat: 41.0, lng: -75.0 });
    
    expect(res.statusCode).toEqual(200);

    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(testStoreId);
    expect(store.is_active).toEqual(0);
    expect(store.lat).toEqual(41.0);
    expect(store.lng).toEqual(-75.0);
  });

  it('should return 404 when updating non-existent store', async () => {
    const res = await request(app)
      .put('/api/stores/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: 0 });
    
    expect(res.statusCode).toEqual(404);
  });
});

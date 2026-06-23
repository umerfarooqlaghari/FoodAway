const hasTestDb = !!process.env.TEST_DATABASE_URL;

if (!hasTestDb) {
  describe.skip('Auth subdomain integration', () => {
    it('requires TEST_DATABASE_URL', () => {});
  });
} else {
  const request = require('supertest');
  const app = require('../src/index');
  const { db, initDB } = require('../src/db');

  describe('Auth subdomain integration', () => {
    let sellerEmail;
    let sellerPassword;
    let sellerSubdomain;

    beforeAll(async () => {
      await db.exec('TRUNCATE TABLE favorites, chat_messages, reviews, orders, food_items, surprise_bags, stores, users RESTART IDENTITY CASCADE');
      await initDB();
    });

    it('registers a seller with subdomain and store URL', async () => {
      sellerEmail = `seller-${Date.now()}@example.com`;
      sellerPassword = 'password123';
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          brand_name: 'Test KFC',
          email: sellerEmail,
          password: sellerPassword,
          phone: '+440000000000',
          role: 'SellersAdmin',
          subdomain: 'test-kfc',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.subdomain).toBe('test-kfc');
      expect(res.body.storeUrl).toContain('test-kfc');
      expect(res.body.loginUrl).toContain('/login');
      sellerSubdomain = res.body.subdomain;
    });

    it('rejects duplicate subdomain registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          brand_name: 'Other Brand',
          email: `other-${Date.now()}@example.com`,
          password: 'password123',
          phone: '+440000000001',
          role: 'SellersAdmin',
          subdomain: 'test-kfc',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/already taken/i);
    });

    it('blocks seller login on main site without subdomain context', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: sellerEmail, password: sellerPassword });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/store portal/i);
      expect(res.body.storeUrl).toBeTruthy();
      expect(res.body.subdomain).toBe('test-kfc');
    });

    it('allows seller login on matching tenant subdomain', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', sellerSubdomain)
        .send({ email: sellerEmail, password: sellerPassword });

      expect(res.statusCode).toBe(200);
      expect(res.body.user.subdomain).toBe('test-kfc');
      expect(res.body.user.storeUrl).toContain('test-kfc');
    });

    it('allows seller login from Grabengo mobile app without subdomain', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Grabengo-Client', 'mobile')
        .send({ email: sellerEmail, password: sellerPassword });

      expect(res.statusCode).toBe(200);
      expect(res.body.user.role).toBe('SellersAdmin');
      expect(res.body.user.subdomain).toBe('test-kfc');
    });

    it('blocks seller login on wrong tenant subdomain', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'wrong-store')
        .send({ email: sellerEmail, password: sellerPassword });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/different store/i);
    });

    it('exposes public tenant branding by subdomain', async () => {
      const res = await request(app).get(`/api/public/tenant/${sellerSubdomain}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Test KFC');
      expect(res.body.subdomain).toBe('test-kfc');
    });

    it('returns 404 for unknown tenant subdomain', async () => {
      const res = await request(app).get('/api/public/tenant/no-such-store');
      expect(res.statusCode).toBe(404);
    });
  });
}

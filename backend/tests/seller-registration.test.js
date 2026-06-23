const hasTestDb = !!process.env.TEST_DATABASE_URL;

if (!hasTestDb) {
  describe.skip('Seller registration atomicity', () => {
    it('requires TEST_DATABASE_URL', () => {});
  });
} else {
  const request = require('supertest');
  const app = require('../src/index');
  const { db, initDB } = require('../src/db');
  const { createTenant } = require('../src/tenants');

  describe('Seller registration atomicity', () => {
    beforeAll(async () => {
      await db.exec('TRUNCATE TABLE favorites, chat_messages, reviews, orders, food_items, surprise_bags, stores, users, tenants RESTART IDENTITY CASCADE');
      await initDB();
    });

    it('does not leave orphan tenants when email already exists', async () => {
      const email = `dup-seller-${Date.now()}@example.com`;
      const first = await request(app)
        .post('/api/auth/register')
        .send({
          brand_name: 'Melbrew',
          email,
          password: 'password123',
          phone: '+440000000000',
          role: 'SellersAdmin',
        });
      expect(first.statusCode).toBe(201);
      expect(first.body.subdomain).toBe('melbrew');

      const duplicate = await request(app)
        .post('/api/auth/register')
        .send({
          brand_name: 'Melbrew Retry',
          email,
          password: 'password123',
          phone: '+440000000001',
          role: 'SellersAdmin',
        });
      expect(duplicate.statusCode).toBe(400);
      expect(duplicate.body.error).toBe('Email already exists');

      const tenants = await db.prepare(
        'SELECT subdomain FROM tenants WHERE name IN (?, ?) ORDER BY subdomain'
      ).all('Melbrew', 'Melbrew Retry');
      expect(tenants).toEqual([{ subdomain: 'melbrew' }]);
    });

    it('reclaims subdomain from orphan tenant on next successful registration', async () => {
      const orphan = await createTenant(db, {
        name: 'Ghost Brand',
        subdomain: 'ghost-brand',
        logo: null,
        phone: null,
      });
      expect(orphan.id).toBeTruthy();

      const email = `ghost-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          brand_name: 'Ghost Brand',
          email,
          password: 'password123',
          phone: '+440000000002',
          role: 'SellersAdmin',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.subdomain).toBe('ghost-brand');

      const orphanRow = await db.prepare('SELECT id FROM tenants WHERE id = ?').get(orphan.id);
      expect(orphanRow).toBeUndefined();
    });
  });
}

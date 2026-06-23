#!/usr/bin/env node
/**
 * Integration checks for mobile seller login + public API smoke tests.
 * Uses the app's DATABASE_URL from backend/.env (not TEST_DATABASE_URL).
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/index');
const { db } = require('../src/db');

const ts = Date.now();
const sellerEmail = `seller-mobile-test-${ts}@example.com`;
const sellerPassword = 'TestPass123!';
const customerEmail = `customer-mobile-test-${ts}@example.com`;
let sellerSubdomain;
let sellerUserId;
let tenantId;

const results = [];
function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}
function assert(name, condition, detail) {
  (condition ? pass : fail)(name, detail);
}

async function setupSeller() {
  sellerSubdomain = `mobtest${String(ts).slice(-6)}`;
  const hashed = await bcrypt.hash(sellerPassword, 10);
  const tenant = await db.prepare(
    'INSERT INTO tenants (name, subdomain) VALUES (?, ?) RETURNING id'
  ).get('Mobile Test Brand', sellerSubdomain);
  tenantId = tenant.id;
  const user = await db.prepare(
    `INSERT INTO users (name, email, password, role, tenant_id, phone)
     VALUES (?, ?, ?, 'SellersAdmin', ?, '+440000000099') RETURNING id`
  ).get('Mobile Test Brand', sellerEmail, hashed, tenantId);
  sellerUserId = user.id;
}

async function cleanup() {
  if (!tenantId) return;
  await db.prepare('DELETE FROM food_items WHERE store_id IN (SELECT id FROM stores WHERE tenant_id = ?)').run(tenantId).catch(() => {});
  await db.prepare('DELETE FROM stores WHERE tenant_id = ?').run(tenantId).catch(() => {});
  if (sellerUserId) await db.prepare('DELETE FROM users WHERE id = ? OR tenant_id = ?').run(sellerUserId, tenantId).catch(() => {});
  await db.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId).catch(() => {});
}

async function main() {
  try {
    await setupSeller();

    // --- Seller login negative: no subdomain, no mobile header ---
    let r = await request(app).post('/api/auth/login').send({ email: sellerEmail, password: sellerPassword });
    assert('seller login blocked on web (no subdomain)', r.status === 403 && /store portal/i.test(r.body.error), `status=${r.status}`);

    // --- Seller login positive: mobile header ---
    r = await request(app)
      .post('/api/auth/login')
      .set('X-Grabengo-Client', 'mobile')
      .send({ email: sellerEmail, password: sellerPassword });
    assert('seller login allowed on mobile app', r.status === 200 && r.body.user.role === 'SellersAdmin', `status=${r.status}`);

    // --- Seller login negative: wrong subdomain even with mobile header ---
    r = await request(app)
      .post('/api/auth/login')
      .set('X-Grabengo-Client', 'mobile')
      .set('X-Tenant-Subdomain', 'wrong-store-xyz')
      .send({ email: sellerEmail, password: sellerPassword });
    assert('seller login blocked on wrong subdomain (mobile)', r.status === 403, `status=${r.status}`);

    // --- Seller login positive: matching subdomain (store portal) ---
    r = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Subdomain', sellerSubdomain)
      .send({ email: sellerEmail, password: sellerPassword });
    assert('seller login allowed on matching subdomain', r.status === 200, `status=${r.status}`);

    // --- Customer login unaffected ---
    const custHash = await bcrypt.hash('CustPass123!', 10);
    await db.prepare(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'Customers')`
    ).run('Mobile Test Customer', customerEmail, custHash);

    r = await request(app).post('/api/auth/login').send({ email: customerEmail, password: 'CustPass123!' });
    assert('customer login without headers', r.status === 200 && r.body.user.role === 'Customers', `status=${r.status}`);

    r = await request(app)
      .post('/api/auth/login')
      .set('X-Grabengo-Client', 'mobile')
      .send({ email: customerEmail, password: 'CustPass123!' });
    assert('customer login with mobile header', r.status === 200, `status=${r.status}`);

    // --- Wrong password ---
    r = await request(app)
      .post('/api/auth/login')
      .set('X-Grabengo-Client', 'mobile')
      .send({ email: sellerEmail, password: 'wrong' });
    assert('seller wrong password returns 401', r.status === 401, `status=${r.status}`);

    // --- Public tenants API ---
    r = await request(app).get('/api/public/tenants');
    assert('GET /api/public/tenants', r.status === 200 && Array.isArray(r.body), `status=${r.status}`);

    // --- Food items with category (products) ---
    const store = await db.prepare(
      'INSERT INTO stores (tenant_id, name, address) VALUES (?, ?, ?) RETURNING id'
    ).get(tenantId, 'Test Store', '1 Test St');
    await db.prepare(
      `INSERT INTO food_items (store_id, name, price, quantity, category) VALUES (?, ?, ?, ?, ?)`
    ).run(store.id, 'Organic Milk', 2.5, 5, 'Groceries');
    await db.prepare(
      `INSERT INTO food_items (store_id, name, price, quantity, category) VALUES (?, ?, ?, ?, ?)`
    ).run(store.id, 'Surprise Croissant', 1.5, 3, 'Bakery');

    r = await request(app).get(`/api/public/food-items?tenant_id=${tenantId}`);
    assert('GET public food-items by tenant', r.status === 200 && Array.isArray(r.body) && r.body.length >= 2, `status=${r.status} count=${r.body?.length}`);

    const groceries = r.body.filter((i) => i.category === 'Groceries');
    assert('public food-items include Groceries category', groceries.length === 1, `groceries=${groceries.length}`);

    await db.prepare('DELETE FROM food_items WHERE store_id = ?').run(store.id);
    await db.prepare('DELETE FROM stores WHERE id = ?').run(store.id);
    await db.prepare('DELETE FROM users WHERE email = ?').run(customerEmail);
  } finally {
    await db.prepare('DELETE FROM stores WHERE tenant_id = ?').run(tenantId).catch(() => {});
    await cleanup();
  }

  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} integration checks passed`);
  process.exit(results.every((x) => x.ok) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

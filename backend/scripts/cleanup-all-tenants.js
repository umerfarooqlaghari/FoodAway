/**
 * Remove all tenant brands and related data so live tenants can be onboarded fresh.
 * Preserves SuperAdmin accounts.
 *
 * Usage:
 *   node scripts/cleanup-all-tenants.js          # dry run (lists what would be deleted)
 *   node scripts/cleanup-all-tenants.js --confirm # execute cleanup
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db, initDB } = require('../src/db');

const CONFIRM = process.argv.includes('--confirm');

async function count(sql, params = []) {
  const row = await db.prepare(sql).get(...params);
  return Number(Object.values(row || {})[0] || 0);
}

async function run() {
  await initDB();

  const tenants = await db.prepare(
    `SELECT t.id, t.name, t.subdomain,
            (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.role = 'SellersAdmin' LIMIT 1) AS admin_email
     FROM tenants t ORDER BY t.id`
  ).all();

  const summary = {
    tenants: tenants.length,
    stores: await count('SELECT COUNT(*) FROM stores'),
    sellerUsers: await count(`SELECT COUNT(*) FROM users WHERE tenant_id IS NOT NULL OR role IN ('SellersAdmin', 'SellersStaff', 'Partner')`),
    customers: await count(`SELECT COUNT(*) FROM users WHERE role = 'Customers'`),
    orders: await count('SELECT COUNT(*) FROM orders'),
    superAdmins: await count(`SELECT COUNT(*) FROM users WHERE role = 'SuperAdmin'`),
  };

  console.log('\n=== Current platform data ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nTenants:');
  for (const t of tenants) {
    console.log(`  #${t.id}  ${t.name}  (${t.subdomain || 'no subdomain'})  admin: ${t.admin_email || '—'}`);
  }

  if (!CONFIRM) {
    console.log('\nDry run only. Re-run with --confirm to delete all tenants and related data.\n');
    process.exit(0);
  }

  console.log('\nDeleting tenant data…');

  await db.exec('DELETE FROM checkout_idempotency');
  await db.exec('DELETE FROM checkout_pending');
  await db.exec('DELETE FROM otps');
  await db.exec('DELETE FROM deliveries');
  await db.exec('DELETE FROM orders');
  await db.exec('DELETE FROM reviews');
  await db.exec('DELETE FROM chat_messages');
  await db.exec('DELETE FROM favorites');
  await db.exec('DELETE FROM food_items');
  await db.exec('DELETE FROM surprise_bags');
  await db.exec('DELETE FROM menu_items');
  await db.exec('DELETE FROM stores');
  await db.exec(`DELETE FROM users WHERE role IN ('SellersAdmin', 'SellersStaff', 'Partner') OR tenant_id IS NOT NULL`);
  await db.exec('DELETE FROM tenants');

  const after = {
    tenants: await count('SELECT COUNT(*) FROM tenants'),
    stores: await count('SELECT COUNT(*) FROM stores'),
    sellerUsers: await count(`SELECT COUNT(*) FROM users WHERE tenant_id IS NOT NULL OR role IN ('SellersAdmin', 'SellersStaff', 'Partner')`),
    superAdmins: await count(`SELECT COUNT(*) FROM users WHERE role = 'SuperAdmin'`),
    customers: await count(`SELECT COUNT(*) FROM users WHERE role = 'Customers'`),
  };

  console.log('\n=== After cleanup ===');
  console.log(JSON.stringify(after, null, 2));
  console.log('\nDone. SuperAdmin accounts preserved. Customer accounts preserved.\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});

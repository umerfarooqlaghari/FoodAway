/**
 * Seed "Won" pipeline tenants directly in DB.
 * Usage: node scripts/seed-won-tenants.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { db, initDB } = require('../src/db');
const { registerSellerAdmin } = require('../src/sellerRegistration');
const { tenantStoreUrl } = require('../src/config');

const TENANTS = [
  {
    brand_name: 'Fine Daily',
    email: 'finedaily@grabengo.store',
    phone: '03104261027',
    password: '123Fine Daily@!',
    contact: 'Imran Nawab',
    store_address: 'Site Area Karachi',
  },
  {
    brand_name: 'Froth Coffee',
    email: 'frothcoffee@grabengo.store',
    phone: '03028204461',
    password: '123Froth Coffee@!',
    contact: 'Shahmeer',
    store_address: 'Different locations all over Karachi',
  },
  {
    brand_name: 'Amoons',
    email: 'amoons@grabengo.store',
    phone: '03018963383',
    password: '123Amoons@!',
    contact: 'Mashal',
    store_address: 'DHA Karachi Phase VIII Zone A',
  },
  {
    brand_name: 'The Sunnah Kitchen (home based)',
    email: 'sunnahkitchen@grabengo.store',
    phone: '03346479597',
    password: '123The Sunnah Kitchen (home based)@!',
    contact: 'Female',
    store_address: 'Malir Cantt Karachi',
  },
];

async function main() {
  await initDB();
  console.log('\n=== Seeding Won tenants ===\n');

  for (const t of TENANTS) {
    try {
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(t.email);
      if (existing) {
        console.log(`⏭  ${t.brand_name} — email already exists (${t.email})`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(t.password, 10);
      const { tenantId, subdomain } = await registerSellerAdmin(db, {
        brandName: t.brand_name,
        email: t.email,
        hashedPassword,
        phone: t.phone,
        logoUrl: null,
      });

      const storeUrl = tenantStoreUrl(subdomain);
      console.log(`✅ ${t.brand_name}`);
      console.log(`   Email:     ${t.email}`);
      console.log(`   Password:  ${t.password}`);
      console.log(`   Phone:     ${t.phone}`);
      console.log(`   Contact:   ${t.contact}`);
      console.log(`   Address:   ${t.store_address} (pin location in dashboard)`);
      console.log(`   Subdomain: ${subdomain}`);
      console.log(`   Login:     ${storeUrl}/login`);
      console.log(`   Dashboard: ${storeUrl}/dashboard`);
      console.log('');
    } catch (err) {
      console.error(`❌ ${t.brand_name} — ${err.message}`);
    }
  }

  console.log('Done.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

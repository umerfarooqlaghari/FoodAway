require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db, initDB } = require('./src/db');
const { allocateUniqueSubdomain } = require('./src/subdomain');
const { createTenant } = require('./src/tenants');

const seedUsers = async () => {
  try {
    console.log('Initializing database schema (if not exists)...');
    await initDB();

    const salt = await bcrypt.genSalt(10);
    const standardHash = await bcrypt.hash('132VanDijk@!', salt);
    const superAdminHash = await bcrypt.hash('superadmin123', salt);

    const userStmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');

    try {
      await userStmt.run('Super Admin', 'superadmin@alpha-devs.cloud', superAdminHash, 'SuperAdmin');
      console.log('✅ SuperAdmin user seeded (superadmin@alpha-devs.cloud / superadmin123).');
    } catch (e) {
      console.log('SuperAdmin already exists or skipped:', e.message);
    }

    try {
      const brandName = 'Alpha Devs Restaurant';
      const subdomain = await allocateUniqueSubdomain(db, brandName);
      const tenant = await createTenant(db, { name: brandName, subdomain });
      await db.prepare(
        'INSERT INTO users (name, email, password, role, tenant_id) VALUES (?, ?, ?, ?, ?)'
      ).run(brandName, 'info@alpha-devs.cloud', standardHash, 'SellersAdmin', tenant.id);
      console.log('✅ Tenant + seller admin seeded (info@alpha-devs.cloud / 132VanDijk@!).');
    } catch (e) {
      console.log('Tenant already exists or skipped:', e.message);
    }

    try {
      await userStmt.run('Umer Farooq', 'umer.farooq@alpha-devs.cloud', standardHash, 'Customers');
      console.log('✅ Customer user seeded (umer.farooq@alpha-devs.cloud / 132VanDijk@!).');
    } catch (e) {
      console.log('Customer already exists or skipped:', e.message);
    }

    console.log('🎉 Seeding process completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  }
};

seedUsers();

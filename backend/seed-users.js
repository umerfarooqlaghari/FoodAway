require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db, initDB } = require('./src/db');

const seedUsers = async () => {
  try {
    // 1. Ensure the database tables are initialized/created first
    console.log('Initializing database schema (if not exists)...');
    await initDB();

    const salt = await bcrypt.genSalt(10);
    const standardHash = await bcrypt.hash('132VanDijk@!', salt);
    const superAdminHash = await bcrypt.hash('superadmin123', salt);

    const stmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');

    // 1. Seed SuperAdmin
    try {
      await stmt.run('Super Admin', 'superadmin@alpha-devs.cloud', superAdminHash, 'SuperAdmin');
      console.log('✅ SuperAdmin user seeded (superadmin@alpha-devs.cloud / superadmin123).');
    } catch (e) {
      console.log('SuperAdmin already exists or skipped:', e.message);
    }

    // 2. Seed Tenant (SellersAdmin)
    try {
      await stmt.run('Alpha Devs Restaurant', 'info@alpha-devs.cloud', standardHash, 'SellersAdmin');
      console.log('✅ Tenant user seeded (info@alpha-devs.cloud / 132VanDijk@!).');
    } catch (e) {
      console.log('Tenant already exists or skipped:', e.message);
    }

    // 3. Seed Customer
    try {
      await stmt.run('Umer Farooq', 'umer.farooq@alpha-devs.cloud', standardHash, 'Customers');
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

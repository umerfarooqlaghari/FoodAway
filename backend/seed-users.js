const bcrypt = require('bcryptjs');
const { db } = require('./src/db');

const seedUsers = async () => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('132VanDijk@!', salt);

    const stmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
    
    // Seed Restaurant
    try {
      stmt.run('Alpha Devs Restaurant', 'info@alpha-devs.cloud', hash, 'SellersAdmin');
      console.log('Restaurant user seeded.');
    } catch(e) { console.log('Restaurant already exists or error:', e.message); }

    // Seed Customer
    try {
      stmt.run('Umer Farooq', 'umer.farooq@alpha-devs.cloud', hash, 'Customers');
      console.log('Customer user seeded.');
    } catch(e) { console.log('Customer already exists or error:', e.message); }
    
  } catch (error) {
    console.error('Seeding failed:', error);
  }
};

seedUsers();

const { db } = require('./src/db');

// Add 20 random orders to test charting
try {
  // Assuming store_id 9 and bag_id 1 exist since we purged earlier and kept 9.
  // Actually, we can just insert some random orders tied to store 9.
  const bagId = 1; 
  const storeId = 9;
  const customerId = 1;
  const price = 4.99;

  for(let i=0; i<30; i++) {
    // Generate dates over the last 14 days
    const daysAgo = Math.floor(Math.random() * 14);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateString = date.toISOString();

    db.prepare('INSERT INTO orders (bag_id, store_id, customer_id, price, created_at) VALUES (?, ?, ?, ?, ?)').run(bagId, storeId, customerId, price, dateString);
  }
  
  console.log("Mock orders seeded successfully!");
} catch (e) {
  console.error("Failed to seed orders:", e.message);
}

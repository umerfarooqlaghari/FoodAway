/**
 * seed-demo.js
 * Creates demo accounts for app store review and testing.
 *
 * Usage:
 *   node seed-demo.js
 *
 * Accounts created:
 *   Seller  — testSeller@grabengo.store   / 123Grabengo@!
 *   Customer — testCustomer@grabengo.store / 123Grabengo@!
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db, initDB } = require('./src/db');
const { allocateUniqueSubdomain } = require('./src/subdomain');
const { createTenant, ensureTenantSubdomain } = require('./src/tenants');

const SELLER_EMAIL    = 'testSeller@grabengo.store';
const CUSTOMER_EMAIL  = 'testCustomer@grabengo.store';
const PASSWORD        = '123Grabengo@!';
const BRAND_NAME      = 'Grabengo Demo Kitchen';

// Central London demo locations
const DEMO_STORES = [
  {
    name: 'Grabengo Demo Kitchen — Soho',
    address: '45 Carnaby Street, Soho, London W1F 7DR',
    lat: 51.5137, lng: -0.1394,
  },
  {
    name: 'Grabengo Demo Kitchen — Shoreditch',
    address: '12 Brick Lane, Shoreditch, London E1 6RF',
    lat: 51.5219, lng: -0.0718,
  },
];

const FOOD_ITEMS = [
  { name: 'Sourdough Loaf',       description: 'Freshly baked sourdough, end-of-day surplus.',      price: 2.50, original_price: 5.00,  category: 'Bakery',    quantity: 8 },
  { name: 'Croissant Bundle (×4)', description: 'Four butter croissants from the morning batch.',     price: 3.00, original_price: 7.00,  category: 'Bakery',    quantity: 6 },
  { name: 'Veggie Pasta Box',      description: 'Roasted veg penne with pesto. Serve hot or cold.',  price: 4.50, original_price: 9.00,  category: 'Meals',     quantity: 5 },
  { name: 'Chicken Wrap',          description: 'Grilled chicken, lettuce, sriracha mayo.',           price: 3.99, original_price: 7.50,  category: 'Meals',     quantity: 7 },
  { name: 'Fruit Salad Cup',       description: 'Seasonal mixed fruit, freshly cut today.',          price: 2.00, original_price: 4.50,  category: 'Snacks',    quantity: 10 },
  { name: 'Cheese & Chutney Sandwich', description: 'Mature cheddar and caramelised onion chutney.', price: 2.75, original_price: 5.50, category: 'Snacks',    quantity: 8 },
  { name: 'Mushroom Risotto',      description: 'Arborio rice, wild mushrooms, parmesan.',           price: 5.00, original_price: 10.00, category: 'Meals',     quantity: 4 },
  { name: 'Cinnamon Roll',         description: 'Soft, iced cinnamon roll. One left today!',         price: 1.50, original_price: 3.50,  category: 'Bakery',    quantity: 3 },
  { name: 'Green Smoothie',        description: 'Spinach, banana, oat milk. Fresh batch.',           price: 2.50, original_price: 5.00,  category: 'Drinks',    quantity: 6 },
  { name: 'Mixed Sushi Box (8 pcs)', description: 'Chef selection sushi, made this morning.',       price: 5.50, original_price: 12.00, category: 'Meals',     quantity: 4 },
];

const SURPRISE_BAGS = [
  {
    description: 'Bakery Rescue Bag — a surprise mix of breads, pastries, and sweet treats from today\'s bake.',
    price: 3.99, original_price: 12.00, quantity: 5,
    pickup_time: 'Mon-Fri 17:00-19:00, Sat-Sun 16:00-18:00',
  },
  {
    description: 'Chef\'s Meal Bag — hot or cold mains, sides, and a dessert. Contents vary daily.',
    price: 5.99, original_price: 18.00, quantity: 3,
    pickup_time: 'Mon-Sun 20:00-21:30',
  },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function upsertUser({ name, email, password, role, tenant_id }) {
  const existing = await db.prepare('SELECT id FROM users WHERE email = $1').get(email);
  if (existing) {
    console.log(`  ↳ user already exists: ${email}`);
    return existing.id;
  }
  const hash = await bcrypt.hash(password, 10);
  const cols = tenant_id != null
    ? 'name, email, password, role, tenant_id'
    : 'name, email, password, role';
  const vals = tenant_id != null
    ? `$1, $2, $3, $4, $5`
    : `$1, $2, $3, $4`;
  const args = tenant_id != null
    ? [name, email, hash, role, tenant_id]
    : [name, email, hash, role];
  const result = await db.prepare(
    `INSERT INTO users (${cols}) VALUES (${vals}) RETURNING id`
  ).run(...args);
  return result.lastInsertRowid;
}

async function main() {
  console.log('🌱 Initialising schema…');
  await initDB();

  // ── 1. Tenant ────────────────────────────────────────────────────────────
  console.log('\n📦 Creating demo tenant…');
  let tenant;
  const existing = await db.prepare("SELECT id, name, subdomain FROM tenants WHERE name = $1").get(BRAND_NAME);
  if (existing) {
    tenant = existing;
    console.log(`  ↳ tenant already exists: id=${tenant.id}, subdomain=${tenant.subdomain || '(none yet)'}`);
  } else {
    tenant = await createTenant(db, { name: BRAND_NAME });
    console.log(`  ✅ tenant created: id=${tenant.id}`);
  }

  // Always ensure the tenant has a subdomain — needed for web portal access
  if (!tenant.subdomain) {
    const subdomain = await ensureTenantSubdomain(db, tenant);
    console.log(`  ✅ subdomain allocated: ${subdomain}`);
  } else {
    console.log(`  ✅ subdomain: ${tenant.subdomain}`);
  }

  // ── 2. Seller ─────────────────────────────────────────────────────────────
  console.log('\n👤 Creating seller account…');
  const sellerId = await upsertUser({
    name: 'Demo Seller',
    email: SELLER_EMAIL,
    password: PASSWORD,
    role: 'SellersAdmin',
    tenant_id: tenant.id,
  });
  console.log(`  ✅ seller: ${SELLER_EMAIL} (id=${sellerId})`);

  // ── 3. Customer ───────────────────────────────────────────────────────────
  console.log('\n👤 Creating customer account…');
  const customerId = await upsertUser({
    name: 'Demo Customer',
    email: CUSTOMER_EMAIL,
    password: PASSWORD,
    role: 'Customers',
  });
  console.log(`  ✅ customer: ${CUSTOMER_EMAIL} (id=${customerId})`);

  // ── 4. Stores ─────────────────────────────────────────────────────────────
  console.log('\n🏪 Creating demo stores…');
  const storeIds = [];
  for (const s of DEMO_STORES) {
    const ex = await db.prepare(
      "SELECT id FROM stores WHERE name = $1 AND tenant_id = $2"
    ).get(s.name, tenant.id);
    if (ex) {
      storeIds.push(ex.id);
      console.log(`  ↳ store already exists: "${s.name}" (id=${ex.id})`);
    } else {
      const r = await db.prepare(
        `INSERT INTO stores (tenant_id, name, address, lat, lng, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`
      ).run(tenant.id, s.name, s.address, s.lat, s.lng);
      storeIds.push(r.lastInsertRowid);
      console.log(`  ✅ store created: "${s.name}" (id=${r.lastInsertRowid})`);
    }
  }

  // ── 5. Food items ─────────────────────────────────────────────────────────
  console.log('\n🍽  Creating food items…');
  const foodItemIds = [];
  for (const item of FOOD_ITEMS) {
    const ex = await db.prepare(
      "SELECT id FROM food_items WHERE name = $1 AND store_id = $2"
    ).get(item.name, storeIds[0]);
    if (ex) {
      foodItemIds.push(ex.id);
      console.log(`  ↳ item already exists: "${item.name}"`);
    } else {
      const r = await db.prepare(
        `INSERT INTO food_items (store_id, name, description, price, original_price, quantity, category, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING id`
      ).run(storeIds[0], item.name, item.description, item.price, item.original_price, item.quantity, item.category);
      foodItemIds.push(r.lastInsertRowid);
      console.log(`  ✅ food item: "${item.name}" £${item.price}`);
    }
  }

  // ── 6. Surprise bags ──────────────────────────────────────────────────────
  console.log('\n🎁 Creating surprise bags…');
  const bagIds = [];
  for (const bag of SURPRISE_BAGS) {
    const ex = await db.prepare(
      "SELECT id FROM surprise_bags WHERE store_id = $1 AND description = $2"
    ).get(storeIds[0], bag.description);
    if (ex) {
      bagIds.push(ex.id);
      console.log(`  ↳ bag already exists (id=${ex.id})`);
    } else {
      const r = await db.prepare(
        `INSERT INTO surprise_bags (store_id, price, original_price, description, quantity, pickup_time)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
      ).run(storeIds[0], bag.price, bag.original_price, bag.description, bag.quantity, bag.pickup_time);
      bagIds.push(r.lastInsertRowid);
      console.log(`  ✅ bag: £${bag.price} (id=${r.lastInsertRowid})`);
    }
  }

  // ── 7. Orders ─────────────────────────────────────────────────────────────
  console.log('\n📦 Seeding sample orders for customer…');
  const existingOrders = await db.prepare(
    "SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = $1"
  ).get(customerId);
  if (Number(existingOrders?.cnt) > 0) {
    console.log(`  ↳ orders already seeded for customer ${customerId}`);
  } else {
    for (let i = 0; i < 12; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const bagId = bagIds[i % bagIds.length];
      const foodId = foodItemIds[i % foodItemIds.length];
      const useFood = i % 3 === 0; // mix bags and food items
      await db.prepare(
        `INSERT INTO orders (bag_id, food_item_id, type, store_id, customer_id, price, payment_method, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
      ).run(
        useFood ? null : bagId,
        useFood ? foodId : null,
        useFood ? 'food_item' : 'bag',
        storeIds[0],
        customerId,
        useFood ? FOOD_ITEMS[i % FOOD_ITEMS.length].price : SURPRISE_BAGS[i % SURPRISE_BAGS.length].price,
        ['Card', 'Apple Pay', 'Google Pay'][i % 3],
        date.toISOString()
      );
    }
    console.log('  ✅ 12 sample orders created');
  }

  // ── 8. Reviews ────────────────────────────────────────────────────────────
  console.log('\n⭐ Seeding store reviews…');
  const REVIEWS = [
    { rating: 5, comment: 'Amazing value — fresh croissants for almost nothing!', tags: '["Fresh","Great value","Friendly staff"]' },
    { rating: 5, comment: 'Love this initiative. The meal bag was genuinely delicious.', tags: '["Delicious","Eco-friendly","Generous portion"]' },
    { rating: 4, comment: 'Good selection today, picked up a pasta box and a smoothie. Will be back.', tags: '["Fresh","Good variety"]' },
    { rating: 5, comment: 'Sourdough loaf was still warm. Incredible deal.', tags: '["Fresh","Great value"]' },
    { rating: 4, comment: 'Slight wait at pickup but totally worth it for the quality.', tags: '["Good value","Fresh"]' },
  ];
  const existingReview = await db.prepare(
    "SELECT id FROM reviews WHERE store_id = $1 LIMIT 1"
  ).get(storeIds[0]);
  if (existingReview) {
    console.log('  ↳ reviews already seeded');
  } else {
    for (const r of REVIEWS) {
      const daysAgo = Math.floor(Math.random() * 20);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      await db.prepare(
        `INSERT INTO reviews (store_id, customer_id, rating, comment, tags, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`
      ).run(storeIds[0], customerId, r.rating, r.comment, r.tags, date.toISOString());
    }
    console.log('  ✅ 5 reviews seeded');
  }

  console.log(`
╔══════════════════════════════════════════════════════════╗
║           🎉  Demo seed complete!                        ║
╠══════════════════════════════════════════════════════════╣
║  SELLER   testSeller@grabengo.store  / 123Grabengo@!     ║
║  CUSTOMER testCustomer@grabengo.store / 123Grabengo@!    ║
╠══════════════════════════════════════════════════════════╣
║  Stores:  ${DEMO_STORES.length} (London — Soho + Shoreditch)               ║
║  Items:   ${FOOD_ITEMS.length} food items, ${SURPRISE_BAGS.length} surprise bags                    ║
║  Orders:  12 historical orders for customer              ║
║  Reviews: 5 store reviews                                ║
╠══════════════════════════════════════════════════════════╣
║  Web portal: https://${tenant.subdomain}.grabengo.store/shop
╚══════════════════════════════════════════════════════════╝
`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});

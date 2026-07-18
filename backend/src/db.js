const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

const isTest = process.env.NODE_ENV === 'test';

// In test mode: require TEST_DATABASE_URL so production is never touched
if (isTest && !process.env.TEST_DATABASE_URL) {
  throw new Error(
    '\n\n⛔  BLOCKED: Tests require TEST_DATABASE_URL to be set.\n' +
    '   Never point tests at DATABASE_URL — test setup drops all tables.\n' +
    '   Create a separate PostgreSQL database and set TEST_DATABASE_URL.\n'
  );
}

const dbUrl = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const transactionStorage = new AsyncLocalStorage();

const pgPool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

// Idle clients can drop their TLS connection (remote DB restarts, network blips).
// Without this handler the 'error' event is unhandled and crashes the process.
pgPool.on('error', (err) => {
  console.error('Postgres pool idle-client error (recovered):', err.message);
});

class AsyncPostgresDB {
  constructor(pool) {
    this.pool = pool;
  }

  async exec(sql) {
    const client = transactionStorage.getStore() || this.pool;
    await client.query(sql);
  }

  prepare(sql) {
    let pgSql = sql;
    let index = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${index++}`);

    // Tables with non-id primary keys must not get RETURNING id
    const INSERT_TABLES_WITHOUT_ID = new Set(['checkout_idempotency', 'favorites']);
    if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
      const tableMatch = pgSql.match(/INSERT\s+INTO\s+([^\s(]+)/i);
      const tableName = tableMatch?.[1]?.replace(/"/g, '').toLowerCase();
      if (!tableName || !INSERT_TABLES_WITHOUT_ID.has(tableName)) {
        pgSql += ' RETURNING id';
      }
    }

    return {
      run: async (...params) => {
        const client = transactionStorage.getStore() || this.pool;
        const res = await client.query(pgSql, params);
        return {
          lastInsertRowid: res.rows[0]?.id || null,
          changes: res.rowCount
        };
      },
      get: async (...params) => {
        const client = transactionStorage.getStore() || this.pool;
        const res = await client.query(pgSql, params);
        return res.rows[0];
      },
      all: async (...params) => {
        const client = transactionStorage.getStore() || this.pool;
        const res = await client.query(pgSql, params);
        return res.rows;
      }
    };
  }

  transaction(fn) {
    return async (...args) => {
      const outerClient = transactionStorage.getStore();
      if (outerClient) {
        return await fn(...args);
      }
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await transactionStorage.run(client, async () => {
          return await fn(...args);
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    };
  }
}

const db = new AsyncPostgresDB(pgPool);

const initDB = async () => {
  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      subdomain TEXT,
      logo TEXT,
      phone TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Customers',
      refresh_token TEXT,
      tenant_id INTEGER,
      logo TEXT,
      push_token TEXT,
      phone TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      name TEXT NOT NULL,
      address TEXT,
      lat REAL DEFAULT 0,
      lng REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS surprise_bags (
      id SERIAL PRIMARY KEY,
      store_id INTEGER,
      price REAL NOT NULL,
      original_price REAL,
      description TEXT,
      images TEXT,
      quantity INTEGER DEFAULT 1,
      pickup_time TEXT,
      FOREIGN KEY (store_id) REFERENCES stores (id)
    );

    CREATE TABLE IF NOT EXISTS food_items (
      id SERIAL PRIMARY KEY,
      store_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      original_price REAL,
      images TEXT,
      quantity INTEGER DEFAULT 1,
      category TEXT DEFAULT 'Other',
      is_available BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores (id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      bag_id INTEGER,
      food_item_id INTEGER,
      type TEXT DEFAULT 'bag',
      quantity INTEGER DEFAULT 1,
      store_id INTEGER,
      customer_id INTEGER,
      price REAL,
      payment_method TEXT DEFAULT 'Card',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bag_id) REFERENCES surprise_bags (id),
      FOREIGN KEY (food_item_id) REFERENCES food_items (id),
      FOREIGN KEY (store_id) REFERENCES stores (id),
      FOREIGN KEY (customer_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      store_id INTEGER,
      customer_id INTEGER,
      rating INTEGER NOT NULL,
      comment TEXT,
      tags TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores (id),
      FOREIGN KEY (customer_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS app_reviews (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      store_id INTEGER,
      customer_id INTEGER,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores (id),
      FOREIGN KEY (customer_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, store_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otps (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkout_pending (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      otp TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      confirmed_result TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checkout_idempotency (
      idempotency_key TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try { await db.exec("ALTER TABLE checkout_pending ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'"); } catch (e) {}
  try { await db.exec("ALTER TABLE checkout_pending ADD COLUMN IF NOT EXISTS confirmed_result TEXT"); } catch (e) {}
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS checkout_idempotency (
        idempotency_key TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {}

  // Column migrations — safe to run repeatedly
  try { await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS logo TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS image TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS lat REAL DEFAULT 0"); } catch (e) {}
  try { await db.exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS lng REAL DEFAULT 0"); } catch (e) {}
  try { await db.exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"); } catch (e) {}
  try { await db.exec("ALTER TABLE surprise_bags ADD COLUMN IF NOT EXISTS original_price REAL"); } catch (e) {}
  try { await db.exec("ALTER TABLE food_items ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ"); } catch (e) {}
  // Old seed data wrote type 'food_item'; the app convention is 'food' (joins depend on it)
  try { await db.exec("UPDATE orders SET type = 'food' WHERE type = 'food_item'"); } catch (e) {}
  try { await db.exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT FALSE"); } catch (e) {}
  try { await db.exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_fee_note TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS category TEXT"); } catch (e) {}
  try {
    await db.exec("UPDATE stores SET category = 'Bakeries' WHERE category IS NULL AND (LOWER(name) LIKE '%bakery%' OR LOWER(name) LIKE '%bake%')");
    await db.exec("UPDATE stores SET category = 'Cafes' WHERE category IS NULL AND (LOWER(name) LIKE '%cafe%' OR LOWER(name) LIKE '%coffee%')");
    await db.exec("UPDATE stores SET category = 'Grocery Store' WHERE category IS NULL AND (LOWER(name) LIKE '%grocery%' OR LOWER(name) LIKE '%mart%' OR LOWER(name) LIKE '%supermarket%')");
    await db.exec("UPDATE stores SET category = 'Restaurants' WHERE category IS NULL AND (LOWER(name) LIKE '%kfc%' OR LOWER(name) LIKE '%restaurant%' OR LOWER(name) LIKE '%kitchen%' OR LOWER(name) LIKE '%grabengo%' OR LOWER(name) LIKE '%delivery%' OR LOWER(name) LIKE '%senzo%')");
    await db.exec("UPDATE stores SET category = 'Restaurants' WHERE category IS NULL");
  } catch (e) {}
  try { await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_address TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'pickup'"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_phone TEXT"); } catch (e) {}
  try {
    const statusColExists = await db.prepare(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status'"
    ).get();
    if (!statusColExists) {
      await db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'");
      // Orders placed before this column existed already happened — treat them as settled
      // so historical revenue/units-sold stats don't vanish. Only new orders start 'pending'.
      await db.exec("UPDATE orders SET status = 'paid'");
    }
  } catch (e) {}
  try { await db.exec("ALTER TABLE surprise_bags ADD COLUMN IF NOT EXISTS description TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE surprise_bags ADD COLUMN IF NOT EXISTS images TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS food_item_id INTEGER REFERENCES food_items(id)"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Card'"); } catch (e) {}
  try { await db.exec("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]'"); } catch (e) {}
  try { await db.exec("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE"); } catch (e) {}

  // ── Partner delivery system ──
  // delivery_mode: 'self' (store delivers, current flow) | 'partner' (Grabengo partner fleet).
  // Backfilled from delivery_enabled so existing delivery stores keep working as self-delivery.
  try { await db.exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_mode TEXT"); } catch (e) {}
  try { await db.exec("UPDATE stores SET delivery_mode = 'self' WHERE delivery_mode IS NULL AND delivery_enabled = TRUE"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat REAL"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng REAL"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_id INTEGER"); } catch (e) {}
  // Rider duty state lives on the user row (role = 'Partner')
  try { await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_on_duty BOOLEAN DEFAULT FALSE"); } catch (e) {}
  try { await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS duty_lat REAL"); } catch (e) {}
  try { await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS duty_lng REAL"); } catch (e) {}
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        store_id INTEGER,
        customer_id INTEGER,
        partner_id INTEGER,
        status TEXT DEFAULT 'awaiting_confirmation',
        fail_reason TEXT,
        address TEXT,
        lat REAL,
        lng REAL,
        distance_km REAL,
        fee REAL,
        cod_amount REAL,
        pin TEXT,
        prep_minutes INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dispatched_at TIMESTAMP,
        assigned_at TIMESTAMP,
        picked_up_at TIMESTAMP,
        delivered_at TIMESTAMP
      );
    `);
  } catch (e) {}

  // ── Grabengo Deals: persistent vendor menu + time-boxed discounts ──
  // menu_items = always-orderable catalog (no stock cap, no expiry).
  // food_items continues to be the "deal" engine (price/original_price/quantity/expiry) —
  // a deal is a food_items row denormalized from a menu_item at creation time.
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        store_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'Other',
        price REAL NOT NULL,
        image TEXT,
        is_hidden BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores (id)
      );
    `);
  } catch (e) {}
  try { await db.exec("ALTER TABLE food_items ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL"); } catch (e) {}
  try { await db.exec("ALTER TABLE food_items ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ"); } catch (e) {}

  // One-time backfill: give every pre-existing food_items row a menu_items twin so it's
  // browsable in the always-on menu, not just while its (possibly expired) sale lasts.
  try {
    const orphans = await db.prepare('SELECT * FROM food_items WHERE menu_item_id IS NULL').all();
    for (const item of orphans) {
      const normalPrice = item.original_price || item.price;
      let firstImage = null;
      try {
        const parsed = item.images ? JSON.parse(item.images) : null;
        if (Array.isArray(parsed) && parsed.length) firstImage = parsed[0];
      } catch (e) {}
      const menuInfo = await db.prepare(
        'INSERT INTO menu_items (store_id, name, description, category, price, image, is_hidden) VALUES (?, ?, ?, ?, ?, ?, FALSE)'
      ).run(item.store_id, item.name, item.description, item.category, normalPrice, firstImage);
      await db.prepare('UPDATE food_items SET menu_item_id = ? WHERE id = ?').run(menuInfo.lastInsertRowid, item.id);
    }
    if (orphans.length) console.log(`Backfilled ${orphans.length} legacy food_items into menu_items`);
  } catch (e) { console.error('menu_items backfill failed:', e.message); }

  await migrateToTenantsTable(db);

  // Pre-populate random locations for stores missing coordinates
  await db.exec(`
    UPDATE stores
    SET lat = 51.5074 + RANDOM() * 0.1,
        lng = -0.1278 + RANDOM() * 0.1
    WHERE lat = 0 AND lng = 0
  `);

  console.log('Database initialized successfully in postgres mode.');
};

async function migrateToTenantsTable(db) {
  try { await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS subdomain TEXT"); } catch (e) {}

  try {
    await db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS tenants_subdomain_unique
      ON tenants (subdomain)
      WHERE subdomain IS NOT NULL AND subdomain <> ''
    `);
  } catch (e) {}

  // Backfill tenant rows from legacy SellersAdmin users (preserve ids for existing store FKs)
  await db.exec(`
    INSERT INTO tenants (id, name, subdomain, logo, phone, created_at)
    SELECT u.id, u.name, u.subdomain, u.logo, u.phone, u.created_at
    FROM users u
    WHERE u.role = 'SellersAdmin'
      AND u.tenant_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = u.id)
  `);

  try {
    await db.exec(`
      SELECT setval(
        pg_get_serial_sequence('tenants', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM tenants), 1), 1),
        true
      )
    `);
  } catch (e) {}

  // Point seller users at tenant rows
  await db.exec(`
    UPDATE users u
    SET tenant_id = t.id
    FROM tenants t
    WHERE u.role = 'SellersAdmin'
      AND t.id = u.id
      AND (u.tenant_id IS NULL OR u.tenant_id = u.id)
  `);

  // Staff users: tenant_id was admin user id (= tenant id after backfill)
  await db.exec(`
    UPDATE users staff
    SET tenant_id = t.id
    FROM users admin
    JOIN tenants t ON t.id = admin.id
    WHERE staff.role = 'SellersStaff'
      AND admin.role = 'SellersAdmin'
      AND staff.tenant_id = admin.id
      AND staff.tenant_id IS DISTINCT FROM t.id
  `);

  // Stores already reference admin user ids; those match tenant ids after backfill
  await db.exec(`
    UPDATE stores s
    SET tenant_id = t.id
    FROM tenants t
    WHERE s.tenant_id = t.id
      AND NOT EXISTS (SELECT 1 FROM tenants WHERE id = s.tenant_id)
  `);

  try { await db.exec('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_fkey'); } catch (e) {}
  try { await db.exec('ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_tenant_id_fkey'); } catch (e) {}
  try {
    await db.exec(`
      ALTER TABLE users
      ADD CONSTRAINT users_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    `);
  } catch (e) {}
  try {
    await db.exec(`
      ALTER TABLE stores
      ADD CONSTRAINT stores_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    `);
  } catch (e) {}

  try { await db.exec('DROP INDEX IF EXISTS users_subdomain_unique'); } catch (e) {}

  const { backfillTenantSubdomains, shortenTenantSubdomains } = require('./subdomain');
  await backfillTenantSubdomains(db);
  await shortenTenantSubdomains(db);
}

module.exports = { db, initDB };

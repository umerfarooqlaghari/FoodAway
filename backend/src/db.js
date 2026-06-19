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

    if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES users (id)
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES users (id)
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
  try { await db.exec("ALTER TABLE surprise_bags ADD COLUMN IF NOT EXISTS description TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE surprise_bags ADD COLUMN IF NOT EXISTS images TEXT"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS food_item_id INTEGER REFERENCES food_items(id)"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1"); } catch (e) {}
  try { await db.exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Card'"); } catch (e) {}
  try { await db.exec("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]'"); } catch (e) {}
  try { await db.exec("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE"); } catch (e) {}

  // Pre-populate random locations for stores missing coordinates
  await db.exec(`
    UPDATE stores
    SET lat = 51.5074 + RANDOM() * 0.1,
        lng = -0.1278 + RANDOM() * 0.1
    WHERE lat = 0 AND lng = 0
  `);

  console.log('Database initialized successfully in postgres mode.');
};

module.exports = { db, initDB };

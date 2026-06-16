const Database = require('better-sqlite3');
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');

const isTest = process.env.NODE_ENV === 'test';
const dbUrl = process.env.DATABASE_URL;

// Thread-safe transaction client storage for PostgreSQL
const transactionStorage = new AsyncLocalStorage();

let dbInstance = null;
let mode = 'sqlite';

if (dbUrl && !isTest) {
  mode = 'postgres';
  const pgPool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
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
      // 1. Translate SQLite '?' placeholders to PostgreSQL '$1', '$2', ...
      let pgSql = sql;
      let index = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${index++}`);

      // 2. Automatically append RETURNING id for PostgreSQL INSERT queries
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
          // Re-use outer transaction client if nested
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

  dbInstance = new AsyncPostgresDB(pgPool);
} else {
  mode = 'sqlite';
  const dbPath = isTest ? ':memory:' : (process.env.DATABASE_PATH || path.resolve(__dirname, '../takeaway.db'));
  const rawDb = new Database(dbPath, { verbose: isTest ? null : console.log });

  class AsyncSQLiteDB {
    constructor(db) {
      this.db = db;
    }

    async exec(sql) {
      this.db.exec(sql);
    }

    prepare(sql) {
      const stmt = this.db.prepare(sql);
      return {
        run: async (...params) => stmt.run(...params),
        get: async (...params) => stmt.get(...params),
        all: async (...params) => stmt.all(...params)
      };
    }

    transaction(fn) {
      const txn = this.db.transaction(fn);
      return async (...args) => txn(...args);
    }
  }

  dbInstance = new AsyncSQLiteDB(rawDb);
}

// Initialize database schemas
const initDB = async () => {
  if (mode === 'postgres') {
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'Customers',
        refresh_token TEXT,
        tenant_id INTEGER,
        logo TEXT,
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
    `);

    // Pre-populate random locations for Postgres
    await dbInstance.exec(`
      UPDATE stores 
      SET lat = 51.5074 + RANDOM() * 0.1, 
          lng = -0.1278 + RANDOM() * 0.1 
      WHERE lat = 0 AND lng = 0
    `);
  } else {
    // SQLite mode
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'Customers',
        refresh_token TEXT,
        tenant_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        name TEXT NOT NULL,
        address TEXT,
        lat REAL DEFAULT 0,
        lng REAL DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS surprise_bags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        original_price REAL,
        images TEXT,
        quantity INTEGER DEFAULT 1,
        category TEXT DEFAULT 'Other',
        is_available BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores (id)
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bag_id INTEGER,
        food_item_id INTEGER,
        type TEXT DEFAULT 'bag',
        quantity INTEGER DEFAULT 1,
        store_id INTEGER,
        customer_id INTEGER,
        price REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bag_id) REFERENCES surprise_bags (id),
        FOREIGN KEY (food_item_id) REFERENCES food_items (id),
        FOREIGN KEY (store_id) REFERENCES stores (id),
        FOREIGN KEY (customer_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER,
        customer_id INTEGER,
        rating INTEGER NOT NULL,
        comment TEXT,
        tags TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores (id),
        FOREIGN KEY (customer_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS app_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER,
        customer_id INTEGER,
        sender_role TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores (id),
        FOREIGN KEY (customer_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS favorites (
        user_id INTEGER NOT NULL,
        store_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, store_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
      );
    `);

    // SQLite Migrations
    try { await dbInstance.exec("ALTER TABLE surprise_bags ADD COLUMN original_price REAL"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE surprise_bags ADD COLUMN description TEXT"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE surprise_bags ADD COLUMN images TEXT"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE stores ADD COLUMN lat REAL DEFAULT 0"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE stores ADD COLUMN lng REAL DEFAULT 0"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE stores ADD COLUMN is_active BOOLEAN DEFAULT 1"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE users ADD COLUMN logo TEXT"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES users(id)"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE stores ADD COLUMN image TEXT"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE stores ADD COLUMN tenant_id INTEGER REFERENCES users(id)"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE orders ADD COLUMN food_item_id INTEGER REFERENCES food_items(id)"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE orders ADD COLUMN type TEXT DEFAULT 'bag'"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE orders ADD COLUMN quantity INTEGER DEFAULT 1"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'Card'"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE reviews ADD COLUMN tags TEXT DEFAULT '[]'"); } catch(e) {}
    try { await dbInstance.exec("ALTER TABLE chat_messages ADD COLUMN is_read BOOLEAN DEFAULT 0"); } catch(e) {}
    try { await dbInstance.exec("UPDATE stores SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = ''"); } catch(e) {}

    // Pre-populate random locations for SQLite
    await dbInstance.exec(`
      UPDATE stores 
      SET lat = 51.5074 + (RANDOM() / 9223372036854775807.0) * 0.1, 
          lng = -0.1278 + (RANDOM() / 9223372036854775807.0) * 0.1 
      WHERE lat = 0 AND lng = 0
    `);
  }
  console.log(`Database initialized successfully in ${mode} mode.`);
};

module.exports = { db: dbInstance, initDB };

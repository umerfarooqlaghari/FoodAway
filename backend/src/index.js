const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDB, db } = require('./db');
const { uploadImageToS3, sendEmail, presignImages, getPresignedUrl } = require('./aws');
const { generateReceiptBuffer } = require('./receipt');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Initialize database
(async () => {
  try {
    await initDB();
  } catch (err) {
    console.error("Database initialization failed:", err.message);
  }
})();

// Routes
app.get('/', async (req, res) => {
  res.json({ message: 'Welcome to the FoodAway API!' });
});

app.get('/health', async (req, res) => {
  res.json({ status: 'ok' });
});

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { verifyToken, requireRole, JWT_SECRET } = require('./middleware');

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, phone, brand_name, logo } = req.body;
  try {
    const requestedRole = role || 'Customers';
    const allowedRoles = ['Customers', 'SellersAdmin'];
    if (!allowedRoles.includes(requestedRole)) {
      return res.status(400).json({ error: 'Invalid registration type' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (requestedRole === 'SellersAdmin') {
      const finalName = (brand_name || name || '').trim();
      if (!finalName) return res.status(400).json({ error: 'Brand name is required' });
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      const logoUrl = logo ? await uploadImageToS3(logo) : null;
      const info = await db.prepare('INSERT INTO users (name, email, password, logo, role, phone) VALUES (?, ?, ?, ?, ?, ?)').run(finalName, email, hashedPassword, logoUrl, 'SellersAdmin', phone || null);
      return res.status(201).json({ id: info.lastInsertRowid, message: 'Seller account registered successfully' });
    }

    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    const info = await db.prepare('INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)').run(name, email, hashedPassword, 'Customers', phone || null);
    res.status(201).json({ id: info.lastInsertRowid, message: 'User registered successfully' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    // Generate Tokens
    const token = jwt.sign({ id: user.id, role: user.role, tenant_id: user.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '14d' });

    // Store refresh token
    await db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?').run(refreshToken, user.id);

    // Send login notification email asynchronously
    sendEmail({
      to: user.email,
      subject: 'New Login Alert - FoodAway 🍩',
      html: `<p>Hi ${user.name},</p>
             <p>A new login was detected on your FoodAway account at <strong>${new Date().toLocaleString()}</strong>.</p>
             <p>If this was you, you can safely ignore this email. Otherwise, please secure your account immediately.</p>`,
      text: `Hi ${user.name}, A new login was detected on your FoodAway account at ${new Date().toLocaleString()}.`
    }).catch(err => console.error('Failed to send login alert email:', err.message));

    res.json({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, logo: user.logo, tenant_id: user.tenant_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const user = await db.prepare('SELECT * FROM users WHERE id = ? AND refresh_token = ?').get(decoded.id, refreshToken);
    
    if (!user) return res.status(403).json({ error: 'Invalid refresh token' });

    const newToken = jwt.sign({ id: user.id, role: user.role, tenant_id: user.tenant_id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token: newToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ error: 'No user registered with this email address' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes expiry

    // Delete existing OTPs for this email first
    await db.prepare('DELETE FROM otps WHERE email = ?').run(email);
    
    // Save new OTP
    await db.prepare('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)').run(email, otp, expiresAt);

    // Send email with OTP
    await sendEmail({
      to: email,
      subject: 'FoodAway Password Reset OTP 🔑',
      html: `<p>Hi ${user.name || 'User'},</p>
             <p>You requested a password reset. Your OTP verification code is:</p>
             <h2 style="font-size: 24px; letter-spacing: 2px; color: #EA580C; font-family: monospace;">${otp}</h2>
             <p>This code is valid for <strong>2 minutes</strong>. If you did not request this reset, please ignore this email.</p>`,
      text: `Hi, your FoodAway password reset OTP is ${otp}. Valid for 2 minutes.`
    }).catch(mailErr => {
      console.error('Mail sending failed during password reset:', mailErr.message);
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP and new password are required' });
  }
  try {
    const otpRecord = await db.prepare('SELECT * FROM otps WHERE email = ? AND otp = ?').get(email, otp.trim());
    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check expiration timezone-safely
    let expiresAt = otpRecord.expires_at;
    if (typeof expiresAt === 'string') {
      if (!expiresAt.endsWith('Z') && !expiresAt.includes('+')) {
        expiresAt += 'Z';
      }
      expiresAt = new Date(expiresAt);
    } else if (expiresAt instanceof Date) {
      expiresAt = new Date(Date.UTC(
        expiresAt.getFullYear(),
        expiresAt.getMonth(),
        expiresAt.getDate(),
        expiresAt.getHours(),
        expiresAt.getMinutes(),
        expiresAt.getSeconds(),
        expiresAt.getMilliseconds()
      ));
    } else {
      expiresAt = new Date(expiresAt);
    }

    if (expiresAt < new Date()) {
      await db.prepare('DELETE FROM otps WHERE email = ?').run(email);
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashedPassword, email);

    // Delete used OTP
    await db.prepare('DELETE FROM otps WHERE email = ?').run(email);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Routes (Protected)
app.get('/api/bags', verifyToken, requireRole('bags', 'read'), async (req, res) => {
  const { all, tenant_id } = req.query;
  try {
    let query = `
      SELECT b.id, b.price, b.original_price, b.description, b.images, b.quantity, b.pickup_time, b.store_id, s.name as store_name, s.address, s.lat, s.lng, s.is_active, s.image as store_image,
             CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as is_favorited
      FROM surprise_bags b
      JOIN stores s ON b.store_id = s.id
      LEFT JOIN favorites f ON f.store_id = s.id AND f.user_id = ?
    `;
    const params = [req.user.id];
    const conditions = [];

    if (all !== 'true') {
      conditions.push('b.quantity > 0 AND s.is_active = TRUE');
    }

    if (req.user.role === 'SellersAdmin' || req.user.role === 'SellersStaff') {
      const targetTenantId = req.user.tenant_id || req.user.id;
      conditions.push('s.tenant_id = ?');
      params.push(targetTenantId);
    } else if (req.user.role === 'SuperAdmin' && tenant_id) {
      conditions.push('s.tenant_id = ?');
      params.push(tenant_id);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    const bags = await db.prepare(query).all(...params);
    const signedBags = await Promise.all(bags.map(async bag => ({
      ...bag,
      images: await presignImages(bag.images),
      store_image: await getPresignedUrl(bag.store_image),
    })));
    res.json(signedBags);
  } catch (err) {
    console.error('GET /api/bags error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stores', verifyToken, requireRole('stores', 'read'), async (req, res) => {
  try {
    const { tenant_id } = req.query;
    let query = `
      SELECT s.*, CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as is_favorited
      FROM stores s
      LEFT JOIN favorites f ON f.store_id = s.id AND f.user_id = ?
    `;
    const params = [req.user.id];
    const conditions = [];

    if (req.user.role === 'SellersAdmin' || req.user.role === 'SellersStaff') {
      const targetTenantId = req.user.tenant_id || req.user.id;
      conditions.push(`s.tenant_id = ?`);
      params.push(targetTenantId);
    } else if (req.user.role === 'SuperAdmin' && tenant_id) {
      conditions.push(`s.tenant_id = ?`);
      params.push(tenant_id);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    const stores = await db.prepare(query).all(...params);
    const signedStores = await Promise.all(stores.map(async store => ({
      ...store,
      image: await getPresignedUrl(store.image),
    })));
    res.json(signedStores);
  } catch (err) {
    console.error('GET /api/stores error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', verifyToken, requireRole('users', 'read'), async (req, res) => {
  try {
    const users = await db.prepare('SELECT id, name, email, role, logo, created_at FROM users').all();
    const signedUsers = await Promise.all(users.map(async u => ({ ...u, logo: await getPresignedUrl(u.logo) })));
    res.json(signedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { logo, name } = req.body;
  try {
    const logoUrl = logo ? await uploadImageToS3(logo) : logo;
    await db.prepare('UPDATE users SET logo = COALESCE(?, logo), name = COALESCE(?, name) WHERE id = ?').run(logoUrl, name, req.params.id);
    const updatedUser = await db.prepare('SELECT id, name, email, role, logo FROM users WHERE id = ?').get(req.params.id);
    const signedUser = { ...updatedUser, logo: await getPresignedUrl(updatedUser.logo) };
    res.json({ message: 'User updated successfully', user: signedUser });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/push-token', verifyToken, async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) return res.status(400).json({ error: 'pushToken is required' });
  try {
    await db.prepare('UPDATE users SET push_token = ? WHERE id = ?').run(pushToken, req.user.id);
    res.json({ message: 'Push token updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stores', verifyToken, requireRole('stores', 'write'), async (req, res) => {
  const { name, address, lat, lng, image } = req.body;
  
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Latitude and Longitude are required' });
  }

  try {
    const targetTenantId = req.user.tenant_id || req.user.id;
    const imageUrl = image ? await uploadImageToS3(image) : null;
    const info = await db.prepare('INSERT INTO stores (tenant_id, name, address, lat, lng, is_active, image) VALUES (?, ?, ?, ?, ?, TRUE, ?)').run(targetTenantId, name, address, lat, lng, imageUrl);
    res.json({ id: info.lastInsertRowid, tenant_id: targetTenantId, name, address, lat, lng, is_active: true, image: imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/stores/:id', verifyToken, requireRole('stores', 'write'), async (req, res) => {
  const { id } = req.params;
  const { lat, lng, is_active, name, address, image } = req.body;
  try {
    const store = await db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    
    const imageUrl = image ? await uploadImageToS3(image) : image;
    const isActiveBool = is_active !== undefined && is_active !== null ? Boolean(is_active) : null;
    await db.prepare('UPDATE stores SET lat = COALESCE(?, lat), lng = COALESCE(?, lng), is_active = COALESCE(?, is_active), name = COALESCE(?, name), address = COALESCE(?, address), image = COALESCE(?, image) WHERE id = ?').run(lat, lng, isActiveBool, name, address, imageUrl, id);
    res.json({ message: 'Store updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/stores/:id', verifyToken, requireRole('stores', 'write'), async (req, res) => {
  const { id } = req.params;
  try {
    await db.prepare('DELETE FROM surprise_bags WHERE store_id = ?').run(id);
    const info = await db.prepare('DELETE FROM stores WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Store not found' });
    res.json({ message: 'Store deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bags', verifyToken, requireRole('bags', 'write'), async (req, res) => {
  const { store_id, price, original_price, description, images, quantity, pickup_time } = req.body;
  try {
    let s3Images = null;
    if (images) {
      const parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
      if (Array.isArray(parsedImages)) {
        const uploaded = await Promise.all(parsedImages.map(img => uploadImageToS3(img)));
        s3Images = JSON.stringify(uploaded);
      }
    }
    const info = await db.prepare('INSERT INTO surprise_bags (store_id, price, original_price, description, images, quantity, pickup_time) VALUES (?, ?, ?, ?, ?, ?, ?)').run(store_id, price, original_price, description, s3Images, quantity, pickup_time);
    
    // Notify users who have favorited this store
    const store = await db.prepare('SELECT name FROM stores WHERE id = ?').get(store_id);
    if (store) {
      const isFlashDeal = original_price && price && ((original_price - price) / original_price) >= 0.70;
      const favoritedUsers = await db.prepare('SELECT user_id FROM favorites WHERE store_id = ?').all(store_id);
      for (const fav of favoritedUsers) {
        sendToUser(fav.user_id, {
          type: 'new_bag',
          storeId: store_id,
          storeName: store.name,
          isFlashDeal: !!isFlashDeal,
          bag: {
            id: info.lastInsertRowid,
            price,
            original_price,
            description,
            pickup_time
          }
        });
      }
    }

    res.json({ id: info.lastInsertRowid, store_id, price, original_price, description, quantity, pickup_time });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bags/:id', verifyToken, requireRole('bags', 'write'), async (req, res) => {
  const { id } = req.params;
  const { price, original_price, description, images, quantity, pickup_time } = req.body;
  try {
    const bag = await db.prepare('SELECT * FROM surprise_bags WHERE id = ?').get(id);
    if (!bag) return res.status(404).json({ error: 'Bag not found' });

    let s3Images = bag.images;
    if (images !== undefined) {
      if (images === null) {
        s3Images = null;
      } else {
        const parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
        if (Array.isArray(parsedImages)) {
          const uploaded = await Promise.all(parsedImages.map(img => uploadImageToS3(img)));
          s3Images = JSON.stringify(uploaded);
        }
      }
    }

    const finalPrice = price !== undefined ? price : bag.price;
    const finalOriginalPrice = original_price !== undefined ? original_price : bag.original_price;
    const finalDescription = description !== undefined ? description : bag.description;
    const finalQuantity = quantity !== undefined ? quantity : bag.quantity;
    const finalPickupTime = pickup_time !== undefined ? pickup_time : bag.pickup_time;

    await db.prepare('UPDATE surprise_bags SET price = ?, original_price = ?, description = ?, images = ?, quantity = ?, pickup_time = ? WHERE id = ?').run(finalPrice, finalOriginalPrice, finalDescription, s3Images, finalQuantity, finalPickupTime, id);
    res.json({ message: 'Bag updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bags/:id', verifyToken, requireRole('bags', 'write'), async (req, res) => {
  const { id } = req.params;
  try {
    const info = await db.prepare('DELETE FROM surprise_bags WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Bag not found' });
    res.json({ message: 'Bag deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Food Items CRUD ───────────────────────────────────────────────────────

app.get('/api/food-items', verifyToken, requireRole('food_items', 'read'), async (req, res) => {
  const { all, store_id } = req.query;
  try {
    let query = `
      SELECT f.id, f.name, f.description, f.price, f.original_price, f.images,
             f.quantity, f.category, f.is_available, f.store_id, f.created_at,
             s.name as store_name, s.address, s.lat, s.lng, s.image as store_image,
             CASE WHEN fav.user_id IS NOT NULL THEN 1 ELSE 0 END as is_favorited
      FROM food_items f
      JOIN stores s ON f.store_id = s.id
      LEFT JOIN favorites fav ON fav.store_id = f.store_id AND fav.user_id = ?
    `;
    const conditions = [];
    if (all !== 'true') conditions.push('f.is_available = TRUE AND f.quantity > 0');
    if (store_id) conditions.push(`f.store_id = ${parseInt(store_id)}`);
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY f.created_at DESC';
    const foodItems = await db.prepare(query).all(req.user.id);
    const signedItems = await Promise.all(foodItems.map(async item => ({
      ...item,
      images: await presignImages(item.images),
      store_image: await getPresignedUrl(item.store_image),
    })));
    res.json(signedItems);
  } catch (err) {
    console.error('GET /api/food-items error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/food-items', verifyToken, requireRole('food_items', 'write'), async (req, res) => {
  const { store_id, name, description, price, original_price, images, quantity, category } = req.body;
  if (!store_id || !name || !price) return res.status(400).json({ error: 'store_id, name, and price are required.' });
  try {
    let s3Images = null;
    if (images) {
      const parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
      if (Array.isArray(parsedImages)) {
        const uploaded = await Promise.all(parsedImages.map(img => uploadImageToS3(img)));
        s3Images = JSON.stringify(uploaded);
      }
    }
    const info = await db.prepare(
      'INSERT INTO food_items (store_id, name, description, price, original_price, images, quantity, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(store_id, name, description, price, original_price || null, s3Images, quantity || 1, category || 'Other');
    res.json({ id: info.lastInsertRowid, store_id, name, price, quantity, category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/food-items/:id', verifyToken, requireRole('food_items', 'write'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, original_price, images, quantity, category, is_available } = req.body;
  try {
    const item = await db.prepare('SELECT * FROM food_items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'Food item not found' });
    
    let s3Images = undefined;
    if (images !== undefined) {
      if (images) {
        const parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
        if (Array.isArray(parsedImages)) {
          const uploaded = await Promise.all(parsedImages.map(img => uploadImageToS3(img)));
          s3Images = JSON.stringify(uploaded);
        }
      } else {
        s3Images = null;
      }
    }

    const isAvailableBool = is_available !== undefined && is_available !== null ? Boolean(is_available) : null;
    await db.prepare(
      `UPDATE food_items SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        original_price = COALESCE(?, original_price),
        images = COALESCE(?, images),
        quantity = COALESCE(?, quantity),
        category = COALESCE(?, category),
        is_available = COALESCE(?, is_available)
       WHERE id = ?`
    ).run(name, description, price, original_price, s3Images, quantity, category, isAvailableBool, id);
    res.json({ message: 'Food item updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/food-items/:id', verifyToken, requireRole('food_items', 'write'), async (req, res) => {
  const { id } = req.params;
  try {
    const info = await db.prepare('DELETE FROM food_items WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Food item not found' });
    res.json({ message: 'Food item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────

// Create an order (checkout cart)
app.post('/api/orders', verifyToken, async (req, res) => {
  const { items, paymentMethod } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  const method = paymentMethod || 'Card';

  try {
    const orderIds = [];
    
    // Start transaction
    const processOrder = db.transaction(async (orderItems, userId) => {
      for (const item of orderItems) {
        const { id, type, quantity, price } = item;
        
        if (type === 'bag') {
          const bag = await db.prepare('SELECT * FROM surprise_bags WHERE id = ?').get(id);
          if (!bag || bag.quantity < quantity) throw new Error(`Bag ${id} not available in requested quantity`);
          
          await db.prepare('UPDATE surprise_bags SET quantity = quantity - ? WHERE id = ?').run(quantity, id);
          const info = await db.prepare('INSERT INTO orders (bag_id, type, quantity, store_id, customer_id, price, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, type, quantity, bag.store_id, userId, price, method);
          orderIds.push(info.lastInsertRowid);
        } else if (type === 'food') {
          const food = await db.prepare('SELECT * FROM food_items WHERE id = ?').get(id);
          if (!food || food.quantity < quantity || !food.is_available) throw new Error(`Food item ${id} not available in requested quantity`);
          
          await db.prepare('UPDATE food_items SET quantity = quantity - ? WHERE id = ?').run(quantity, id);
          const info = await db.prepare('INSERT INTO orders (food_item_id, type, quantity, store_id, customer_id, price, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, type, quantity, food.store_id, userId, price, method);
          orderIds.push(info.lastInsertRowid);
        } else {
          throw new Error(`Invalid item type: ${type}`);
        }
      }
    });

    await processOrder(items, req.user.id);

    // Retrieve order details to trigger notifications
    const placedOrders = [];
    for (const orderId of orderIds) {
      const order = await db.prepare(`
        SELECT o.id, o.type, o.quantity, o.price, o.payment_method, o.created_at,
               s.name as store_name, s.tenant_id,
               u.name as customer_name,
               COALESCE(b.pickup_time, 'N/A') as pickup_time,
               COALESCE(b.description, f.name) as item_name
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        JOIN users u ON o.customer_id = u.id
        LEFT JOIN surprise_bags b ON o.bag_id = b.id AND o.type = 'bag'
        LEFT JOIN food_items f ON o.food_item_id = f.id AND o.type = 'food'
        WHERE o.id = ?
      `).get(orderId);
      if (order) {
        placedOrders.push(order);
      }
    }

    // Trigger WS notifications
    for (const order of placedOrders) {
      sendToSellers({
        type: 'new_order',
        order
      });

      sendToUser(req.user.id, {
        type: 'new_order_confirmation',
        order: {
          id: order.id,
          quantity: order.quantity,
          price: order.price,
          store_name: order.store_name,
          item_name: order.item_name,
          pickup_time: order.pickup_time
        }
      });
    }

    // Send order confirmation email with PDF receipt asynchronously
    const customer = await db.prepare('SELECT email, name, phone FROM users WHERE id = ?').get(req.user.id);
    if (customer && customer.email) {
      const total     = placedOrders.reduce((sum, o) => sum + (Number(o.price) * (o.quantity || 1)), 0);
      const itemsList = placedOrders.map(o =>
        `<li>${o.quantity}x <strong>${o.item_name}</strong> from ${o.store_name} — £${Number(o.price).toFixed(2)} each (Pickup: ${o.pickup_time})</li>`
      ).join('');

      generateReceiptBuffer(placedOrders, {
        name:  customer.name,
        email: customer.email,
        phone: customer.phone || ''
      }).then(receiptPdf => sendEmail({
        to:      customer.email,
        subject: 'Your FoodAway Order Confirmation 🍩',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#FF5A00;padding:24px 32px;border-radius:8px 8px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:26px;">FoodAway</h1>
              <p style="color:#ffe0cc;margin:4px 0 0;font-size:13px;">Order Confirmed ✓</p>
            </div>
            <div style="background:#fff;padding:24px 32px;border:1px solid #eee;border-top:none;">
              <p style="color:#333;">Hi <strong>${customer.name}</strong>,</p>
              <p style="color:#555;">Thank you for rescuing food! Your order has been confirmed. Your receipt is attached to this email.</p>
              <h3 style="color:#FF5A00;border-bottom:2px solid #FF5A00;padding-bottom:6px;">Order Summary</h3>
              <ul style="color:#333;line-height:1.8;">${itemsList}</ul>
              <p style="font-size:18px;font-weight:bold;color:#1a1a1a;border-top:1px solid #eee;padding-top:12px;">
                Total: <span style="color:#FF5A00;">£${total.toFixed(2)}</span>
              </p>
              <div style="background:#fff8f5;border:1px solid #ffe0cc;border-radius:6px;padding:14px;margin-top:16px;">
                <p style="margin:0;color:#FF5A00;font-weight:bold;">Payment: Cash at Pickup</p>
                <p style="margin:6px 0 0;color:#555;font-size:13px;">Present your receipt at the store when collecting your order.</p>
              </div>
            </div>
            <div style="background:#f5f5f5;padding:14px 32px;text-align:center;border-radius:0 0 8px 8px;">
              <p style="margin:0;color:#aaa;font-size:12px;">© ${new Date().getFullYear()} FoodAway — Reducing food waste, one meal at a time.</p>
            </div>
          </div>`,
        text: `Hi ${customer.name}, your FoodAway order is confirmed! Items: ${placedOrders.map(o => `${o.quantity}x ${o.item_name}`).join(', ')}. Total: £${total.toFixed(2)}. Your receipt is attached.`,
        attachments: [{
          filename:    'FoodAway-Receipt.pdf',
          content:     receiptPdf,
          contentType: 'application/pdf'
        }]
      })).catch(err => console.error('Failed to send order confirmation email:', err.message));
    }

    res.json({ message: 'Order placed successfully', order_ids: orderIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/seller/stats', verifyToken, requireRole('stores', 'read'), async (req, res) => {
  try {
    const { tenant_id } = req.query;
    let queryFilter = '';
    let params = [];

    if (req.user.role === 'SellersAdmin' || req.user.role === 'SellersStaff') {
      const targetTenantId = req.user.tenant_id || req.user.id;
      queryFilter = 'WHERE s.tenant_id = ?';
      params.push(targetTenantId);
    } else if (req.user.role === 'SuperAdmin' && tenant_id) {
      queryFilter = 'WHERE s.tenant_id = ?';
      params.push(tenant_id);
    }

    const totalRevenueRow = await db.prepare(`SELECT SUM(o.price * o.quantity) as total_revenue FROM orders o JOIN stores s ON o.store_id = s.id ${queryFilter}`).get(...params);
    const totalBagsSoldRow = await db.prepare(`SELECT SUM(o.quantity) as bags_sold FROM orders o JOIN stores s ON o.store_id = s.id ${queryFilter}`).get(...params);
    
    const dailySales = await db.prepare(`
      SELECT date(o.created_at) as date, SUM(o.price * o.quantity) as revenue, SUM(o.quantity) as bags 
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      ${queryFilter}
      GROUP BY date(o.created_at) 
      ORDER BY date(o.created_at) ASC
      LIMIT 7
    `).all(...params);
    
    res.json({
      totalRevenue: totalRevenueRow.total_revenue || 0,
      bagsSold: totalBagsSoldRow.bags_sold || 0,
      dailySales
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed data route for testing (Unprotected for ease of use)
app.post('/api/seed', async (req, res) => {
  try {
    const storeInfo = await db.prepare("INSERT INTO stores (name, address) VALUES ('Green Bakery', '123 Main St')").run();
    await db.prepare("INSERT INTO surprise_bags (store_id, price, quantity, pickup_time) VALUES (?, 4.99, 5, 'Today, 18:00 - 19:00')").run(storeInfo.lastInsertRowid);
    
    const storeInfo2 = await db.prepare("INSERT INTO stores (name, address) VALUES ('Daily Roast', '456 Oak Ave')").run();
    await db.prepare("INSERT INTO surprise_bags (store_id, price, quantity, pickup_time) VALUES (?, 3.50, 2, 'Today, 15:00 - 16:30')").run(storeInfo2.lastInsertRowid);
    
    res.json({ message: 'Seed data inserted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seed/superadmin', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('superadmin123', 10);
    await db.prepare("INSERT INTO users (name, email, password, role) VALUES ('Super Admin', 'superadmin@alpha-devs.cloud', ?, 'SuperAdmin')").run(hashedPassword);
    res.json({ message: 'SuperAdmin created. Email: superadmin@alpha-devs.cloud, Pass: superadmin123' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- Additional Endpoints for Bookings & Reviews ---

// Get customer's orders
app.get('/api/orders/me', verifyToken, async (req, res) => {
  try {
    const orders = await db.prepare(`
      SELECT o.id, o.type, o.quantity, o.price, o.payment_method, o.created_at,
             s.name as store_name, s.address, s.image as store_image,
             COALESCE(b.description, f.name) as item_name
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      LEFT JOIN surprise_bags b ON o.bag_id = b.id AND o.type = 'bag'
      LEFT JOIN food_items f ON o.food_item_id = f.id AND o.type = 'food'
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);
    const signedOrders = await Promise.all(orders.map(async order => ({
      ...order,
      store_image: await getPresignedUrl(order.store_image),
    })));
    res.json(signedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders (for Sellers/Admins)
app.get('/api/seller/orders', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin' && req.user.role !== 'SellersAdmin' && req.user.role !== 'SellersStaff') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { tenant_id } = req.query;
    let queryFilter = '';
    let params = [];

    if (req.user.role === 'SellersAdmin' || req.user.role === 'SellersStaff') {
      const targetTenantId = req.user.tenant_id || req.user.id;
      queryFilter = 'WHERE s.tenant_id = ?';
      params.push(targetTenantId);
    } else if (req.user.role === 'SuperAdmin' && tenant_id) {
      queryFilter = 'WHERE s.tenant_id = ?';
      params.push(tenant_id);
    }

    const orders = await db.prepare(`
      SELECT o.id, o.type, o.quantity, o.price, o.payment_method, o.created_at,
             u.name as customer_name, u.email as customer_email,
             s.name as store_name,
             COALESCE(b.pickup_time, 'N/A') as pickup_time,
             COALESCE(b.description, f.name) as item_name
      FROM orders o
      JOIN users u ON o.customer_id = u.id
      JOIN stores s ON o.store_id = s.id
      LEFT JOIN surprise_bags b ON o.bag_id = b.id AND o.type = 'bag'
      LEFT JOIN food_items f ON o.food_item_id = f.id AND o.type = 'food'
      ${queryFilter}
      ORDER BY o.created_at DESC
    `).all(...params);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New Management Endpoints (Tenants, Staff, App Reviews)
app.post('/api/superadmin/tenants', verifyToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: 'Forbidden' });
  const { name, email, password, brand_name, logo } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const finalName = brand_name || name;
    const logoUrl = logo ? await uploadImageToS3(logo) : logo;
    const info = await db.prepare('INSERT INTO users (name, email, password, logo, role) VALUES (?, ?, ?, ?, ?)').run(finalName, email, hashedPassword, logoUrl || null, 'SellersAdmin');
    res.status(201).json({ id: info.lastInsertRowid, message: 'Tenant created successfully' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/superadmin/tenants', verifyToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenants = await db.prepare("SELECT id, name, email, logo, created_at FROM users WHERE role = 'SellersAdmin'").all();
    const signedTenants = await Promise.all(tenants.map(async t => ({ ...t, logo: await getPresignedUrl(t.logo) })));
    res.json(signedTenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/superadmin/trigger-inactivity-reminders', verifyToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: 'Forbidden' });
  
  try {
    const inactiveUsers = await db.prepare(`
      SELECT u.id, u.name, u.email, MAX(o.created_at) as last_order
      FROM users u
      LEFT JOIN orders o ON o.customer_id = u.id
      WHERE u.role = 'Customers'
      GROUP BY u.id
      HAVING last_order IS NULL OR datetime(last_order) < datetime('now', '-3 days')
    `).all();

    const notified = [];
    for (const customer of inactiveUsers) {
      sendToUser(customer.id, {
        type: 'inactivity_reminder',
        message: `We miss you, ${customer.name}! 🍩 Save 20% on your next surplus rescue bag with code FoodAway20.`
      });

      // Send email using AWS SES
      try {
        await sendEmail({
          to: customer.email,
          subject: `We miss you, ${customer.name}! 🍩`,
          html: `<p>Hi ${customer.name},</p>
                 <p>We miss you! Save 20% on your next surplus rescue bag with code <strong>FoodAway20</strong>.</p>
                 <p>Help us reduce food waste and save delicious treats today!</p>`,
          text: `Hi ${customer.name}, We miss you! Save 20% on your next surplus rescue bag with code FoodAway20.`
        });
      } catch (emailErr) {
        console.error(`Failed to send inactivity email to ${customer.email}:`, emailErr.message);
      }

      notified.push({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        last_order: customer.last_order || 'Never Ordered'
      });
    }

    res.json({ message: `Inactivity reminders sent to ${notified.length} users.`, users: notified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seller/staff', verifyToken, async (req, res) => {
  if (req.user.role !== 'SellersAdmin') return res.status(403).json({ error: 'Only Tenant Admins can add staff' });
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const tenantId = req.user.tenant_id || req.user.id;
    const info = await db.prepare('INSERT INTO users (name, email, password, role, tenant_id) VALUES (?, ?, ?, ?, ?)').run(name, email, hashedPassword, 'SellersStaff', tenantId);
    res.status(201).json({ id: info.lastInsertRowid, message: 'Staff created successfully' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/seller/staff', verifyToken, async (req, res) => {
  if (req.user.role !== 'SellersAdmin') return res.status(403).json({ error: 'Forbidden' });
  const tenantId = req.user.tenant_id || req.user.id;
  try {
    const staff = await db.prepare('SELECT id, name, email, role, created_at FROM users WHERE tenant_id = ? AND role = ?').all(tenantId, 'SellersStaff');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/app-reviews', verifyToken, async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating) return res.status(400).json({ error: 'Rating is required' });
  try {
    const info = await db.prepare('INSERT INTO app_reviews (customer_id, rating, comment) VALUES (?, ?, ?)').run(req.user.id, rating, comment);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/app-reviews', verifyToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const reviews = await db.prepare(`
      SELECT a.*, u.name as customer_name 
      FROM app_reviews a 
      JOIN users u ON a.customer_id = u.id 
      ORDER BY a.created_at DESC
    `).all();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle favorite store
app.post('/api/favorites/toggle', verifyToken, async (req, res) => {
  const { store_id } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id is required' });
  try {
    const existing = await db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND store_id = ?').get(req.user.id, store_id);
    if (existing) {
      await db.prepare('DELETE FROM favorites WHERE user_id = ? AND store_id = ?').run(req.user.id, store_id);
      res.json({ message: 'Store removed from favorites', is_favorited: 0 });
    } else {
      await db.prepare('INSERT INTO favorites (user_id, store_id) VALUES (?, ?)').run(req.user.id, store_id);
      res.json({ message: 'Store added to favorites', is_favorited: 1 });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all favorites
app.get('/api/favorites', verifyToken, async (req, res) => {
  try {
    const favorites = await db.prepare(`
      SELECT s.id, s.name, s.address, s.lat, s.lng, s.is_active, s.image
      FROM favorites f
      JOIN stores s ON f.store_id = s.id
      WHERE f.user_id = ?
    `).all(req.user.id);
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post a review
app.post('/api/reviews', verifyToken, async (req, res) => {
  const { store_id, rating, comment, tags } = req.body;
  if (!store_id || !rating) return res.status(400).json({ error: 'Store ID and rating are required' });
  try {
    const tagsStr = JSON.stringify(tags || []);
    const info = await db.prepare('INSERT INTO reviews (store_id, customer_id, rating, comment, tags) VALUES (?, ?, ?, ?, ?)').run(store_id, req.user.id, rating, comment, tagsStr);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await db.prepare(`
      SELECT r.*, u.name as customer_name, s.name as store_name
      FROM reviews r
      JOIN users u ON r.customer_id = u.id
      JOIN stores s ON r.store_id = s.id
      ORDER BY r.created_at DESC
    `).all();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat support endpoints

// Get chat history between a customer and a store
app.get('/api/chat/history', verifyToken, async (req, res) => {
  const { store_id, customer_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id is required' });

  let targetCustomerId = customer_id;
  if (req.user.role === 'Customers') {
    targetCustomerId = req.user.id;
  } else {
    if (!targetCustomerId) return res.status(400).json({ error: 'customer_id is required for admins/sellers' });
  }

  try {
    const messages = await db.prepare(`
      SELECT m.*, u.name as customer_name, s.name as store_name
      FROM chat_messages m
      JOIN users u ON m.customer_id = u.id
      JOIN stores s ON m.store_id = s.id
      WHERE m.store_id = ? AND m.customer_id = ?
      ORDER BY m.created_at ASC
    `).all(store_id, targetCustomerId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active chats list for sellers
app.get('/api/seller/chats', verifyToken, requireRole('stores', 'read'), async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin' && req.user.role !== 'SellersAdmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const chats = await db.prepare(`
      SELECT DISTINCT m.store_id, m.customer_id, u.name as customer_name, u.email as customer_email, s.name as store_name,
             (SELECT message FROM chat_messages WHERE store_id = m.store_id AND customer_id = m.customer_id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM chat_messages WHERE store_id = m.store_id AND customer_id = m.customer_id ORDER BY created_at DESC LIMIT 1) as last_message_time,
             (SELECT COUNT(*) FROM chat_messages WHERE store_id = m.store_id AND customer_id = m.customer_id AND sender_role = 'Customer' AND is_read = FALSE) as unread_count
      FROM chat_messages m
      JOIN users u ON m.customer_id = u.id
      JOIN stores s ON m.store_id = s.id
      ORDER BY last_message_time DESC
    `).all();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark messages in a chat as read
app.post('/api/chat/read', verifyToken, async (req, res) => {
  const { store_id, customer_id } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id is required' });

  let targetCustomerId = customer_id;
  if (req.user.role === 'Customers') {
    targetCustomerId = req.user.id;
  } else {
    if (!targetCustomerId) return res.status(400).json({ error: 'customer_id is required for admins/sellers' });
  }

  const unreadRole = req.user.role === 'Customers' ? 'Seller' : 'Customer';

  try {
    await db.prepare(`
      UPDATE chat_messages
      SET is_read = TRUE
      WHERE store_id = ? AND customer_id = ? AND sender_role = ? AND is_read = FALSE
    `).run(store_id, targetCustomerId, unreadRole);
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket Server Integration
const { WebSocketServer } = require('ws');

// Global WebSocket clients registry
const wsClients = new Map();

async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.log(`[Push Notification] Invalid or missing token: ${pushToken}`);
    return;
  }
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: 'default',
        data
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Expo API returned status ${response.status}: ${errText}`);
    }
    console.log(`[Push Notification] Sent successfully to token: ${pushToken}`);
  } catch (error) {
    console.error('[Push Notification] Failed to send to Expo:', error.message);
  }
}

// Global WebSocket send helpers
const sendToUser = (userId, payload) => {
  const userKey = `user_${userId}`;
  if (wsClients.has(userKey)) {
    const msg = JSON.stringify(payload);
    for (const ws of wsClients.get(userKey)) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
};

const sendToSellers = (payload) => {
  const sellersKey = 'sellers';
  if (wsClients.has(sellersKey)) {
    const msg = JSON.stringify(payload);
    for (const ws of wsClients.get(sellersKey)) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
};

const initWebSockets = (httpServer) => {
  const wss = new WebSocketServer({ noServer: true });

  const addClientConnection = (key, ws) => {
    if (!wsClients.has(key)) {
      wsClients.set(key, new Set());
    }
    wsClients.get(key).add(ws);
  };

  const removeClientConnection = (key, ws) => {
    if (wsClients.has(key)) {
      const set = wsClients.get(key);
      set.delete(ws);
      if (set.size === 0) {
        wsClients.delete(key);
      }
    }
  };

  httpServer.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    let currentUser = null;
    let clientKeys = new Set();

    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());

        if (payload.type === 'register') {
          const { token } = payload;
          if (!token) return ws.close(4001, 'Token required');
          
          try {
            currentUser = jwt.verify(token, JWT_SECRET);
            
            const userKey = `user_${currentUser.id}`;
            addClientConnection(userKey, ws);
            clientKeys.add(userKey);

            if (currentUser.role === 'SuperAdmin' || currentUser.role === 'SellersAdmin' || currentUser.role === 'SellersStaff') {
              const sellerKey = 'sellers';
              addClientConnection(sellerKey, ws);
              clientKeys.add(sellerKey);
            }
            
            ws.send(JSON.stringify({ type: 'registered', userId: currentUser.id, role: currentUser.role }));
          } catch (err) {
            return ws.close(4002, 'Invalid token');
          }
        }

        else if (payload.type === 'message') {
          if (!currentUser) return ws.send(JSON.stringify({ type: 'error', error: 'Unauthenticated connection' }));
          
          const { storeId, customerId, text } = payload;
          if (!storeId || !text) {
            return ws.send(JSON.stringify({ type: 'error', error: 'storeId and text are required' }));
          }

          const resolvedCustomerId = currentUser.role === 'Customers' ? currentUser.id : customerId;
          if (!resolvedCustomerId) {
            return ws.send(JSON.stringify({ type: 'error', error: 'customerId is required' }));
          }

          const senderRole = currentUser.role === 'Customers' ? 'Customer' : 'Seller';

          // Persist message to database
          const info = await db.prepare(`
            INSERT INTO chat_messages (store_id, customer_id, sender_role, message)
            VALUES (?, ?, ?, ?)
          `).run(storeId, resolvedCustomerId, senderRole, text);

          // Send push notification asynchronously
          (async () => {
            try {
              if (senderRole === 'Customer') {
                const store = await db.prepare('SELECT tenant_id, name FROM stores WHERE id = ?').get(storeId);
                if (store) {
                  const sellers = await db.prepare("SELECT id, push_token FROM users WHERE (id = ? OR tenant_id = ?) AND role IN ('SellersAdmin', 'SellersStaff')").all(store.tenant_id, store.tenant_id);
                  for (const seller of sellers) {
                    if (seller.push_token) {
                      await sendPushNotification(
                        seller.push_token,
                        `New Message - ${store.name}`,
                        `${currentUser.name || 'Customer'}: ${text}`,
                        { type: 'chat', storeId: Number(storeId), customerId: Number(resolvedCustomerId), storeName: store.name }
                      );
                    }
                  }
                }
              } else {
                const customer = await db.prepare('SELECT push_token FROM users WHERE id = ?').get(resolvedCustomerId);
                const store = await db.prepare('SELECT name FROM stores WHERE id = ?').get(storeId);
                if (customer && customer.push_token) {
                  await sendPushNotification(
                    customer.push_token,
                    store ? store.name : 'Store Support',
                    text,
                    { type: 'chat', storeId: Number(storeId), storeName: store ? store.name : 'Store Support' }
                  );
                }
              }
            } catch (pushErr) {
              console.error('Failed to trigger background push notification:', pushErr.message);
            }
          })();

          const insertedMessage = {
            id: info.lastInsertRowid,
            store_id: Number(storeId),
            customer_id: Number(resolvedCustomerId),
            sender_role: senderRole,
            message: text,
            is_read: false,
            created_at: new Date().toISOString()
          };

          const msgPayload = JSON.stringify({ type: 'message', message: insertedMessage });

          const senderKey = `user_${currentUser.id}`;
          if (wsClients.has(senderKey)) {
            for (const client of wsClients.get(senderKey)) {
              if (client.readyState === 1) client.send(msgPayload);
            }
          }

          if (senderRole === 'Customer') {
            const sellersKey = 'sellers';
            const sellerClients = wsClients.get(sellersKey);
            const sellerCount = sellerClients ? sellerClients.size : 0;
            console.log(`[WS] Dispatching customer message to ${sellerCount} seller client(s) (store:${storeId} customer:${resolvedCustomerId})`);
            if (sellerClients) {
              for (const client of sellerClients) {
                if (client.readyState === 1) client.send(msgPayload);
              }
            }
          } else {
            const recipientKey = `user_${resolvedCustomerId}`;
            if (wsClients.has(recipientKey)) {
              for (const client of wsClients.get(recipientKey)) {
                if (client.readyState === 1) client.send(msgPayload);
              }
            }
          }
        }

        else if (payload.type === 'typing') {
          if (!currentUser) return;
          const { storeId, customerId, isTyping } = payload;
          const resolvedCustomerId = currentUser.role === 'Customers' ? currentUser.id : customerId;
          const senderRole = currentUser.role === 'Customers' ? 'Customer' : 'Seller';
          
          const typingPayload = JSON.stringify({
            type: 'typing',
            storeId: Number(storeId),
            customerId: Number(resolvedCustomerId),
            senderRole,
            isTyping: !!isTyping
          });

          if (senderRole === 'Customer') {
            const sellersKey = 'sellers';
            if (wsClients.has(sellersKey)) {
              for (const client of wsClients.get(sellersKey)) {
                if (client.readyState === 1) client.send(typingPayload);
              }
            }
          } else {
            const recipientKey = `user_${resolvedCustomerId}`;
            if (wsClients.has(recipientKey)) {
              for (const client of wsClients.get(recipientKey)) {
                if (client.readyState === 1) client.send(typingPayload);
              }
            }
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: err.message }));
      }
    });

    ws.on('close', () => {
      for (const key of clientKeys) {
        removeClientConnection(key, ws);
      }
    });
  });

  console.log("WebSocket server initialized.");
};

// ─── Public Contact Form ──────────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields (name, email, subject, message) are required.' });
  }

  const submittedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  // ── Email to admin ──────────────────────────────────────────────────────────
  const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>New Contact Enquiry — FoodAway</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#FF5A00 0%,#FF8A00 100%);padding:36px 40px;text-align:center;">
            <img src="https://goodtogo-assets.s3.us-east-1.amazonaws.com/brand/logo.png" alt="FoodAway" height="44" style="margin-bottom:12px;" onerror="this.style.display='none'" />
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">New Support Enquiry</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Received via FoodAway Contact Form</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <!-- Alert badge -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:rgba(255,90,0,0.1);border:1px solid rgba(255,90,0,0.25);border-radius:10px;padding:14px 18px;">
                  <p style="margin:0;color:#FF5A00;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Action Required</p>
                  <p style="margin:4px 0 0;color:#e5e7eb;font-size:14px;">A customer has submitted a support request. Please respond within 24–48 hours.</p>
                </td>
              </tr>
            </table>

            <!-- Sender details -->
            <h2 style="margin:0 0 16px;color:#ffffff;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:10px;">Sender Details</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${[['Name', name], ['Email', email], ['Subject', subject], ['Submitted', submittedAt]].map(([k, v]) => `
              <tr>
                <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);color:#9ca3af;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;width:110px;">${k}</td>
                <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);color:#ffffff;font-size:14px;">${v}</td>
              </tr>`).join('')}
            </table>

            <!-- Message -->
            <h2 style="margin:0 0 12px;color:#ffffff;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Message</h2>
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-left:3px solid #FF5A00;border-radius:8px;padding:20px 20px 20px 22px;">
              <p style="margin:0;color:#d1d5db;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            </div>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td align="center">
                  <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" style="display:inline-block;background:linear-gradient(135deg,#FF5A00,#FF8A00);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;">Reply to ${name} →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0d0d0d;padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;color:#6b7280;font-size:12px;">FoodAway ApS · info@alpha-devs.cloud</p>
            <p style="margin:6px 0 0;color:#4b5563;font-size:11px;">This is an automated notification. Do not reply to this email directly.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Confirmation email to sender ───────────────────────────────────────────
  const senderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>We've received your message — FoodAway</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,0.1);">

        <!-- Orange header with logo -->
        <tr>
          <td style="background:linear-gradient(135deg,#FF5A00 0%,#FF8A00 100%);padding:44px 40px;text-align:center;">
            <div style="width:64px;height:64px;background:rgba(255,255,255,0.2);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px;line-height:64px;text-align:center;">🍃</div>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">We've Got Your Message!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Thank you for reaching out to FoodAway.</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:36px 40px 0;">
            <p style="margin:0;color:#111827;font-size:17px;line-height:1.6;">Hi <strong>${name}</strong>,</p>
            <p style="margin:14px 0 0;color:#374151;font-size:15px;line-height:1.7;">
              Thanks for getting in touch with the FoodAway team. We've received your enquiry and our team will review it shortly.
            </p>
          </td>
        </tr>

        <!-- What happens next -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
                  <p style="margin:0;color:#FF5A00;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Your Submission</p>
                </td>
              </tr>
              ${[['Name', name], ['Email', email], ['Subject', subject], ['Submitted', submittedAt]].map(([k, v]) => `
              <tr>
                <td style="padding:10px 24px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:100px;">${k}</td>
                <td style="padding:10px 24px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:600;">${v}</td>
              </tr>`).join('')}
            </table>
          </td>
        </tr>

        <!-- Timeline -->
        <tr>
          <td style="padding:28px 40px 0;">
            <h2 style="margin:0 0 18px;color:#111827;font-size:15px;font-weight:700;">What happens next?</h2>
            ${[
              { icon: '📬', title: 'Confirmation received', desc: 'This email confirms we got your message.', done: true },
              { icon: '👀', title: 'Under review', desc: 'Our team will read your enquiry carefully.', done: false },
              { icon: '💬', title: 'We\'ll respond', desc: 'Expect a reply within 24–48 business hours.', done: false },
            ].map(({ icon, title, desc, done }) => `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td valign="top" style="width:40px;padding-right:14px;">
                  <div style="width:36px;height:36px;background:${done ? 'linear-gradient(135deg,#FF5A00,#FF8A00)' : '#f3f4f6'};border-radius:50%;text-align:center;line-height:36px;font-size:16px;">${icon}</div>
                </td>
                <td valign="top">
                  <p style="margin:0;color:#111827;font-size:14px;font-weight:700;">${title}</p>
                  <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${desc}</p>
                </td>
              </tr>
            </table>`).join('')}
          </td>
        </tr>

        <!-- Message preview -->
        <tr>
          <td style="padding:28px 40px 0;">
            <p style="margin:0 0 10px;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Your message</p>
            <div style="background:#f9fafb;border-left:3px solid #FF5A00;border-radius:4px;padding:16px 18px;">
              <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            </div>
          </td>
        </tr>

        <!-- Need urgent help -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,90,0,0.05);border:1px solid rgba(255,90,0,0.2);border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;color:#FF5A00;font-size:13px;font-weight:700;">Need urgent help?</p>
                  <p style="margin:4px 0 0;color:#374151;font-size:13px;">Email us directly at <a href="mailto:info@alpha-devs.cloud" style="color:#FF5A00;text-decoration:none;font-weight:600;">info@alpha-devs.cloud</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Sign off -->
        <tr>
          <td style="padding:32px 40px 36px;">
            <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;">
              Thanks again for being part of the FoodAway family. Together we're making a difference — one rescued meal at a time. 🍃
            </p>
            <p style="margin:20px 0 0;color:#111827;font-size:15px;">Warm regards,<br/><strong>The FoodAway Team</strong></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} FoodAway ApS · All Rights Reserved</p>
            <p style="margin:6px 0 0;color:#9ca3af;font-size:11px;">You're receiving this because you submitted a contact form on foodaway.app</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await Promise.all([
      sendEmail({
        to: 'info@alpha-devs.cloud',
        subject: `[FoodAway Support] ${subject} — from ${name}`,
        html: adminHtml,
        text: `New contact form submission\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\nSubmitted: ${submittedAt}\n\nMessage:\n${message}`,
      }),
      sendEmail({
        to: email,
        subject: `We've received your message — FoodAway Support`,
        html: senderHtml,
        text: `Hi ${name},\n\nThanks for contacting FoodAway. We've received your message about "${subject}" and will respond within 24–48 business hours.\n\nYour message:\n${message}\n\nBest regards,\nThe FoodAway Team\ninfo@alpha-devs.cloud`,
      }),
    ]);
    res.json({ success: true, message: 'Your message has been sent. Check your inbox for a confirmation.' });
  } catch (err) {
    console.error('Contact form email error:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again or email us directly at info@alpha-devs.cloud.' });
  }
});

// ─── Public Customer Endpoints (no auth required) ──────────────────────────

app.get('/api/public/stores', async (req, res) => {
  try {
    const stores = await db.prepare(`
      SELECT id, name, address, lat, lng, image
      FROM stores WHERE is_active = TRUE
      ORDER BY name ASC
    `).all();
    const signed = await Promise.all(stores.map(async s => ({
      ...s,
      image: s.image ? await getPresignedUrl(s.image) : null
    })));
    res.json(signed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/public/bags', async (req, res) => {
  try {
    const bags = await db.prepare(`
      SELECT b.id, b.price, b.original_price, b.description, b.images,
             b.quantity, b.pickup_time, b.store_id,
             s.name as store_name, s.address, s.image as store_image
      FROM surprise_bags b
      JOIN stores s ON b.store_id = s.id
      WHERE b.quantity > 0 AND s.is_active = TRUE
      ORDER BY b.id DESC
    `).all();
    const signed = await Promise.all(bags.map(async bag => ({
      ...bag,
      images: await presignImages(bag.images),
      store_image: bag.store_image ? await getPresignedUrl(bag.store_image) : null
    })));
    res.json(signed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/public/food-items', async (req, res) => {
  try {
    const items = await db.prepare(`
      SELECT f.id, f.name, f.description, f.price, f.original_price,
             f.images, f.quantity, f.category, f.store_id, f.created_at,
             s.name as store_name, s.address, s.image as store_image
      FROM food_items f
      JOIN stores s ON f.store_id = s.id
      WHERE f.is_available = TRUE AND f.quantity > 0 AND s.is_active = TRUE
      ORDER BY f.created_at DESC
    `).all();
    const signed = await Promise.all(items.map(async item => ({
      ...item,
      images: await presignImages(item.images),
      store_image: item.store_image ? await getPresignedUrl(item.store_image) : null
    })));
    res.json(signed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function previewCheckoutItems(items) {
  const preview = [];
  for (const cartItem of items) {
    const { id, type, quantity = 1 } = cartItem;
    if (type === 'bag') {
      const bag = await db.prepare('SELECT * FROM surprise_bags WHERE id = ?').get(id);
      if (!bag || bag.quantity < quantity) continue;
      const store = await db.prepare('SELECT * FROM stores WHERE id = ?').get(bag.store_id);
      if (!store?.is_active) continue;
      preview.push({
        id, type, quantity,
        item_name: bag.description || 'Surprise Bag',
        store_name: store.name,
        price: bag.price
      });
    } else if (type === 'food') {
      const food = await db.prepare('SELECT * FROM food_items WHERE id = ?').get(id);
      if (!food || !food.is_available || food.quantity < quantity) continue;
      const store = await db.prepare('SELECT * FROM stores WHERE id = ?').get(food.store_id);
      if (!store?.is_active) continue;
      preview.push({
        id, type, quantity,
        item_name: food.name,
        store_name: store.name,
        price: food.price
      });
    }
  }
  return preview;
}

async function resolveCheckoutCustomer({ name, email, phone }) {
  let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const hashed = await bcrypt.hash(`${phone}${Date.now()}`, 8);
    const info = await db.prepare(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, hashed, 'Customers', phone);
    user = { id: info.lastInsertRowid, name, email, phone };
  } else {
    if (!user.phone && phone) {
      await db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, user.id);
    }
    if (!user.name && name) {
      await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
    }
    user = { ...user, name: user.name || name, phone: user.phone || phone };
  }
  return user;
}

async function placeCheckoutOrders(user, items) {
  const placedOrders = [];
  for (const cartItem of items) {
    const { id, type, quantity = 1 } = cartItem;

    if (type === 'bag') {
      const bag = await db.prepare(
        'UPDATE surprise_bags SET quantity = quantity - ? WHERE id = ? AND quantity >= ? RETURNING *'
      ).get(quantity, id, quantity);
      if (!bag) {
        throw new Error(`Surprise bag #${id} is no longer available in the requested quantity`);
      }
      const store = await db.prepare('SELECT * FROM stores WHERE id = ? AND is_active = TRUE').get(bag.store_id);
      if (!store) {
        throw new Error(`Store for surprise bag #${id} is unavailable`);
      }
      const orderInfo = await db.prepare(
        'INSERT INTO orders (bag_id, type, quantity, store_id, customer_id, price, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(bag.id, 'bag', quantity, bag.store_id, user.id, bag.price, 'Cash at Pickup');
      placedOrders.push({
        id: orderInfo.lastInsertRowid,
        type: 'bag',
        store_name: store.name,
        store_address: store.address || '',
        item_name: bag.description || 'Surprise Bag',
        quantity,
        price: bag.price,
        pickup_time: bag.pickup_time || 'During opening hours'
      });
    } else if (type === 'food') {
      const food = await db.prepare(
        'UPDATE food_items SET quantity = quantity - ? WHERE id = ? AND is_available = TRUE AND quantity >= ? RETURNING *'
      ).get(quantity, id, quantity);
      if (!food) {
        throw new Error(`Food item #${id} is no longer available in the requested quantity`);
      }
      const store = await db.prepare('SELECT * FROM stores WHERE id = ? AND is_active = TRUE').get(food.store_id);
      if (!store) {
        throw new Error(`Store for food item #${id} is unavailable`);
      }
      const orderInfo = await db.prepare(
        'INSERT INTO orders (food_item_id, type, quantity, store_id, customer_id, price, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(food.id, 'food', quantity, food.store_id, user.id, food.price, 'Cash at Pickup');
      placedOrders.push({
        id: orderInfo.lastInsertRowid,
        type: 'food',
        store_name: store.name,
        store_address: store.address || '',
        item_name: food.name,
        quantity,
        price: food.price,
        pickup_time: food.pickup_time || 'During opening hours'
      });
    }
  }
  if (placedOrders.length === 0) {
    throw new Error('No valid items could be ordered');
  }
  return placedOrders;
}

function parseExpiresAt(expiresAt) {
  let value = expiresAt;
  if (typeof value === 'string' && !value.includes('T') && !value.includes('Z')) {
    value = value.replace(' ', 'T') + 'Z';
  }
  return new Date(value);
}

async function confirmCheckoutWithIdempotency({ email, otp, idempotencyKey }) {
  const normalizedEmail = email.trim();
  const normalizedOtp = String(otp).trim();

  return db.transaction(async () => {
    if (idempotencyKey) {
      const cached = await db.prepare(
        'SELECT response FROM checkout_idempotency WHERE idempotency_key = ?'
      ).get(idempotencyKey);
      if (cached) {
        return { ...JSON.parse(cached.response), replayed: true };
      }
    }

    const pending = await db.prepare(
      'SELECT * FROM checkout_pending WHERE email = ? FOR UPDATE'
    ).get(normalizedEmail);

    if (!pending) {
      const err = new Error('No pending checkout found. Please request a verification code first.');
      err.status = 400;
      throw err;
    }

    if (pending.status === 'confirmed' && pending.confirmed_result) {
      const result = { ...JSON.parse(pending.confirmed_result), replayed: true };
      if (idempotencyKey) {
        await db.prepare(
          'INSERT INTO checkout_idempotency (idempotency_key, email, response) VALUES (?, ?, ?) ON CONFLICT (idempotency_key) DO NOTHING'
        ).run(idempotencyKey, normalizedEmail, JSON.stringify(result));
      }
      return result;
    }

    if (pending.status === 'processing') {
      const err = new Error('This checkout is already being processed. Please wait.');
      err.status = 409;
      throw err;
    }

    if (pending.otp !== normalizedOtp) {
      const err = new Error('Invalid verification code');
      err.status = 400;
      throw err;
    }

    if (new Date() > parseExpiresAt(pending.expires_at)) {
      await db.prepare('DELETE FROM checkout_pending WHERE email = ?').run(normalizedEmail);
      const err = new Error('Verification code expired. Please request a new one.');
      err.status = 400;
      throw err;
    }

    await db.prepare("UPDATE checkout_pending SET status = 'processing' WHERE email = ?").run(normalizedEmail);

    const { name, phone, items } = JSON.parse(pending.payload);
    const user = await resolveCheckoutCustomer({ name, email: normalizedEmail, phone });
    const placedOrders = await placeCheckoutOrders(user, items);

    const result = { success: true, orders: placedOrders, customerId: user.id, name, phone, email: normalizedEmail, replayed: false };

    await db.prepare(
      "UPDATE checkout_pending SET status = 'confirmed', confirmed_result = ? WHERE email = ?"
    ).run(JSON.stringify(result), normalizedEmail);

    if (idempotencyKey) {
      await db.prepare(
        'INSERT INTO checkout_idempotency (idempotency_key, email, response) VALUES (?, ?, ?) ON CONFLICT (idempotency_key) DO NOTHING'
      ).run(idempotencyKey, normalizedEmail, JSON.stringify(result));
    }

    return result;
  });
}

async function sendCheckoutOtpEmail({ to, name, otp }) {
  await sendEmail({
    to,
    subject: 'Confirm your FoodAway order',
    html: `<p>Hi ${name || 'there'},</p>
           <p>Enter this verification code to confirm your order:</p>
           <h2 style="font-size: 28px; letter-spacing: 4px; color: #EA580C; font-family: monospace;">${otp}</h2>
           <p>This code expires in <strong>5 minutes</strong>. If you did not start a checkout, you can ignore this email.</p>`,
    text: `Your FoodAway order verification code is ${otp}. Valid for 5 minutes.`
  });
}

async function sendCheckoutConfirmationEmail({ name, email, phone, placedOrders }) {
  const total = placedOrders.reduce((s, o) => s + o.price * o.quantity, 0);
  const orderRows = placedOrders.map(o => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${o.item_name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;">${o.quantity}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">£${(o.price * o.quantity).toFixed(2)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${o.store_name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${o.pickup_time}</td>
    </tr>`).join('');

  const ordersWithPayment = placedOrders.map(o => ({ ...o, payment_method: 'Cash at Pickup' }));
  const receiptPdf = await generateReceiptBuffer(ordersWithPayment, { name, email, phone });

  try {
    await sendEmail({
      to: email,
      subject: `Your FoodAway Order is Confirmed! 🎉 #${placedOrders.map(o => o.id).join(', #')}`,
      attachments: [{
        filename: 'FoodAway-Receipt.pdf',
        content: receiptPdf,
        contentType: 'application/pdf'
      }],
      html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f7f7f7;font-family:'Helvetica Neue',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg,#ff6b35 0%,#f7931e 100%);padding:40px 40px 30px;text-align:center;">
                  <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">FoodAway</h1>
                  <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">Order Confirmed ✓</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 40px 24px;">
                  <p style="margin:0 0 8px;color:#1a1a1a;font-size:16px;">Hi <strong>${name}</strong>,</p>
                  <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
                    Your order has been confirmed! Your <strong>PDF receipt is attached</strong> to this email.
                    Please pay <strong>cash at pickup</strong> and present the receipt at the store.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
                    <thead>
                      <tr style="background:#fdf5ef;">
                        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ff6b35;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
                        <th style="padding:10px 14px;text-align:center;font-size:12px;color:#ff6b35;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                        <th style="padding:10px 14px;font-size:12px;color:#ff6b35;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
                        <th style="padding:10px 14px;font-size:12px;color:#ff6b35;text-transform:uppercase;letter-spacing:0.5px;">Store</th>
                        <th style="padding:10px 14px;font-size:12px;color:#ff6b35;text-transform:uppercase;letter-spacing:0.5px;">Pickup</th>
                      </tr>
                    </thead>
                    <tbody style="font-size:14px;color:#333;">${orderRows}</tbody>
                    <tfoot>
                      <tr style="background:#fdf5ef;">
                        <td colspan="2" style="padding:12px 14px;font-weight:700;color:#1a1a1a;">Total</td>
                        <td colspan="3" style="padding:12px 14px;font-weight:700;color:#ff6b35;font-size:16px;">£${total.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <div style="margin-top:24px;padding:16px;background:#fdf5ef;border-radius:10px;border-left:4px solid #ff6b35;">
                    <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
                      <strong>Reminder:</strong> Payment is <strong>cash only at pickup</strong>. Please arrive within the pickup window.
                    </p>
                  </div>
                  <div style="margin-top:24px;text-align:center;">
                    <p style="font-size:12px;color:#999;margin:0;">Order Reference: <strong style="color:#ff6b35;">#${placedOrders.map(o => o.id).join(', #')}</strong></p>
                    <p style="font-size:12px;color:#999;margin:4px 0 0;">Ordered for: ${email} · ${phone}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background:#1a1a1a;padding:20px 40px;text-align:center;">
                  <p style="color:#666;font-size:12px;margin:0;">© ${new Date().getFullYear()} FoodAway — Reducing food waste, one meal at a time.</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>`,
      text: `Hi ${name}, your FoodAway order is confirmed! Total: £${total.toFixed(2)}. Order refs: #${placedOrders.map(o => o.id).join(', #')}. Payment: cash at pickup. Your receipt is attached.`
    });
  } catch (emailErr) {
    console.error('[Checkout Confirm] Order confirmed but receipt email failed:', emailErr);
  }
}

app.post('/api/public/checkout/send-otp', async (req, res) => {
  const { name, email, phone, items } = req.body;
  if (!name || !email || !phone || !items || !items.length) {
    return res.status(400).json({ error: 'name, email, phone, and items are required' });
  }

  try {
    const preview = await previewCheckoutItems(items);
    if (preview.length === 0) {
      return res.status(400).json({ error: 'No valid items could be ordered (check stock levels)' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const payload = JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), items });

    await db.transaction(async () => {
      await db.prepare('DELETE FROM checkout_pending WHERE email = ?').run(email.trim());
      await db.prepare(
        'INSERT INTO checkout_pending (email, otp, expires_at, payload, status) VALUES (?, ?, ?, ?, ?)'
      ).run(email.trim(), otp, expiresAt, payload, 'pending');
    });

    await sendCheckoutOtpEmail({ to: email.trim(), name: name.trim(), otp });

    res.json({ message: 'Verification code sent to your email', expiresIn: 300 });
  } catch (err) {
    console.error('[Checkout Send OTP Error]', err);
    try { await db.prepare('DELETE FROM checkout_pending WHERE email = ?').run((req.body.email || '').trim()); } catch (_) {}
    res.status(500).json({ error: err.message || 'Failed to send verification code' });
  }
});

app.post('/api/public/checkout/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    let otpPayload = null;
    await db.transaction(async () => {
      const pending = await db.prepare(
        'SELECT * FROM checkout_pending WHERE email = ? FOR UPDATE'
      ).get(email.trim());
      if (!pending) {
        const err = new Error('No pending checkout found. Please start checkout again.');
        err.status = 400;
        throw err;
      }
      if (pending.status === 'confirmed') {
        const err = new Error('This checkout is already confirmed.');
        err.status = 400;
        throw err;
      }

      const { name } = JSON.parse(pending.payload);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await db.prepare(
        "UPDATE checkout_pending SET otp = ?, expires_at = ?, status = 'pending' WHERE email = ?"
      ).run(otp, expiresAt, email.trim());

      otpPayload = { to: email.trim(), name, otp };
    });

    await sendCheckoutOtpEmail(otpPayload);

    res.json({ message: 'New verification code sent', expiresIn: 300 });
  } catch (err) {
    console.error('[Checkout Resend OTP Error]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to resend verification code' });
  }
});

app.post('/api/public/checkout/confirm', async (req, res) => {
  const { email, otp, idempotencyKey } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'email and otp are required' });
  }

  try {
    const result = await confirmCheckoutWithIdempotency({ email, otp, idempotencyKey });

    if (!result.replayed) {
      await sendCheckoutConfirmationEmail({
        name: result.name,
        email: result.email,
        phone: result.phone,
        placedOrders: result.orders
      });
    }

    const { name, phone, email: confirmedEmail, replayed, ...clientResult } = result;
    res.json(clientResult);
  } catch (err) {
    console.error('[Checkout Confirm Error]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to confirm order' });
  }
});

app.get('/api/public/orders', async (req, res) => {
  const { email, phone } = req.query;
  if (!email || !phone) return res.status(400).json({ error: 'email and phone are required' });
  try {
    const user = await db.prepare('SELECT id FROM users WHERE email = ? AND phone = ?').get(email, phone);
    if (!user) return res.json([]);
    const orders = await db.prepare(`
      SELECT o.id, o.type, o.quantity, o.price, o.payment_method, o.created_at,
             s.name as store_name, s.address,
             COALESCE(b.pickup_time, 'During opening hours') as pickup_time,
             COALESCE(b.description, f.name) as item_name
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      LEFT JOIN surprise_bags b ON o.bag_id = b.id AND o.type = 'bag'
      LEFT JOIN food_items f ON o.food_item_id = f.id AND o.type = 'food'
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC
      LIMIT 50
    `).all(user.id);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── End Public Endpoints ─────────────────────────────────────────────────────

// Start Server only if run directly
if (require.main === module) {
  const serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
  initWebSockets(serverInstance);
}

module.exports = app;

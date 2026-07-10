function getTenantId(user) {
  if (!user || user.role === 'SuperAdmin') return null;
  return user.tenant_id || null;
}

function requireTenantId(user) {
  const tenantId = getTenantId(user);
  if (!tenantId) {
    const err = new Error('User is not linked to a tenant');
    err.status = 403;
    throw err;
  }
  return tenantId;
}

function isSuperAdmin(user) {
  return user?.role === 'SuperAdmin';
}

async function assertStoreAccess(db, storeId, user) {
  const store = await db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
  if (!store) {
    const err = new Error('Store not found');
    err.status = 404;
    throw err;
  }
  if (!isSuperAdmin(user)) {
    const tenantId = requireTenantId(user);
    if (Number(store.tenant_id) !== Number(tenantId)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }
  return store;
}

async function assertBagAccess(db, bagId, user) {
  const bag = await db.prepare(`
    SELECT b.*, s.tenant_id
    FROM surprise_bags b
    JOIN stores s ON b.store_id = s.id
    WHERE b.id = ?
  `).get(bagId);
  if (!bag) {
    const err = new Error('Bag not found');
    err.status = 404;
    throw err;
  }
  if (!isSuperAdmin(user)) {
    const tenantId = requireTenantId(user);
    if (Number(bag.tenant_id) !== Number(tenantId)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }
  return bag;
}

async function assertFoodItemAccess(db, itemId, user) {
  const item = await db.prepare(`
    SELECT f.*, s.tenant_id
    FROM food_items f
    JOIN stores s ON f.store_id = s.id
    WHERE f.id = ?
  `).get(itemId);
  if (!item) {
    const err = new Error('Food item not found');
    err.status = 404;
    throw err;
  }
  if (!isSuperAdmin(user)) {
    const tenantId = requireTenantId(user);
    if (Number(item.tenant_id) !== Number(tenantId)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }
  return item;
}

async function assertOrderAccess(db, orderId, user) {
  const order = await db.prepare(`
    SELECT o.*, s.tenant_id, s.name as store_name
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE o.id = ?
  `).get(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  if (!isSuperAdmin(user)) {
    const tenantId = requireTenantId(user);
    if (Number(order.tenant_id) !== Number(tenantId)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }
  return order;
}

module.exports = {
  getTenantId,
  requireTenantId,
  isSuperAdmin,
  assertStoreAccess,
  assertBagAccess,
  assertFoodItemAccess,
  assertOrderAccess,
};

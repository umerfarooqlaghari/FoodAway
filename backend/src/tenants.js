const { allocateUniqueSubdomain } = require('./subdomain');

async function getTenantById(db, tenantId) {
  if (!tenantId) return null;
  return db.prepare(
    'SELECT id, name, subdomain, logo, phone, created_at FROM tenants WHERE id = ?'
  ).get(tenantId);
}

async function getTenantBySubdomain(db, subdomain) {
  if (!subdomain) return null;
  return db.prepare(
    'SELECT id, name, subdomain, logo, phone, created_at FROM tenants WHERE subdomain = ?'
  ).get(subdomain);
}

async function createTenant(db, { name, subdomain, logo, phone }) {
  const info = await db.prepare(
    'INSERT INTO tenants (name, subdomain, logo, phone) VALUES (?, ?, ?, ?)'
  ).run(name, subdomain || null, logo || null, phone || null);
  return getTenantById(db, info.lastInsertRowid);
}

async function getTenantForUser(db, user) {
  if (!user?.tenant_id) return null;
  return getTenantById(db, user.tenant_id);
}

async function ensureTenantSubdomain(db, tenant) {
  if (!tenant) return null;
  if (tenant.subdomain) return tenant.subdomain;
  const subdomain = await allocateUniqueSubdomain(db, tenant.name, tenant.id);
  await db.prepare('UPDATE tenants SET subdomain = ? WHERE id = ?').run(subdomain, tenant.id);
  tenant.subdomain = subdomain;
  return subdomain;
}

async function listTenantsForSuperAdmin(db) {
  return db.prepare(`
    SELECT t.id, t.name, t.subdomain, t.logo, t.phone, t.created_at,
           (
             SELECT u.id FROM users u
             WHERE u.tenant_id = t.id AND u.role = 'SellersAdmin'
             ORDER BY u.id ASC LIMIT 1
           ) AS admin_user_id,
           (
             SELECT u.email FROM users u
             WHERE u.tenant_id = t.id AND u.role = 'SellersAdmin'
             ORDER BY u.id ASC LIMIT 1
           ) AS admin_email,
           (
             SELECT COUNT(*)::int FROM stores s WHERE s.tenant_id = t.id
           ) AS store_count,
           (
             SELECT s.id FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_id,
           (
             SELECT s.name FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_name,
           (
             SELECT s.address FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_address,
           (
             SELECT s.lat FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_lat,
           (
             SELECT s.lng FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_lng
    FROM tenants t
    ORDER BY t.created_at DESC
  `).all();
}

async function getTenantDetailForSuperAdmin(db, tenantId) {
  const row = await db.prepare(`
    SELECT t.id, t.name, t.subdomain, t.logo, t.phone, t.created_at,
           (
             SELECT u.id FROM users u
             WHERE u.tenant_id = t.id AND u.role = 'SellersAdmin'
             ORDER BY u.id ASC LIMIT 1
           ) AS admin_user_id,
           (
             SELECT u.email FROM users u
             WHERE u.tenant_id = t.id AND u.role = 'SellersAdmin'
             ORDER BY u.id ASC LIMIT 1
           ) AS admin_email,
           (
             SELECT COUNT(*)::int FROM stores s WHERE s.tenant_id = t.id
           ) AS store_count,
           (
             SELECT s.id FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_id,
           (
             SELECT s.name FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_name,
           (
             SELECT s.address FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_address,
           (
             SELECT s.lat FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_lat,
           (
             SELECT s.lng FROM stores s WHERE s.tenant_id = t.id ORDER BY s.id ASC LIMIT 1
           ) AS primary_store_lng
    FROM tenants t
    WHERE t.id = ?
  `).get(tenantId);
  return row || null;
}

async function deleteTenantCascade(db, tenantId) {
  const id = Number(tenantId);
  const storeIds = (await db.prepare('SELECT id FROM stores WHERE tenant_id = ?').all(id)).map((s) => s.id);
  if (storeIds.length) {
    const placeholders = storeIds.map(() => '?').join(',');
    await db.prepare(`DELETE FROM deliveries WHERE store_id IN (${placeholders})`).run(...storeIds);
    await db.prepare(`DELETE FROM orders WHERE store_id IN (${placeholders})`).run(...storeIds);
    await db.prepare(`DELETE FROM reviews WHERE store_id IN (${placeholders})`).run(...storeIds);
    await db.prepare(`DELETE FROM chat_messages WHERE store_id IN (${placeholders})`).run(...storeIds);
    await db.prepare(`DELETE FROM favorites WHERE store_id IN (${placeholders})`).run(...storeIds);
    await db.prepare(`DELETE FROM food_items WHERE store_id IN (${placeholders})`).run(...storeIds);
    await db.prepare(`DELETE FROM surprise_bags WHERE store_id IN (${placeholders})`).run(...storeIds);
    await db.prepare(`DELETE FROM menu_items WHERE store_id IN (${placeholders})`).run(...storeIds);
    await db.prepare(`DELETE FROM stores WHERE tenant_id = ?`).run(id);
  }
  await db.prepare(`DELETE FROM users WHERE tenant_id = ?`).run(id);
  await db.prepare('DELETE FROM tenants WHERE id = ?').run(id);
}

module.exports = {
  getTenantById,
  getTenantBySubdomain,
  createTenant,
  getTenantForUser,
  ensureTenantSubdomain,
  listTenantsForSuperAdmin,
  getTenantDetailForSuperAdmin,
  deleteTenantCascade,
};

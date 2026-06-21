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
             SELECT u.email FROM users u
             WHERE u.tenant_id = t.id AND u.role = 'SellersAdmin'
             ORDER BY u.id ASC LIMIT 1
           ) AS admin_email
    FROM tenants t
    ORDER BY t.created_at DESC
  `).all();
}

module.exports = {
  getTenantById,
  getTenantBySubdomain,
  createTenant,
  getTenantForUser,
  ensureTenantSubdomain,
  listTenantsForSuperAdmin,
};

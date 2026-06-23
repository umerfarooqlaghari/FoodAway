const {
  validateSubdomain,
  allocateUniqueSubdomain,
  isSubdomainTaken,
} = require('./subdomain');
const { createTenant } = require('./tenants');

class RegistrationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Remove tenant rows left behind when seller registration failed after tenant insert
 * (no SellersAdmin user and no stores).
 */
async function deleteOrphanTenants(db) {
  await db.prepare(`
    DELETE FROM tenants t
    WHERE NOT EXISTS (
      SELECT 1 FROM users u WHERE u.tenant_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM stores s WHERE s.tenant_id = t.id
    )
  `).run();
}

/**
 * Atomically create tenant + SellersAdmin user. Rolls back on any failure so
 * subdomains are not consumed by incomplete registrations.
 */
async function registerSellerAdmin(db, {
  brandName,
  email,
  hashedPassword,
  phone,
  logoUrl,
  requestedSubdomain,
}) {
  return db.transaction(async () => {
    await deleteOrphanTenants(db);

    let subdomain;
    if (requestedSubdomain) {
      const validation = validateSubdomain(requestedSubdomain);
      if (!validation.ok) {
        throw new RegistrationError(validation.error);
      }
      subdomain = validation.subdomain;
      if (await isSubdomainTaken(db, subdomain)) {
        throw new RegistrationError('This store URL is already taken. Please choose another.');
      }
    } else {
      subdomain = await allocateUniqueSubdomain(db, brandName);
    }

    const tenant = await createTenant(db, {
      name: brandName,
      subdomain,
      logo: logoUrl,
      phone: phone || null,
    });

    const info = await db.prepare(
      'INSERT INTO users (name, email, password, role, phone, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(brandName, email, hashedPassword, 'SellersAdmin', phone || null, tenant.id);

    return {
      userId: info.lastInsertRowid,
      tenantId: tenant.id,
      subdomain,
    };
  });
}

function mapRegistrationError(err) {
  if (err instanceof RegistrationError) {
    return { status: err.status, error: err.message };
  }
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
    const detail = String(err.detail || err.message || '');
    if (detail.includes('subdomain') || String(err.constraint || '').includes('subdomain')) {
      return { status: 400, error: 'This store URL is already taken. Please choose another.' };
    }
    return { status: 400, error: 'Email already exists' };
  }
  return null;
}

module.exports = {
  RegistrationError,
  deleteOrphanTenants,
  registerSellerAdmin,
  mapRegistrationError,
};

const { siteHost } = require('./config');

const RESERVED = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'email', 'ftp', 'staging', 'dev', 'test',
  'grabengo', 'platform', 'support', 'help', 'status', 'cdn', 'static', 'assets',
]);

function slugifySubdomain(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
}

function validateSubdomain(subdomain) {
  const slug = slugifySubdomain(subdomain);
  if (!slug || slug.length < 2) {
    return { ok: false, error: 'Subdomain must be at least 2 characters (letters and numbers only).' };
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return { ok: false, error: 'Subdomain must start and end with a letter or number.' };
  }
  if (RESERVED.has(slug)) {
    return { ok: false, error: 'This subdomain is reserved. Please choose another.' };
  }
  return { ok: true, subdomain: slug };
}

function tenantStoreUrl(subdomain, { path = '' } = {}) {
  if (!subdomain) return null;
  if (process.env.NODE_ENV !== 'production') {
    const devBase = process.env.APP_DEV_STORE_BASE;
    if (devBase) {
      return devBase.replace('{subdomain}', subdomain) + path;
    }
    const port = process.env.APP_DEV_PORT ? `:${process.env.APP_DEV_PORT}` : ':5173';
    return `http://${subdomain}.localhost${port}${path}`;
  }
  return `https://${subdomain}.${siteHost}${path}`;
}

function parseSubdomainFromHost(hostHeader) {
  if (!hostHeader) return null;
  const host = String(hostHeader).split(':')[0].toLowerCase();
  if (host === siteHost || host === `www.${siteHost}` || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }
  if (host.endsWith('.localhost')) {
    const sub = host.slice(0, -'.localhost'.length).split('.')[0];
    if (!sub) return null;
    const validation = validateSubdomain(sub);
    return validation.ok ? validation.subdomain : null;
  }
  const suffix = `.${siteHost}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length).split('.')[0];
    if (!sub) return null;
    const validation = validateSubdomain(sub);
    return validation.ok ? validation.subdomain : null;
  }
  return null;
}

async function isSubdomainTaken(db, subdomain, excludeTenantId = null) {
  if (excludeTenantId != null) {
    const row = await db.prepare(
      'SELECT id FROM tenants WHERE subdomain = ? AND id <> ? LIMIT 1'
    ).get(subdomain, excludeTenantId);
    return !!row;
  }
  const row = await db.prepare(
    'SELECT id FROM tenants WHERE subdomain = ? LIMIT 1'
  ).get(subdomain);
  return !!row;
}

function shortSubdomainFromName(input) {
  const slug = slugifySubdomain(input);
  if (!slug) return 'store';
  const first = slug.split('-')[0];
  if (first.length >= 2) {
    const firstValidation = validateSubdomain(first);
    if (firstValidation.ok) return firstValidation.subdomain;
  }
  const fullValidation = validateSubdomain(slug);
  return fullValidation.ok ? fullValidation.subdomain : 'store';
}

async function allocateUniqueSubdomain(db, brandName, excludeTenantId = null) {
  let base = shortSubdomainFromName(brandName);
  const baseValidation = validateSubdomain(base);
  base = baseValidation.ok ? baseValidation.subdomain : 'store';

  let candidate = base;
  let suffix = 2;
  while (RESERVED.has(candidate) || !(validateSubdomain(candidate).ok) || await isSubdomainTaken(db, candidate, excludeTenantId)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function backfillTenantSubdomains(db) {
  const tenants = await db.prepare(`
    SELECT id, name FROM tenants
    WHERE subdomain IS NULL OR subdomain = ''
  `).all();

  for (const tenant of tenants) {
    const subdomain = await allocateUniqueSubdomain(db, tenant.name, tenant.id);
    await db.prepare('UPDATE tenants SET subdomain = ? WHERE id = ?').run(subdomain, tenant.id);
    console.log(`Assigned subdomain "${subdomain}" to tenant #${tenant.id} (${tenant.name})`);
  }
}

async function shortenTenantSubdomains(db) {
  const tenants = await db.prepare('SELECT id, name, subdomain FROM tenants').all();
  for (const tenant of tenants) {
    const target = shortSubdomainFromName(tenant.name);
    if (!target || target === tenant.subdomain) continue;
    if (!validateSubdomain(target).ok) continue;
    if (await isSubdomainTaken(db, target, tenant.id)) continue;
    await db.prepare('UPDATE tenants SET subdomain = ? WHERE id = ?').run(target, tenant.id);
    console.log(`Shortened subdomain "${tenant.subdomain}" -> "${target}" for tenant #${tenant.id} (${tenant.name})`);
  }
}

module.exports = {
  RESERVED,
  slugifySubdomain,
  shortSubdomainFromName,
  validateSubdomain,
  tenantStoreUrl,
  parseSubdomainFromHost,
  isSubdomainTaken,
  allocateUniqueSubdomain,
  backfillTenantSubdomains,
  shortenTenantSubdomains,
};

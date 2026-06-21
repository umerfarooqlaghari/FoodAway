const { getTenantBySubdomain, getTenantById } = require('./tenants');

function parseFloatParam(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveTenantFilter(db, { tenant_id, subdomain }) {
  if (subdomain) {
    const tenant = await getTenantBySubdomain(db, String(subdomain).toLowerCase());
    if (!tenant) return { error: 'Brand not found', status: 404 };
    return { tenantId: tenant.id, tenant };
  }
  if (tenant_id) {
    const id = parseInt(tenant_id, 10);
    if (!id) return { error: 'Invalid tenant_id', status: 400 };
    const tenant = await getTenantById(db, id);
    if (!tenant) return { error: 'Brand not found', status: 404 };
    return { tenantId: id, tenant };
  }
  return { tenantId: null, tenant: null };
}

function sortByNearest(items, lat, lng, latKey = 'lat', lngKey = 'lng') {
  if (lat == null || lng == null) return items;
  return [...items].sort((a, b) => {
    const da = haversineKm(lat, lng, a[latKey], a[lngKey]);
    const db = haversineKm(lat, lng, b[latKey], b[lngKey]);
    return da - db;
  });
}

function attachDistance(items, lat, lng, latKey = 'lat', lngKey = 'lng') {
  if (lat == null || lng == null) return items;
  return items.map((item) => ({
    ...item,
    distance_km: haversineKm(lat, lng, item[latKey], item[lngKey]),
  }));
}

module.exports = {
  parseFloatParam,
  haversineKm,
  resolveTenantFilter,
  sortByNearest,
  attachDistance,
};

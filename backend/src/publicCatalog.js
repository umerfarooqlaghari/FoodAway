const { getTenantBySubdomain, getTenantById } = require('./tenants');

function parseFloatParam(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

// Bounds unauthenticated catalog list endpoints so they can't return an
// unbounded (and ever-growing) result set. Callers who don't pass limit/offset
// get defaultLimit rows — generous enough to match current catalog size, but
// no longer literally unlimited as stores/bags/items accumulate over time.
function parsePagination(query, { defaultLimit = 200, maxLimit = 200 } = {}) {
  const rawLimit = parseInt(query.limit, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const rawOffset = parseInt(query.offset, 10);
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  return { limit, offset };
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

// SQL equivalent of haversineKm above, for ORDER BY when sort=nearest — sorting
// in JS only works on rows already fetched, which breaks once a tenant's row
// count exceeds the page LIMIT (the true nearest row could be past the cutoff).
// Placeholders must be filled with [lat, lat, lng] in that order.
function nearestOrderExpr(latCol, lngCol) {
  return `(2 * 6371 * asin(sqrt(
    power(sin(radians(${latCol} - ?) / 2), 2) +
    cos(radians(?)) * cos(radians(${latCol})) * power(sin(radians(${lngCol} - ?) / 2), 2)
  )))`;
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
  parsePagination,
  haversineKm,
  nearestOrderExpr,
  resolveTenantFilter,
  sortByNearest,
  attachDistance,
};

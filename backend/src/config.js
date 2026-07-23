require('dotenv').config();

const brandName = process.env.APP_BRAND_NAME || 'Grabengo';
const siteUrl = process.env.APP_SITE_URL || 'https://grabengo.store';
const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'no-reply@grabengo.store';

function siteHostFromUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

function tenantStoreUrl(subdomain, options) {
  const { tenantStoreUrl: buildUrl } = require('./subdomain');
  return buildUrl(subdomain, options);
}

// Partner delivery economics & limits (Rs)
const delivery = {
  maxRadiusKm: Number(process.env.DELIVERY_MAX_RADIUS_KM || 12),       // stores/partners deliver within this of the store
  baseFee: Number(process.env.DELIVERY_BASE_FEE || 50),                // minimum fee, covers the first baseKm
  baseKm: Number(process.env.DELIVERY_BASE_KM || 5),
  perKm: Number(process.env.DELIVERY_PER_KM || 10),                    // beyond baseKm
  roadFactor: Number(process.env.DELIVERY_ROAD_FACTOR || 1.3),         // straight-line -> road distance estimate
  dispatchRadiusKm: Number(process.env.DELIVERY_DISPATCH_RADIUS_KM || 15), // rider sees jobs from stores within this of their duty location
};

// Customer-facing delivery checkout/UI (rider partner pipeline stays active server-side).
const customerDeliveryLive = process.env.CUSTOMER_DELIVERY_LIVE === 'true';

module.exports = {
  brandName,
  delivery,
  customerDeliveryLive,
  tagline: process.env.APP_TAGLINE || 'Reducing food waste, one meal at a time.',
  siteUrl,
  siteHost: process.env.APP_SITE_HOST || siteHostFromUrl(siteUrl),
  supportEmail: process.env.APP_SUPPORT_EMAIL || 'support@grabengo.store',
  fromEmail,
  promoCode: process.env.APP_PROMO_CODE || 'Grabengo20',
  logoUrl: process.env.APP_LOGO_URL || '',
  groceriesBagUrl: process.env.APP_GROCERIES_BAG_URL || '',
  receiptFilename: `${brandName}-Receipt.pdf`,
  tenantStoreUrl,
};

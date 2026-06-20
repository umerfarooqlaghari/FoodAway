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

module.exports = {
  brandName,
  tagline: process.env.APP_TAGLINE || 'Reducing food waste, one meal at a time.',
  siteUrl,
  siteHost: process.env.APP_SITE_HOST || siteHostFromUrl(siteUrl),
  supportEmail: process.env.APP_SUPPORT_EMAIL || 'support@grabengo.store',
  fromEmail,
  promoCode: process.env.APP_PROMO_CODE || 'Grabengo20',
  logoUrl: process.env.APP_LOGO_URL || '',
  groceriesBagUrl: process.env.APP_GROCERIES_BAG_URL || '',
  receiptFilename: `${brandName}-Receipt.pdf`,
};

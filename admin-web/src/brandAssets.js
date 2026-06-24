/** Bump when replacing admin-web/public/favicon.png or favicon.svg */
export const BRAND_ASSET_V = '15';

/** Canonical Grabengo mark — same file on web and mobile (sync via scripts/sync-brand-icons.js) */
export const grabengoIcon = `/favicon.png?v=${BRAND_ASSET_V}`;
export const grabengoIconSvg = `/favicon.svg?v=${BRAND_ASSET_V}`;

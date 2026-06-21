const SITE_HOST = import.meta.env.VITE_SITE_HOST || 'grabengo.store';
const DEV_TENANT_PARAM = 'tenant';

let subdomainOverride;

export function setSubdomainOverride(value) {
  subdomainOverride = value;
}

export function clearSubdomainOverride() {
  subdomainOverride = undefined;
}

export function slugifySubdomain(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
}

export function shortSubdomainFromName(input) {
  const slug = slugifySubdomain(input);
  if (!slug) return 'store';
  const first = slug.split('-')[0];
  if (first.length >= 2) return first;
  return slug;
}

function isLocalDevHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

function devPort() {
  if (typeof window === 'undefined') return ':5173';
  return window.location.port ? `:${window.location.port}` : '';
}

export function getSubdomain() {
  if (subdomainOverride !== undefined) return subdomainOverride;
  if (typeof window === 'undefined') return null;

  if (import.meta.env.MODE === 'test') {
    try {
      const raw = localStorage.getItem('adminUser');
      if (raw) {
        const user = JSON.parse(raw);
        if (user?.subdomain) return user.subdomain;
      }
    } catch {
      // ignore malformed test auth payload
    }
  }

  const host = window.location.hostname.toLowerCase();

  if (host.endsWith('.localhost')) {
    return host.replace('.localhost', '').split('.')[0] || null;
  }

  if (host === SITE_HOST || host === `www.${SITE_HOST}`) return null;

  const suffix = `.${SITE_HOST}`;
  if (host.endsWith(suffix)) {
    return host.slice(0, -suffix.length).split('.')[0] || null;
  }

  // Legacy dev fallback: localhost?tenant=kfc
  if (host === 'localhost' || host === '127.0.0.1') {
    return new URLSearchParams(window.location.search).get(DEV_TENANT_PARAM);
  }

  return null;
}

export function isMainSite() {
  return !getSubdomain();
}

export function isTenantSite() {
  return !!getSubdomain();
}

export function tenantStoreUrl(subdomain, path = '') {
  if (!subdomain) return '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (isLocalDevHost(host) || host === 'localhost' || host === '127.0.0.1') {
      return `http://${subdomain}.localhost${devPort()}${normalizedPath}`;
    }
  }

  return `https://${subdomain}.${SITE_HOST}${normalizedPath}`;
}

export function mainSiteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (isLocalDevHost(host)) {
      return `http://localhost${devPort()}${normalizedPath}`;
    }
  }

  return `https://${SITE_HOST}${normalizedPath}`;
}

export function mainSiteRegisterUrl() {
  return mainSiteUrl('/register');
}

export { SITE_HOST, DEV_TENANT_PARAM };

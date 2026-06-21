const {
  slugifySubdomain,
  shortSubdomainFromName,
  validateSubdomain,
  parseSubdomainFromHost,
  tenantStoreUrl,
  allocateUniqueSubdomain,
  RESERVED,
} = require('../src/subdomain');

describe('subdomain utilities', () => {
  describe('slugifySubdomain', () => {
    it('slugifies brand names', () => {
      expect(slugifySubdomain('KFC')).toBe('kfc');
      expect(slugifySubdomain('  Starbucks Coffee  ')).toBe('starbucks-coffee');
      expect(slugifySubdomain('Joe\'s Pizza!!!')).toBe('joe-s-pizza');
    });

    it('shortSubdomainFromName prefers first word', () => {
      expect(shortSubdomainFromName('Alpha Devs Restaurant')).toBe('alpha');
      expect(shortSubdomainFromName('KFC')).toBe('kfc');
      expect(shortSubdomainFromName('Galaxy Mart and Bakers')).toBe('galaxy');
      expect(shortSubdomainFromName('Marhaba Super Market')).toBe('marhaba');
    });

    it('returns empty string for symbols-only input', () => {
      expect(slugifySubdomain('!!!')).toBe('');
    });

    it('truncates long names', () => {
      const long = 'a'.repeat(60);
      expect(slugifySubdomain(long).length).toBeLessThanOrEqual(48);
    });
  });

  describe('validateSubdomain', () => {
    it('accepts valid subdomains', () => {
      expect(validateSubdomain('kfc')).toEqual({ ok: true, subdomain: 'kfc' });
      expect(validateSubdomain('my-store-2')).toEqual({ ok: true, subdomain: 'my-store-2' });
    });

    it('rejects too-short subdomains', () => {
      expect(validateSubdomain('a').ok).toBe(false);
    });

    it('rejects reserved subdomains', () => {
      expect(validateSubdomain('admin').ok).toBe(false);
      expect(validateSubdomain('www').ok).toBe(false);
      expect(validateSubdomain('grabengo').ok).toBe(false);
    });

    it('rejects leading or trailing hyphens after slugify', () => {
      expect(validateSubdomain('-kfc-').ok).toBe(true);
      expect(validateSubdomain('-kfc-').subdomain).toBe('kfc');
    });

    it('normalizes case and spacing', () => {
      expect(validateSubdomain('  KFC  ')).toEqual({ ok: true, subdomain: 'kfc' });
    });
  });

  describe('parseSubdomainFromHost', () => {
    const originalHost = process.env.APP_SITE_HOST;

    beforeAll(() => {
      process.env.APP_SITE_HOST = 'grabengo.store';
    });

    afterAll(() => {
      process.env.APP_SITE_HOST = originalHost;
    });

    it('returns null for main site hosts', () => {
      expect(parseSubdomainFromHost('grabengo.store')).toBeNull();
      expect(parseSubdomainFromHost('www.grabengo.store')).toBeNull();
      expect(parseSubdomainFromHost('localhost')).toBeNull();
      expect(parseSubdomainFromHost('127.0.0.1:5173')).toBeNull();
    });

    it('extracts tenant subdomain from host', () => {
      expect(parseSubdomainFromHost('kfc.grabengo.store')).toBe('kfc');
      expect(parseSubdomainFromHost('my-store.grabengo.store:443')).toBe('my-store');
      expect(parseSubdomainFromHost('marhaba.localhost')).toBe('marhaba');
      expect(parseSubdomainFromHost('marhaba.localhost:5173')).toBe('marhaba');
    });

    it('rejects invalid tenant host segments', () => {
      expect(parseSubdomainFromHost('a.grabengo.store')).toBeNull();
      expect(parseSubdomainFromHost('admin.grabengo.store')).toBeNull();
    });
  });

  describe('tenantStoreUrl', () => {
    it('builds production store URLs', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      expect(tenantStoreUrl('kfc')).toBe('https://kfc.grabengo.store');
      expect(tenantStoreUrl('kfc', { path: '/login' })).toBe('https://kfc.grabengo.store/login');
      process.env.NODE_ENV = prev;
    });
  });

  describe('allocateUniqueSubdomain', () => {
    function createMockDb(taken = new Set()) {
      return {
        prepare: () => ({
          get: async (subdomain) => (taken.has(subdomain) ? { id: 999 } : undefined),
        }),
      };
    }

    it('uses store fallback for single-character brand slugs', async () => {
      const db = createMockDb();
      const subdomain = await allocateUniqueSubdomain(db, 'A');
      expect(subdomain).toBe('store');
      expect(validateSubdomain(subdomain).ok).toBe(true);
    });

    it('appends numeric suffix when subdomain is taken', async () => {
      const db = createMockDb(new Set(['kfc']));
      const subdomain = await allocateUniqueSubdomain(db, 'KFC');
      expect(subdomain).toBe('kfc-2');
    });

    it('skips reserved names', async () => {
      const db = createMockDb();
      const subdomain = await allocateUniqueSubdomain(db, 'admin');
      expect(subdomain).not.toBe('admin');
      expect(RESERVED.has(subdomain)).toBe(false);
    });
  });
});

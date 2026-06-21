import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  slugifySubdomain,
  getSubdomain,
  isMainSite,
  isTenantSite,
  tenantStoreUrl,
  mainSiteUrl,
  setSubdomainOverride,
  clearSubdomainOverride,
  SITE_HOST,
} from './host.js';

describe('host utilities', () => {
  beforeEach(() => {
    clearSubdomainOverride();
    localStorage.clear();
  });

  afterEach(() => {
    clearSubdomainOverride();
  });

  describe('slugifySubdomain', () => {
    it('matches backend slug rules', () => {
      expect(slugifySubdomain('KFC London')).toBe('kfc-london');
    });
  });

  describe('getSubdomain', () => {
    it('returns null on main site override', () => {
      setSubdomainOverride(null);
      expect(getSubdomain()).toBeNull();
      expect(isMainSite()).toBe(true);
      expect(isTenantSite()).toBe(false);
    });

    it('returns tenant override when set', () => {
      setSubdomainOverride('kfc');
      expect(getSubdomain()).toBe('kfc');
      expect(isTenantSite()).toBe(true);
    });

    it('reads tenant from localStorage in test mode', () => {
      localStorage.setItem('adminUser', JSON.stringify({ subdomain: 'starbucks' }));
      expect(getSubdomain()).toBe('starbucks');
    });
  });

  describe('tenantStoreUrl', () => {
    it('builds subdomain.localhost dev URLs', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:5173/'),
        writable: true,
      });
      expect(tenantStoreUrl('kfc', '/shop')).toBe('http://kfc.localhost:5173/shop');
    });

    it('builds production tenant URLs', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://grabengo.store/'),
        writable: true,
      });
      expect(tenantStoreUrl('kfc')).toBe(`https://kfc.${SITE_HOST}/`);
      expect(tenantStoreUrl('kfc', '/shop')).toBe(`https://kfc.${SITE_HOST}/shop`);
    });
  });

  describe('mainSiteUrl', () => {
    it('returns localhost URL on local dev', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:5173/'),
        writable: true,
      });
      expect(mainSiteUrl('/register')).toBe('http://localhost:5173/register');
    });
  });
});

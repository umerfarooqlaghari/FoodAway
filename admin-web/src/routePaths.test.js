import { describe, it, expect } from 'vitest';
import {
  ROUTES,
  activeTabFromPath,
  dashboardPathForTab,
} from './routePaths.js';

describe('routePaths', () => {
  it('exposes stable public and dashboard route constants', () => {
    expect(ROUTES.home).toBe('/');
    expect(ROUTES.login).toBe('/login');
    expect(ROUTES.register).toBe('/register');
    expect(ROUTES.order).toBe('/order');
    expect(ROUTES.dashboard).toBe('/dashboard');
    expect(ROUTES.dashboardStores).toBe('/dashboard/stores');
    expect(ROUTES.dashboardAppReviews).toBe('/dashboard/app-reviews');
    expect(ROUTES.doNotSell).toBe('/do-not-sell');
    expect(ROUTES.foodWaste).toBe('/food-waste');
  });

  describe('activeTabFromPath', () => {
    it.each([
      ['/dashboard', 'dashboard'],
      ['/dashboard/', 'dashboard'],
      ['/dashboard/stores', 'stores'],
      ['/dashboard/orders', 'orders'],
      ['/dashboard/reviews', 'reviews'],
      ['/dashboard/chats', 'chats'],
      ['/dashboard/staff', 'staff'],
      ['/dashboard/users', 'superadmin'],
      ['/dashboard/app-reviews', 'appreviews'],
    ])('maps %s to %s', (path, tab) => {
      expect(activeTabFromPath(path)).toBe(tab);
    });

    it('returns null for non-dashboard paths', () => {
      expect(activeTabFromPath('/login')).toBeNull();
      expect(activeTabFromPath('/order')).toBeNull();
      expect(activeTabFromPath('/privacy')).toBeNull();
    });
  });

  describe('dashboardPathForTab', () => {
    it.each([
      ['dashboard', ROUTES.dashboard],
      ['stores', ROUTES.dashboardStores],
      ['orders', ROUTES.dashboardOrders],
      ['reviews', ROUTES.dashboardReviews],
      ['chats', ROUTES.dashboardChats],
      ['staff', ROUTES.dashboardStaff],
      ['superadmin', ROUTES.dashboardUsers],
      ['appreviews', ROUTES.dashboardAppReviews],
    ])('maps tab %s to %s', (tab, path) => {
      expect(dashboardPathForTab(tab)).toBe(path);
    });

    it('falls back to dashboard for unknown tabs', () => {
      expect(dashboardPathForTab('unknown')).toBe(ROUTES.dashboard);
    });
  });
});

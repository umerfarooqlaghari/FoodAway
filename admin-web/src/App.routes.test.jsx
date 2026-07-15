import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROUTES } from './routePaths.js';
import { renderApp, clearAuth, seedAuth, sellerUser } from './test/testUtils.jsx';
import {
  mockAxiosPost,
  setupDefaultAxiosMocks,
  sellerUser as mockSeller,
} from './test/mockAxios.js';
import { superAdminUser } from './test/fixtures.js';

async function expectHeading(name) {
  expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
}

describe('App routing', () => {
  beforeEach(() => {
    clearAuth();
    setupDefaultAxiosMocks();
  });

  describe('public routes (logged out)', () => {
    it.each([
      [ROUTES.home, /Save good food/i],
      [ROUTES.login, /Platform Admin/i],
      [ROUTES.register, /Register as Seller/i],
      [ROUTES.explore, /Shop your favourite brands|Featured brands/i],
      [ROUTES.legal, /Legal Information/i],
      [ROUTES.privacy, /^Privacy Policy$/i],
      [ROUTES.cookies, /Cookie Policy/i],
      [ROUTES.terms, /Terms & Conditions/i],
      [ROUTES.contact, /^Contact Us$/i],
      [ROUTES.dsa, /DSA Disclosure/i],
      [ROUTES.doNotSell, /Do Not Sell or Share My Data/i],
      [ROUTES.foodWaste, /Food Waste Sources/i],
      [ROUTES.status, /System Status/i],
      [ROUTES.card, /Grabengo business card/i],
    ])('renders %s', async (path, matcher) => {
      renderApp(path);
      if (matcher.source.startsWith('^')) {
        await expectHeading(matcher);
      } else {
        expect(await screen.findByText(matcher)).toBeInTheDocument();
      }
    });

    it('redirects unknown paths to home', async () => {
      renderApp('/does-not-exist');
      expect(await screen.findByText(/Save good food/i)).toBeInTheDocument();
    });

    it('redirects authenticated seller away from main-site dashboard to home', async () => {
      seedAuth(mockSeller);
      renderApp(ROUTES.dashboard, { tenantSubdomain: null });
      expect(await screen.findByText(/Save good food/i)).toBeInTheDocument();
    });

    it('redirects authenticated seller on tenant site from home to dashboard', async () => {
      seedAuth(mockSeller);
      renderApp(ROUTES.home, { tenantSubdomain: 'kfc' });
      await expectHeading(/KFC Admin/i);
    });

    it('renders tenant shop storefront for logged-out visitors', async () => {
      renderApp(ROUTES.shop, { tenantSubdomain: 'kfc' });
      expect(await screen.findByText('Seller login')).toBeInTheDocument();
      expect(screen.getByText('KFC Admin')).toBeInTheDocument();
    });

    it('redirects authenticated seller on tenant site away from login to dashboard', async () => {
      seedAuth(mockSeller);
      renderApp(ROUTES.login, { tenantSubdomain: 'kfc' });
      await expectHeading(/KFC Admin/i);
    });
  });

  describe('protected dashboard routes', () => {
    it('redirects unauthenticated users to login', async () => {
      renderApp(ROUTES.dashboard, { tenantSubdomain: 'kfc' });
      expect(await screen.findByText(/Store Portal|KFC Admin Portal/i)).toBeInTheDocument();
    });

    describe('when authenticated as seller', () => {
      beforeEach(() => {
        seedAuth(mockSeller);
      });

      it.each([
        [ROUTES.dashboard, /KFC Admin/i],
        [ROUTES.dashboardStores, /Store Management/i],
        [ROUTES.dashboardOrders, /Order Management/i],
        [ROUTES.dashboardReviews, /Customer Reviews/i],
        [ROUTES.dashboardChats, /Chat Support/i],
        [ROUTES.dashboardStaff, /Staff Management/i],
      ])('seller can open %s', async (path, matcher) => {
        renderApp(path, { tenantSubdomain: 'kfc' });
        await expectHeading(matcher);
      });
    });
  });

  describe('super admin dashboard routes', () => {
    beforeEach(() => {
      setupDefaultAxiosMocks(superAdminUser);
      seedAuth(superAdminUser);
    });

    it.each([
      [ROUTES.dashboard, /Overview \(Platform\)/i],
      [ROUTES.dashboardUsers, /Platform Users/i],
      [ROUTES.dashboardAppReviews, /App Reviews/i],
    ])('super admin can open %s', async (path, matcher) => {
      renderApp(path);
      await expectHeading(matcher);
    });

    it('redirects super admin away from seller-only store route', async () => {
      renderApp(ROUTES.dashboardStores);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Overview \(Platform\)/i })).toBeInTheDocument();
      });
      expect(screen.queryByRole('heading', { name: /Store Management/i })).not.toBeInTheDocument();
    });
  });

  describe('seller role guards', () => {
    it('redirects seller away from super admin users route', async () => {
      seedAuth(mockSeller);
      renderApp(ROUTES.dashboardUsers);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /KFC Admin/i })).toBeInTheDocument();
      });
      expect(screen.queryByRole('heading', { name: /Platform Users/i })).not.toBeInTheDocument();
    });

    it('redirects seller staff away from staff management route', async () => {
      const staffUser = { ...mockSeller, role: 'SellersStaff', name: 'Staff User' };
      setupDefaultAxiosMocks(staffUser);
      seedAuth(staffUser);
      renderApp(ROUTES.dashboardStaff, { tenantSubdomain: 'kfc' });
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Staff User/i })).toBeInTheDocument();
      });
      expect(screen.queryByRole('heading', { name: /Staff Management/i })).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('navigates from landing Register as Seller link to register', async () => {
      const user = userEvent.setup();
      renderApp(ROUTES.home);
      const links = await screen.findAllByRole('link', { name: /Register as Seller/i });
      await user.click(links[0]);
      expect(await screen.findByText(/List your business on Grabengo/i)).toBeInTheDocument();
    });

    it('navigates from platform login to register', async () => {
      const user = userEvent.setup();
      renderApp(ROUTES.login);
      await user.click(screen.getByRole('link', { name: /Register your business/i }));
      expect(await screen.findByText(/List your business on Grabengo/i)).toBeInTheDocument();
    });

    it('navigates seller sidebar links', async () => {
      const user = userEvent.setup();
      seedAuth(mockSeller);
      renderApp(ROUTES.dashboard, { tenantSubdomain: 'kfc' });

      const portalNav = (await screen.findAllByRole('navigation')).find((nav) => within(nav).queryByText('Logout'));
      await user.click(within(portalNav).getByRole('link', { name: /Order Management/i }));
      await expectHeading(/Order Management/i);

      await user.click(within(portalNav).getByRole('link', { name: /Customer Reviews/i }));
      await expectHeading(/Customer Reviews/i);
    });

    it('logs in and lands on dashboard', async () => {
      const user = userEvent.setup();
      mockAxiosPost.mockImplementation((url) => {
        if (url.includes('/auth/login')) {
          return Promise.resolve({ data: { token: 'new-token', user: sellerUser } });
        }
        return Promise.resolve({ data: {} });
      });

      renderApp(ROUTES.login, { tenantSubdomain: 'kfc' });

      await user.type(screen.getByPlaceholderText('Email Address'), 'admin@kfc.test');
      await user.type(screen.getByPlaceholderText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /^Login$/i }));

      await expectHeading(/KFC Admin/i);
      expect(localStorage.getItem('adminToken')).toBe('new-token');
    });

    it('logs out and returns to login', async () => {
      const user = userEvent.setup();
      seedAuth(mockSeller);
      renderApp(ROUTES.dashboard, { tenantSubdomain: 'kfc' });

      await user.click(await screen.findByText('Logout'));
      expect(await screen.findByText(/Store Portal|KFC Admin Portal/i)).toBeInTheDocument();
      expect(localStorage.getItem('adminToken')).toBeNull();
    });
  });

  describe('legal page back navigation', () => {
    it('returns to landing from legal page when logged out', async () => {
      const user = userEvent.setup();
      renderApp(ROUTES.legal);
      await user.click(screen.getByRole('button', { name: /Back to Home/i }));
      expect(await screen.findByText(/Save good food/i)).toBeInTheDocument();
    });
  });
});

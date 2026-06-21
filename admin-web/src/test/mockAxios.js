import { vi } from 'vitest';
import { sellerUser, superAdminUser } from './fixtures.js';

export const mockAxiosGet = vi.fn();
export const mockAxiosPost = vi.fn();
export const mockAxiosPut = vi.fn();
export const mockAxiosDelete = vi.fn();

vi.mock('axios', () => ({
  default: {
    get: (...args) => mockAxiosGet(...args),
    post: (...args) => mockAxiosPost(...args),
    put: (...args) => mockAxiosPut(...args),
    delete: (...args) => mockAxiosDelete(...args),
    defaults: { headers: { common: {} } },
  },
}));

const emptyList = { data: [] };
const emptyStats = { data: { totalRevenue: 0, bagsSold: 0, dailySales: [] } };

export function setupDefaultAxiosMocks(user = sellerUser) {
  mockAxiosGet.mockImplementation((url) => {
    if (url.includes('/auth/me')) {
      return Promise.resolve({ data: user });
    }
    if (url.includes('/public/media')) {
      return Promise.resolve({ data: new Blob(), headers: { 'content-type': 'image/png' } });
    }
    if (url.includes('/public/tenants')) {
      return Promise.resolve({
        data: [{
          id: 1,
          name: 'KFC',
          subdomain: 'kfc',
          logo: null,
          store_count: 2,
          storeUrl: 'http://localhost/?tenant=kfc',
        }],
      });
    }
    if (url.includes('/public/tenant/')) {
      return Promise.resolve({
        data: {
          id: user.tenant_id || user.id,
          name: user.name,
          logo: user.logo,
          subdomain: user.subdomain || 'kfc',
          storeUrl: user.storeUrl || 'http://kfc.localhost:5173',
        },
      });
    }
    if (url.includes('/seller/stats')) {
      return Promise.resolve(emptyStats);
    }
    if (url.includes('/superadmin/tenants')) {
      return Promise.resolve(emptyList);
    }
    if (url.includes('/public/bags') || url.includes('/public/food-items')) {
      return Promise.resolve(emptyList);
    }
    if (
      url.includes('/bags')
      || url.includes('/stores')
      || url.includes('/food-items')
      || url.includes('/reviews')
      || url.includes('/seller/orders')
      || url.includes('/seller/chats')
      || url.includes('/seller/staff')
      || url.includes('/users')
      || url.includes('/app-reviews')
      || url.includes('/chat/history')
    ) {
      return Promise.resolve(emptyList);
    }
    return Promise.resolve(emptyList);
  });

  mockAxiosPost.mockResolvedValue({ data: {} });
  mockAxiosPut.mockResolvedValue({ data: {} });
  mockAxiosDelete.mockResolvedValue({ data: {} });
}

export { superAdminUser, sellerUser };

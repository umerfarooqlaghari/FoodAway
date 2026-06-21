import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { sellerUser, superAdminUser } from './fixtures.js';
import { setSubdomainOverride, clearSubdomainOverride } from '../host.js';

export { sellerUser, superAdminUser };

export function seedAuth(user, token = 'test-token') {
  localStorage.setItem('adminToken', token);
  localStorage.setItem('adminUser', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  clearSubdomainOverride();
}

export function renderApp(initialPath = '/', { authUser = null, token = 'test-token', tenantSubdomain = undefined } = {}) {
  clearSubdomainOverride();

  let resolvedUser = authUser;
  if (!resolvedUser) {
    try {
      const raw = localStorage.getItem('adminUser');
      resolvedUser = raw ? JSON.parse(raw) : null;
    } catch {
      resolvedUser = null;
    }
  }

  const tenant = tenantSubdomain === undefined
    ? (resolvedUser?.subdomain || null)
    : tenantSubdomain;

  if (tenantSubdomain === null) {
    setSubdomainOverride(null);
  } else if (tenant) {
    setSubdomainOverride(tenant);
  }

  if (authUser) {
    seedAuth(authUser, token);
  }

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
}

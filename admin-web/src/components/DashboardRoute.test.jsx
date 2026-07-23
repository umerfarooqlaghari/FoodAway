import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardRoute, { canAccessWebDashboard } from './DashboardRoute.jsx';

describe('DashboardRoute', () => {
  it('allows super admin and seller roles', () => {
    expect(canAccessWebDashboard({ role: 'SuperAdmin' })).toBe(true);
    expect(canAccessWebDashboard({ role: 'SellersAdmin' })).toBe(true);
    expect(canAccessWebDashboard({ role: 'SellersStaff' })).toBe(true);
    expect(canAccessWebDashboard({ role: 'Customers' })).toBe(false);
  });

  it('renders dashboard for authenticated seller', () => {
    render(
      <MemoryRouter>
        <DashboardRoute token="abc" user={{ role: 'SellersAdmin' }}>
          <div>Seller Dashboard</div>
        </DashboardRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Seller Dashboard')).toBeInTheDocument();
  });
});

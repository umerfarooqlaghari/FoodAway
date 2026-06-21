import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { sellerUser } from './fixtures.js';
import { setupDefaultAxiosMocks } from './mockAxios.js';
import { renderApp } from './testUtils.jsx';
import { setSubdomainOverride } from '../host.js';

describe('auth bootstrap', () => {
  beforeEach(() => {
    setupDefaultAxiosMocks();
    localStorage.clear();
    localStorage.setItem('adminToken', 'test-token');
    localStorage.setItem('adminUser', JSON.stringify(sellerUser));
    setSubdomainOverride('kfc');
  });

  it('mounts dashboard when token exists in localStorage', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    expect(localStorage.getItem('adminToken')).toBe('test-token');
    expect(await screen.findByRole('heading', { name: /KFC Admin/i })).toBeInTheDocument();
  });

  it('renderApp helper mounts dashboard for seller', async () => {
    renderApp('/dashboard', { authUser: sellerUser });
    expect(await screen.findByRole('heading', { name: /KFC Admin/i })).toBeInTheDocument();
  });
});

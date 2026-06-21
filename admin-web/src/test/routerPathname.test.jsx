import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

describe('MemoryRouter pathname', () => {
  it('preserves nested dashboard paths', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/staff']}>
        <Routes>
          <Route path="/dashboard/*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('pathname')).toHaveTextContent('/dashboard/staff');
  });
});

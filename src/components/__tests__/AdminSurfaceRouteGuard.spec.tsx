import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import AdminSurfaceRouteGuard from '@/components/AdminSurfaceRouteGuard';

let mockRole: 'viewer' | 'reception' | 'admin' = 'viewer';
let mockReady = true;

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({ role: mockRole, ready: mockReady }),
}));

function renderWithPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <AdminSurfaceRouteGuard>
              <div>guarded content</div>
            </AdminSurfaceRouteGuard>
          }
        />
        <Route path="/today" element={<div>today page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminSurfaceRouteGuard', () => {
  it('redirects viewer from admin surface to /today', async () => {
    mockRole = 'viewer';
    mockReady = true;

    renderWithPath('/analysis/dashboard');

    expect(await screen.findByText('today page')).toBeInTheDocument();
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
  });

  it('allows reception on admin surface', () => {
    mockRole = 'reception';
    mockReady = true;

    renderWithPath('/analysis/dashboard');

    expect(screen.getByText('guarded content')).toBeInTheDocument();
  });

  it('allows viewer on non-admin surface', () => {
    mockRole = 'viewer';
    mockReady = true;

    renderWithPath('/daily/table');

    expect(screen.getByText('guarded content')).toBeInTheDocument();
  });
});

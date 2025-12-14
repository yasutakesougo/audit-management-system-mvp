import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/config/featureFlags', () => ({
  useFeatureFlags: () => ({ icebergPdca: true }),
  useFeatureFlag: () => true,
}));

const authState = { currentUserRole: 'staff' as const };
vi.mock('@/features/auth/store', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

import { IcebergPdcaGate } from '@/features/iceberg-pdca/IcebergPdcaGate';

describe('IcebergPdcaGate', () => {
  it('redirects staff to view route when edit is required', async () => {
    render(
      <MemoryRouter initialEntries={['/analysis/iceberg-pdca/edit']}>
        <Routes>
          <Route
            path="/analysis/iceberg-pdca/edit"
            element={(
              <IcebergPdcaGate requireEdit>
                <div>EDIT</div>
              </IcebergPdcaGate>
            )}
          />
          <Route path="/analysis/iceberg-pdca" element={<div>VIEW</div>} />
          <Route path="/analysis" element={<div>ANALYSIS</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('VIEW')).toBeInTheDocument();
    expect(screen.queryByText('EDIT')).toBeNull();
  });

  it('allows admin to access edit route', async () => {
    (authState as { currentUserRole: 'staff' | 'admin' }).currentUserRole = 'admin';

    render(
      <MemoryRouter initialEntries={['/analysis/iceberg-pdca/edit']}>
        <Routes>
          <Route
            path="/analysis/iceberg-pdca/edit"
            element={(
              <IcebergPdcaGate requireEdit>
                <div>EDIT</div>
              </IcebergPdcaGate>
            )}
          />
          <Route path="/analysis/iceberg-pdca" element={<div>VIEW</div>} />
          <Route path="/analysis" element={<div>ANALYSIS</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('EDIT')).toBeInTheDocument();
  });
});

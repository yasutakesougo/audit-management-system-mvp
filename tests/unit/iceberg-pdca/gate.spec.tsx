import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/featureFlags')>();
  return {
    ...actual,
    useFeatureFlags: () => ({
      schedules: false,
      complianceForm: false,
      schedulesWeekV2: false,
      icebergPdca: true,
      staffAttendance: false,
      todayOps: false,
      todayLiteUi: false,
    }),
    useFeatureFlag: () => true,
  };
});

const authState = { currentUserRole: 'staff' as const };
vi.mock('@/features/auth/store', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
  canAccessDashboardAudience: (role: 'staff' | 'admin', required: 'staff' | 'admin') => {
    if (required === 'staff') return true;
    return role === 'admin';
  },
}));

import { IcebergPdcaGate } from '@/features/ibd/analysis/pdca/IcebergPdcaGate';

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

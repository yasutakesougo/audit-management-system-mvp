import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';

const lifecycle = vi.hoisted(() => ({ drift: 0, remediation: 0, provisioning: 0 }));
const navigationControl = vi.hoisted(() => ({ billingGate: null as Promise<void> | null }));
vi.mock('../router', () => ({
  router: createMemoryRouter([
    { path: '/billing', element: <div />, loader: () => navigationControl.billingGate },
    { path: '*', element: <div data-testid="diagnostic-route-content" /> },
  ], { initialEntries: ['/admin/status'] }),
}));
vi.mock('@/features/diagnostics/drift/ui/DriftMonitor', () => ({ DriftMonitor: () => {
  React.useEffect(() => { lifecycle.drift++; return () => { lifecycle.drift--; }; }, []);
  return null;
} }));
vi.mock('@/features/sp/health/remediation/RemediationAuditMonitor', () => ({ RemediationAuditMonitor: () => {
  React.useEffect(() => { lifecycle.remediation++; return () => { lifecycle.remediation--; }; }, []);
  return null;
} }));
vi.mock('../SpInitBridge', () => ({ SpInitBridge: () => {
  React.useEffect(() => { lifecycle.provisioning++; return () => { lifecycle.provisioning--; }; }, []);
  return null;
} }));
vi.mock('@/auth/MsalProvider', () => ({ MsalProvider: ({ children }: React.PropsWithChildren) => children }));
vi.mock('@/features/settings', () => ({ SettingsProvider: ({ children }: React.PropsWithChildren) => children }));
vi.mock('../theme', () => ({ ThemeRoot: ({ children }: React.PropsWithChildren) => children }));
vi.mock('@/features/demo/DemoProcedureSeeder', () => ({ DemoProcedureSeeder: () => null }));
vi.mock('@/components/WriteDisabledBanner', () => ({ WriteDisabledBanner: () => null }));
vi.mock('@/components/dev/DataLayerStatusBanner', () => ({ DataLayerStatusBanner: () => null }));
vi.mock('@/features/staff/attendance/persist', () => ({ hydrateStaffAttendanceFromStorage: vi.fn(), saveStaffAttendanceToStorage: vi.fn() }));

import App from '@/App';
import { router } from '../router';

describe('diagnostic route background effects', () => {
  beforeEach(async () => {
    useDataProviderObservabilityStore.setState({ currentProvider: 'sharepoint' });
    await router.navigate('/admin/status');
  });
  afterEach(() => {
    cleanup(); navigationControl.billingGate = null;
    useDataProviderObservabilityStore.setState({ currentProvider: null });
  });

  it('renders a cold diagnostic route without requiring the provisioning bridge to initialize the business provider', () => {
    useDataProviderObservabilityStore.setState({ currentProvider: null });
    render(<App />);
    expect(screen.getByTestId('diagnostic-route-content')).toBeInTheDocument();
    expect(lifecycle).toEqual({ drift: 0, remediation: 0, provisioning: 0 });
  });

  it.each(['/admin/status', '/admin/status/', '/ADMIN/STATUS', '/admin/%73tatus'])('starts no observers or provisioning at %s', async (path) => {
    await router.navigate(path);
    render(<App />);
    expect(lifecycle).toEqual({ drift: 0, remediation: 0, provisioning: 0 });
  });

  it('unmounts all write-capable background effects on client navigation', async () => {
    await router.navigate('/billing');
    render(<App />);
    expect(lifecycle).toEqual({ drift: 1, remediation: 1, provisioning: 1 });
    await act(async () => { await router.navigate('/admin/status?highlight=sp_list_unreachable'); });
    expect(lifecycle).toEqual({ drift: 0, remediation: 0, provisioning: 0 });
    await act(async () => { await router.navigate('/billing'); });
    expect(lifecycle).toEqual({ drift: 1, remediation: 1, provisioning: 1 });
  });
  it('keeps background effects disabled until navigation away from diagnostics completes', async () => {
    render(<App />);
    let release!: () => void;
    navigationControl.billingGate = new Promise<void>((resolve) => { release = resolve; });
    let navigation!: Promise<void>;
    await act(async () => { navigation = router.navigate('/billing'); });
    try {
      expect(lifecycle).toEqual({ drift: 0, remediation: 0, provisioning: 0 });
    } finally {
      await act(async () => { release(); await navigation; });
    }
    expect(lifecycle).toEqual({ drift: 1, remediation: 1, provisioning: 1 });
  });
});

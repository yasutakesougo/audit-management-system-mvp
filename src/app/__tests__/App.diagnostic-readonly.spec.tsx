import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';
import { createSpFetch } from '@/lib/sp/spFetch';

const lifecycle = vi.hoisted(() => ({ drift: 0, remediation: 0, provisioning: 0 }));
const navigationControl = vi.hoisted(() => ({ billingGate: null as Promise<void> | null, diagnosticGate: null as Promise<void> | null }));
vi.mock('../router', () => ({
  router: createMemoryRouter([
    { path: '/billing', element: <div />, loader: async () => { await navigationControl.billingGate; return null; } },
    { path: '/admin/status', element: <div data-testid="diagnostic-route-content" />, loader: async () => { await navigationControl.diagnosticGate; return null; } },
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
    cleanup(); navigationControl.billingGate = null; navigationControl.diagnosticGate = null;
    vi.unstubAllGlobals();
    useDataProviderObservabilityStore.setState({ currentProvider: null });
  });
  it('rejects a queued write during pending diagnostic navigation while the browser URL still points to business', async () => {
    window.history.replaceState({}, '', '/billing');
    await router.navigate('/billing');
    render(<App />);
    let releaseToken!: (value: string) => void;
    const client = createSpFetch({
      acquireToken: () => new Promise<string>((resolve) => { releaseToken = resolve; }),
      baseUrl: 'https://example.sharepoint.com/sites/test/_api/web',
      config: { VITE_DEMO_MODE: '0', VITE_SKIP_LOGIN: '0', VITE_SKIP_SHAREPOINT: '0', VITE_E2E: '0', VITE_E2E_MSAL_MOCK: '0' },
      retrySettings: { maxAttempts: 1, baseDelay: 1, capDelay: 1 }, debugEnabled: false, spSiteLegacy: '/sites/test',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    const write = client('/lists', { method: 'POST' });
    let releaseNavigation!: () => void;
    navigationControl.diagnosticGate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
    let navigation!: Promise<void>;
    await act(async () => { navigation = router.navigate('/admin/status'); });
    try {
      expect(router.state.location.pathname).toBe('/billing');
      expect(window.location.pathname).toBe('/billing');
      expect(lifecycle).toEqual({ drift: 0, remediation: 0, provisioning: 0 });
      releaseToken('synthetic-token');
      await expect(write).rejects.toThrow('DIAGNOSTIC_READ_ONLY');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      await act(async () => { releaseNavigation(); await navigation; });
      window.history.replaceState({}, '', '/');
    }
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

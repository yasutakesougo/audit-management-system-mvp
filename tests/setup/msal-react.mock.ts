import type { ReactNode } from 'react';
import { vi } from 'vitest';

// NOTE: Vitest-only shim so jsdom suites can render MSAL-aware components.

// Stub MSAL surface so UI tests can render without wiring the real provider.
type MockMsalInstance = {
  acquireTokenSilent: ReturnType<typeof vi.fn>;
  acquireTokenRedirect: ReturnType<typeof vi.fn>;
  loginRedirect: ReturnType<typeof vi.fn>;
  logoutRedirect: ReturnType<typeof vi.fn>;
};

const createMockInstance = (): MockMsalInstance => ({
  acquireTokenSilent: vi.fn(),
  acquireTokenRedirect: vi.fn(),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
});

const instance = createMockInstance();

const useMsal = vi.fn(() => ({ instance, accounts: [], inProgress: 'none' as const }));
const useIsAuthenticated = vi.fn(() => true);
const useMsalContext = vi.fn(() => ({ instance, accounts: [], inProgress: 'none' as const }));

vi.mock('@azure/msal-react', async () => {
  const React = await import('react');
  const { createElement, Fragment } = React;

  return {
    MsalProvider: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
    useMsal,
    useIsAuthenticated,
    __msalMock: {
      instance,
      useMsal,
      useIsAuthenticated,
    },
  };
});

vi.mock('@/auth/MsalProvider', async () => {
  const React = await import('react');
  const { createElement, Fragment } = React;

  return {
    MsalProvider: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
    useMsalContext,
    __msalContextMock: {
      createMockInstance,
      instance,
      useMsalContext,
    },
  };
});

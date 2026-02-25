import { authDiagnostics } from '@/features/auth/diagnostics';
import type { IPublicClientApplication } from '@azure/msal-browser';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isE2eMsalMockEnabled } from '../lib/env';

type MsalInstance = IPublicClientApplication;
type MsalReactModule = typeof import('@azure/msal-react');
type MsalProviderComponent = React.ComponentType<{ instance: MsalInstance; children: React.ReactNode }>;
type MsalAccounts = ReturnType<MsalReactModule['useMsal']>['accounts'];
type MsalInProgress = ReturnType<MsalReactModule['useMsal']>['inProgress'];

type MsalContextValue = {
  instance: MsalInstance;
  accounts: MsalAccounts;
  inProgress: MsalInProgress;
  authReady: boolean;
  listReady: boolean | null;
  setListReady: (ready: boolean) => void;
};

const MsalContext = React.createContext<MsalContextValue | null>(null);

const isVitest = typeof process !== 'undefined' && process.env.VITEST === 'true';
type ViCarrier = typeof globalThis & { vi?: typeof import('vitest')['vi'] };
const viMock = isVitest ? (globalThis as ViCarrier).vi : undefined;

const createDefaultMsalContextMock = (): MsalContextValue => ({
  instance: {
    getAllAccounts: () => [],
    getActiveAccount: () => null,
    setActiveAccount: () => undefined,
  } as unknown as MsalInstance,
  accounts: [],
  inProgress: 'none',
  authReady: true,
  listReady: null,
  setListReady: () => undefined,
});

export const __msalContextMock = viMock
  ? {
      // vi mock so unit tests can override behavior without rendering the real provider
      useMsalContext: viMock.fn((): MsalContextValue => createDefaultMsalContextMock()),
    }
  : undefined;

let loadMsalInstancePromise: Promise<MsalInstance> | null = null;
let loadMsalReactPromise: Promise<MsalReactModule> | null = null;

const globalCarrier = globalThis as typeof globalThis & {
  __MSAL_PUBLIC_CLIENT__?: IPublicClientApplication;
};

async function loadMsalInstance(): Promise<MsalInstance> {
  if (!loadMsalInstancePromise) {
    loadMsalInstancePromise = (async () => {
      try {
        // 🔥 CRITICAL: Use getPcaSingleton() to ensure SAME instance as main.tsx
        // This way, redirect handling in main.tsx + account setup in Provider = unified flow
        const { getPcaSingleton } = await import('./azureMsal');
        const { wireMsalRoleInvalidation } = await import('./msalEvents');
        const { EventType } = await import('@azure/msal-browser');

        const instance = await getPcaSingleton();

        // ✅ At this point:
        // - instance.initialize() was already called by getPcaSingleton()
        // - instance.handleRedirectPromise() was already called by main.tsx
        // - globalThis.__MSAL_PUBLIC_CLIENT__ is already set

        // We just need to ensure active account is set (if not already done by main.tsx)
        const accounts = instance.getAllAccounts();
        if (!instance.getActiveAccount() && accounts.length > 0) {
          instance.setActiveAccount(accounts[0]);
        }

        wireMsalRoleInvalidation(instance, EventType);

        // Already cached in globalThis by getPcaSingleton, but redundant assignment is harmless
        globalCarrier.__MSAL_PUBLIC_CLIENT__ = instance;

        // 📊 Collect success event
        const firstAccount = accounts[0] as { homeAccountId?: string } | undefined;
        authDiagnostics.collect({
          route: '/auth/msal-provider',
          reason: 'login-success',
          outcome: 'recovered',
          userId: firstAccount?.homeAccountId,
        });

        return instance;
      } catch (error) {
        // 📊 Collect error event
        const errorMessage = error instanceof Error ? error.message : String(error);
        authDiagnostics.collect({
          route: '/auth/msal-provider',
          reason: 'login-failure',
          outcome: 'blocked',
          detail: { errorMessage, type: 'msal-init-error' },
        });
        throw error;
      }
    })();
  }

  return loadMsalInstancePromise;
}

async function loadMsalReact(): Promise<MsalReactModule> {
  if (!loadMsalReactPromise) {
    loadMsalReactPromise = import('@azure/msal-react');
  }

  return loadMsalReactPromise;
}

export const MsalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMock = isVitest || isE2eMsalMockEnabled();

  const mockInstance = useMemo(
    () => ({
      getAllAccounts: () => [],
      getActiveAccount: () => null,
      setActiveAccount: () => undefined,
      // Provide no-op popup methods so sign-in flows in mock mode do not throw
      loginPopup: async () => ({ account: null } as never),
      acquireTokenPopup: async () => ({ accessToken: '' } as never),
    }) as unknown as MsalInstance,
    [],
  );

  const mockLogger = useMemo(
    () => ({} as ReturnType<MsalReactModule['useMsal']>['logger']),
    [],
  );

  const mockUseMsal: MsalReactModule['useMsal'] = () => {
    const isAuthenticatedE2E = typeof window !== 'undefined' && window.sessionStorage.getItem('__E2E_MOCK_AUTH__') === '1';
    const account = isAuthenticatedE2E ? {
      homeAccountId: 'e2e-home-account',
      localAccountId: 'e2e-local-account',
      environment: 'e2e-mock',
      tenantId: 'e2e-tenant',
      username: 'e2e.user@example.com',
      name: 'E2E Mock User',
    } : null;

    const accounts = account ? [account] : [];

    const instance = {
      ...mockInstance,
      getAllAccounts: () => accounts,
      getActiveAccount: () => account,
    } as unknown as MsalInstance;

    return {
      instance,
      accounts: accounts as unknown as MsalAccounts,
      inProgress: 'none',
      logger: mockLogger,
    };
  };

  const MockProvider: MsalProviderComponent = ({ children: mockChildren }) => <>{mockChildren}</>;

  const [providerState, setProviderState] = useState<{
    instance: MsalInstance;
    Provider: MsalProviderComponent;
    useMsal: MsalReactModule['useMsal'];
  } | null>(isMock ? { instance: mockInstance, Provider: MockProvider, useMsal: mockUseMsal } : null);

  useEffect(() => {
    if (isMock) return undefined;

    let isMounted = true;

    Promise.all([loadMsalInstance(), loadMsalReact()]).then(([instance, msalReact]) => {
      if (isMounted) {
        setProviderState({ instance, Provider: msalReact.MsalProvider, useMsal: msalReact.useMsal });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isMock]);

  if (!providerState) {
    return null;
  }

  const { Provider, instance, useMsal } = providerState;

  return (
    <Provider instance={instance}>
      <MsalBridge instance={instance} useMsal={useMsal}>
        {children}
      </MsalBridge>
    </Provider>
  );
};

const MsalBridge: React.FC<{ instance: MsalInstance; useMsal: MsalReactModule['useMsal']; children: React.ReactNode }> = ({
  children,
  instance,
  useMsal,
}) => {
  const { accounts, inProgress } = useMsal();
  const [listReady, setListReady] = useState<boolean | null>(null);

  const authReady =
    typeof window === 'undefined'
      ? true
      : (window as Window & { __MSAL_REDIRECT_DONE__?: boolean }).__MSAL_REDIRECT_DONE__ === true;
  const lastLogRef = useRef('');
  useEffect(() => {
    const snapshot = JSON.stringify({
      authReady,
      inProgress,
      accounts: accounts.length,
      listReady,
    });
    if (snapshot !== lastLogRef.current) {
      lastLogRef.current = snapshot;
      console.info('[msal] bridge state', {
        authReady,
        inProgress,
        accounts: accounts.length,
        listReady,
      });
    }
  }, [accounts.length, authReady, inProgress, listReady]);
  const value = useMemo(
    () => ({ instance, accounts, inProgress, authReady, listReady, setListReady }),
    [instance, accounts, inProgress, authReady, listReady],
  );

  return <MsalContext.Provider value={value}>{children}</MsalContext.Provider>;
};

export function useMsalContext(): MsalContextValue {
  if (isVitest && __msalContextMock) {
    return __msalContextMock.useMsalContext();
  }

  const context = React.useContext(MsalContext);

  if (!context) {
    throw new Error('useMsalContext must be used within an MsalProvider');
  }

  return context;
}

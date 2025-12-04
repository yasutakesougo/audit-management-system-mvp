import type { IPublicClientApplication } from '@azure/msal-browser';
import React, { useEffect, useMemo, useState } from 'react';
import { msalConfig } from './msalConfig';

type MsalInstance = IPublicClientApplication;
type MsalReactModule = typeof import('@azure/msal-react');
type MsalProviderComponent = React.ComponentType<{ instance: MsalInstance; children: React.ReactNode }>;
type MsalAccounts = ReturnType<MsalReactModule['useMsal']>['accounts'];
type MsalInProgress = ReturnType<MsalReactModule['useMsal']>['inProgress'];

type MsalContextValue = {
  instance: MsalInstance;
  accounts: MsalAccounts;
  inProgress: MsalInProgress;
};

const MsalContext = React.createContext<MsalContextValue | null>(null);

let loadMsalInstancePromise: Promise<MsalInstance> | null = null;
let loadMsalReactPromise: Promise<MsalReactModule> | null = null;

const globalCarrier = globalThis as typeof globalThis & {
  __MSAL_PUBLIC_CLIENT__?: IPublicClientApplication;
};

async function loadMsalInstance(): Promise<MsalInstance> {
  if (!loadMsalInstancePromise) {
    loadMsalInstancePromise = (async () => {
      const [{ loadMsalBrowser }, { wireMsalRoleInvalidation }] = await Promise.all([
        import('./azureMsal'),
        import('./msalEvents'),
      ]);

      const { PublicClientApplication, EventType } = await loadMsalBrowser();

      const instance = new PublicClientApplication(msalConfig);
      await instance.initialize();

      try {
        await instance.handleRedirectPromise();
      } catch (error) {
        console.warn('[msal] handleRedirectPromise failed (non-fatal)', error);
      }

      const accounts = instance.getAllAccounts();
      if (!instance.getActiveAccount() && accounts.length > 0) {
        instance.setActiveAccount(accounts[0]);
      }

      wireMsalRoleInvalidation(instance, EventType);

      globalCarrier.__MSAL_PUBLIC_CLIENT__ = instance;

      return instance;
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
  const [providerState, setProviderState] = useState<{
    instance: MsalInstance;
    Provider: MsalProviderComponent;
    useMsal: MsalReactModule['useMsal'];
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadMsalInstance(), loadMsalReact()]).then(([instance, msalReact]) => {
      if (isMounted) {
        setProviderState({ instance, Provider: msalReact.MsalProvider, useMsal: msalReact.useMsal });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

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
  const value = useMemo(() => ({ instance, accounts, inProgress }), [instance, accounts, inProgress]);

  return <MsalContext.Provider value={value}>{children}</MsalContext.Provider>;
};

export function useMsalContext(): MsalContextValue {
  const context = React.useContext(MsalContext);

  if (!context) {
    throw new Error('useMsalContext must be used within an MsalProvider');
  }

  return context;
}

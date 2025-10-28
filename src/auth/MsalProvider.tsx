import React, { useEffect, useMemo, useState } from 'react';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './msalConfig';

type MsalInstance = IPublicClientApplication;
type MsalReactModule = typeof import('@azure/msal-react');
type MsalProviderComponent = React.ComponentType<{ instance: MsalInstance; children: React.ReactNode }>;
type MsalAccounts = ReturnType<MsalReactModule['useMsal']>['accounts'];

type MsalContextValue = {
  instance: MsalInstance;
  accounts: MsalAccounts;
};

const MsalContext = React.createContext<MsalContextValue | null>(null);

let loadMsalInstancePromise: Promise<MsalInstance> | null = null;
let loadMsalReactPromise: Promise<MsalReactModule> | null = null;

async function loadMsalInstance(): Promise<MsalInstance> {
  if (!loadMsalInstancePromise) {
    loadMsalInstancePromise = (async () => {
      const [{ loadMsalBrowser }, { wireMsalRoleInvalidation }] = await Promise.all([
        import('./azureMsal'),
        import('./msalEvents'),
      ]);

      const { PublicClientApplication, EventType } = await loadMsalBrowser();

      const instance = new PublicClientApplication(msalConfig);
      wireMsalRoleInvalidation(instance, EventType);

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
  const { accounts } = useMsal();
  const value = useMemo(() => ({ instance, accounts }), [instance, accounts]);

  return <MsalContext.Provider value={value}>{children}</MsalContext.Provider>;
};

export function useMsalContext(): MsalContextValue {
  const context = React.useContext(MsalContext);

  if (!context) {
    throw new Error('useMsalContext must be used within an MsalProvider');
  }

  return context;
}

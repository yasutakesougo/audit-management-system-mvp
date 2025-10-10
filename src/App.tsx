import React, { useMemo, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from './auth/MsalProvider';
import { ThemeRoot } from './app/theme';
import Router from './app/router';
import AppShell from './app/AppShell';
import { FeatureFlagsProvider } from './config/featureFlags';
import { SchedulesProvider, demoSchedulesPort, makeGraphSchedulesPort } from '@/features/schedules/data';
import { useAuth } from './auth/useAuth';
import { GRAPH_RESOURCE } from './auth/msalConfig';
import { readBool } from './lib/env';

function App() {
  return (
    <MsalProvider>
      <ThemeRoot>
        <CssBaseline />
        <FeatureFlagsProvider>
          <SchedulesProviderBridge>
            <BrowserRouter>
              <AppShell>
                <Router />
              </AppShell>
            </BrowserRouter>
          </SchedulesProviderBridge>
        </FeatureFlagsProvider>
      </ThemeRoot>
    </MsalProvider>
  );
}

export default App;

type BridgeProps = {
  children: ReactNode;
};

const graphEnabled = readBool('VITE_FEATURE_SCHEDULES_GRAPH', false);

function SchedulesProviderBridge({ children }: BridgeProps) {
  const { acquireToken } = useAuth();

  const port = useMemo(() => {
    if (!graphEnabled) return demoSchedulesPort;
    return makeGraphSchedulesPort(() => acquireToken(GRAPH_RESOURCE));
  }, [acquireToken]);

  return <SchedulesProvider value={port}>{children}</SchedulesProvider>;
}

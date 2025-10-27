import React, { useEffect, useMemo, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { RouterProvider } from 'react-router-dom';
import { MsalProvider } from './auth/MsalProvider';
import { ThemeRoot } from './app/theme';
import { router } from './app/router';
import { routerFutureFlags } from './app/routerFuture';
import { ToastProvider, useToast } from './hooks/useToast';
import { registerNotifier } from './lib/notice';
import { SchedulesProvider, demoSchedulesPort, makeGraphSchedulesPort } from '@/features/schedules/data';
import { useAuth } from './auth/useAuth';
import { GRAPH_RESOURCE } from './auth/msalConfig';
import { readBool } from './lib/env';
import { HydrationHud } from '@/debug/HydrationHud';

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

export const ToastNotifierBridge: React.FC = () => {
  const { show } = useToast();

  useEffect(() => {
    registerNotifier((message) => {
      if (typeof message === 'string' && message.trim().length > 0) {
        show('info', message);
      }
    });
    return () => {
      registerNotifier(null);
    };
  }, [show]);

  return null;
};

function App() {
  return (
    <MsalProvider>
      <ThemeRoot>
        <CssBaseline />
        <ToastProvider>
          <SchedulesProviderBridge>
            <ToastNotifierBridge />
            <RouterProvider router={router} future={routerFutureFlags} />
          </SchedulesProviderBridge>
        </ToastProvider>
        <HydrationHud />
      </ThemeRoot>
    </MsalProvider>
  );
}

export default App;

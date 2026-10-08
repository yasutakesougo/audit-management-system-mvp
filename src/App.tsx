import { WriteDisabledBanner } from '@/components/WriteDisabledBanner';
import { DataLayerStatusBanner } from '@/components/dev/DataLayerStatusBanner';
import { HydrationHud } from '@/debug/HydrationHud';
import { SettingsProvider } from '@/features/settings';
import { hydrateStaffAttendanceFromStorage, saveStaffAttendanceToStorage } from '@/features/staff/attendance/persist';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useSyncExternalStore } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { routerFutureFlags } from './app/routerFuture';
import { SpInitBridge } from './app/SpInitBridge';
import { ThemeRoot } from './app/theme';
import { MsalProvider } from './auth/MsalProvider';
import { ToastProvider, useToast } from './hooks/useToast';
import { readBool } from './lib/env';
import { registerNotifier } from './lib/notice';
import { DataLayerGuard } from './components/DataLayerGuard';
import { DriftMonitor } from '@/features/diagnostics/drift/ui/DriftMonitor';
import { RemediationAuditMonitor } from '@/features/sp/health/remediation/RemediationAuditMonitor';
import { DemoProcedureSeeder } from '@/features/demo/DemoProcedureSeeder';
import { bindDiagnosticReadonlyRouter, getDiagnosticReadonlyBoundary, subscribeDiagnosticReadonlyBoundary } from '@/lib/diagnosticReadonly';

import { isSharePointThrottleError } from '@/lib/sp';
import Box from '@mui/material/Box';

const hydrationHudEnabled = readBool('VITE_FEATURE_HYDRATION_HUD', false);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isSharePointThrottleError(error)) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        if (isSharePointThrottleError(error)) {
          return false;
        }
        return false;
      },
    },
  },
});

export const ToastNotifierBridge: React.FC = () => {
  const { show } = useToast();
  useEffect(() => {
    registerNotifier((message) => {
      if (typeof message === 'string' && message.trim().length > 0) {
        show('info', message);
      }
    });
    return () => registerNotifier(null);
  }, [show]);
  return null;
};

const subscribeToRoute = (notify: () => void) => router.subscribe(notify);
const currentPathname = () => router.state.location.pathname;
bindDiagnosticReadonlyRouter(router);

function App() {
  useEffect(() => {
    hydrateStaffAttendanceFromStorage();
  }, []);

  useEffect(() => {
    const saveInterval = setInterval(() => {
      saveStaffAttendanceToStorage();
    }, 2000);
    return () => clearInterval(saveInterval);
  }, []);

  const pathname = useSyncExternalStore(subscribeToRoute, currentPathname, currentPathname);
  const isKiosk = pathname.startsWith('/kiosk');
  const isDiagnosticReadonly = useSyncExternalStore(subscribeDiagnosticReadonlyBoundary, getDiagnosticReadonlyBoundary, getDiagnosticReadonlyBoundary);
  const routeView = <RouterProvider router={router} future={routerFutureFlags} />;

  return (
    <MsalProvider>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <ThemeRoot>
            <CssBaseline />
            <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ flexShrink: 0 }}>
                <DataLayerStatusBanner />
                <WriteDisabledBanner />
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <ToastProvider>
                  {!isKiosk && !isDiagnosticReadonly && <DriftMonitor />}
                  {!isKiosk && !isDiagnosticReadonly && <RemediationAuditMonitor />}
                  {!isDiagnosticReadonly && <SpInitBridge />}
                  <DemoProcedureSeeder />
                  <ToastNotifierBridge />
                  {/* Diagnostics reads via its SP client, without business-provider bootstrap. */}
                  {isDiagnosticReadonly ? routeView : <DataLayerGuard>{routeView}</DataLayerGuard>}
                </ToastProvider>
              </Box>
            </Box>
            {hydrationHudEnabled && <HydrationHud />}
          </ThemeRoot>
        </SettingsProvider>
      </QueryClientProvider>
    </MsalProvider>
  );
}

export default App;

import { WriteDisabledBanner } from '@/components/WriteDisabledBanner';
import { DataLayerStatusBanner } from '@/components/dev/DataLayerStatusBanner';
import { HydrationHud } from '@/debug/HydrationHud';
import { SettingsProvider } from '@/features/settings';
import { hydrateStaffAttendanceFromStorage, saveStaffAttendanceToStorage } from '@/features/staff/attendance/persist';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
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

const hydrationHudEnabled = readBool('VITE_FEATURE_HYDRATION_HUD', false);
const queryClient = new QueryClient();

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

  return (
    <MsalProvider>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <ThemeRoot>
            <CssBaseline />
            <DataLayerStatusBanner />
            <WriteDisabledBanner />
            <ToastProvider>
              <DriftMonitor />
              <RemediationAuditMonitor />
              <SpInitBridge />
              <ToastNotifierBridge />
              <DataLayerGuard>
                <RouterProvider router={router} future={routerFutureFlags} />
              </DataLayerGuard>
            </ToastProvider>
            {hydrationHudEnabled && <HydrationHud />}
          </ThemeRoot>
        </SettingsProvider>
      </QueryClientProvider>
    </MsalProvider>
  );
}

export default App;

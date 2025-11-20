import { HydrationHud } from '@/debug/HydrationHud';
import { SchedulesProvider, demoSchedulesPort, makeGraphSchedulesPort } from '@/features/schedules/data';
import CssBaseline from '@mui/material/CssBaseline';
import React, { useEffect, useMemo, type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { routerFutureFlags } from './app/routerFuture';
import { ThemeRoot } from './app/theme';
import { GRAPH_RESOURCE } from './auth/msalConfig';
import { MsalProvider } from './auth/MsalProvider';
import { useAuth } from './auth/useAuth';
import { ToastProvider, useToast } from './hooks/useToast';
import { readBool } from './lib/env';
import { registerNotifier } from './lib/notice';

type BridgeProps = {
  children: ReactNode;
};

const graphEnabled = readBool('VITE_FEATURE_SCHEDULES_GRAPH', false);
const hydrationHudEnabled = readBool('VITE_FEATURE_HYDRATION_HUD', false);

function SchedulesProviderBridge({ children }: BridgeProps) {
  const { acquireToken } = useAuth();

  const port = useMemo(() => {
    if (!graphEnabled) return demoSchedulesPort;
    return makeGraphSchedulesPort(() => acquireToken(GRAPH_RESOURCE));
  }, [acquireToken, graphEnabled]);

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
      {/* 🔐 認証コンテキスト */}
      <ThemeRoot>
        <CssBaseline />
        {/* 🎨 MUIテーマ + グローバルスタイル */}
        <ToastProvider>
          {/* 📢 グローバルトースト通知 */}
          <SchedulesProviderBridge>
            {/* 📅 スケジュール機能のデータポート（Graph / デモ切替） */}
            <ToastNotifierBridge />
            <RouterProvider router={router} future={routerFutureFlags} />
          </SchedulesProviderBridge>
        </ToastProvider>
        {/* 🔍 開発/検証用 HUD（本番では非表示可能） */}
        {hydrationHudEnabled && <HydrationHud />}
      </ThemeRoot>
    </MsalProvider>
  );
}

export default App;

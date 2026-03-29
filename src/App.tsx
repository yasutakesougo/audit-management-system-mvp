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
    return () => {
      registerNotifier(null);
    };
  }, [show]);

  return null;
};

function App() {
  // ✅ 起動時に hydrate（1回だけ）
  useEffect(() => {
    hydrateStaffAttendanceFromStorage();
  }, []);

  // ✅ 変更時に自動保存（2秒ごと）
  useEffect(() => {
    const saveInterval = setInterval(() => {
      saveStaffAttendanceToStorage();
    }, 2000);

    return () => clearInterval(saveInterval);
  }, []);

  return (
    <MsalProvider>
      {/* 🔐 認証コンテキスト */}
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          {/* ⚙️ ユーザー表示設定 — ThemeRootより外側に配置し、density/fontSize をテーマに反映 */}
          <ThemeRoot>
            <CssBaseline />
            <DataLayerStatusBanner />
            <WriteDisabledBanner />
            {/* 🎨 MUIテーマ + グローバルスタイル */}
            <ToastProvider>
              <SpInitBridge />
              {/* 📢 グローバルトースト通知 */}
              {/* 📅 SchedulesProviderBridge removed: Port/Adapter layer was dead code.
                   All schedule hooks use useScheduleRepository() directly via repositoryFactory. */}
              <ToastNotifierBridge />

              <RouterProvider router={router} future={routerFutureFlags} />
            </ToastProvider>
            {/* 🔍 開発/検証用 HUD（本番では非表示可能） */}
            {hydrationHudEnabled && <HydrationHud />}
          </ThemeRoot>
        </SettingsProvider>
      </QueryClientProvider>
    </MsalProvider>
  );
}

export default App;

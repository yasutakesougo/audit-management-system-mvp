import { HydrationHud } from '@/debug/HydrationHud';
import type { CreateScheduleEventInput, SchedItem, SchedulesPort } from '@/features/schedules/data';
import {
  SchedulesProvider,
  demoSchedulesPort,
  makeGraphSchedulesPort,
  makeMockScheduleCreator,
  makeSharePointScheduleCreator,
  makeSharePointSchedulesPort,
  normalizeUserId,
} from '@/features/schedules/data';
import { hydrateStaffAttendanceFromStorage, saveStaffAttendanceToStorage } from '@/features/staff/attendance/persist';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useMemo, type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { routerFutureFlags } from './app/routerFuture';
import { ThemeRoot } from './app/theme';
import { GRAPH_RESOURCE } from './auth/msalConfig';
import { MsalProvider } from './auth/MsalProvider';
import { useAuth } from '@/auth/useAuth';
import type { Result } from '@/shared/result';
import { ToastProvider, useToast } from './hooks/useToast';
import { getScheduleSaveMode, readBool, readViteBool, isDemoModeEnabled, shouldSkipLogin } from './lib/env';
import { registerNotifier } from './lib/notice';
import { hasSpfxContext } from './lib/runtime';

type BridgeProps = {
  children: ReactNode;
};

// Feature flags that depend on build-time Vite variables
// Read directly from import.meta.env to ensure Cloudflare build-time values are respected
const graphEnabled = readViteBool('VITE_FEATURE_SCHEDULES_GRAPH', false);
const spEnabled = readViteBool('VITE_FEATURE_SCHEDULES_SP', false);

const hydrationHudEnabled = readBool('VITE_FEATURE_HYDRATION_HUD', false);
const scheduleSaveMode = getScheduleSaveMode();
const sharePointFeatureEnabled = spEnabled || readBool('VITE_FEATURE_SCHEDULES_SP', scheduleSaveMode === 'real');
const forceSharePointList = readBool('VITE_FORCE_SHAREPOINT', false);
const allowSharePointOutsideSpfx = readBool('VITE_ALLOW_SHAREPOINT_OUTSIDE_SPFX', false);
const sharePointCreateEnabled = sharePointFeatureEnabled;
// Runtime guard: detect SPFx context explicitly
const spfxContextAvailable = hasSpfxContext();
// Keep config-level enablement and combine with runtime capability at branch time
const sharePointListEnabled = sharePointFeatureEnabled || forceSharePointList;

const queryClient = new QueryClient();

type ScheduleCreateHandler = (input: CreateScheduleEventInput) => Promise<Result<SchedItem>>;

function SchedulesProviderBridge({ children }: BridgeProps) {
  const { acquireToken, account } = useAuth();

  // Phase 1: derive currentOwnerUserId from MSAL account.username (email → normalized staffCode)
  // Uses normalizeUserId() to align with I022-style identifiers, making future staff master lookup easier.
  const currentOwnerUserId = useMemo(() => {
    if (!account?.username) return undefined;
    const normalized = normalizeUserId(account.username);
    return normalized || undefined;
  }, [account?.username]);

  const createHandler: ScheduleCreateHandler = useMemo(
    () =>
      sharePointCreateEnabled
        ? (makeSharePointScheduleCreator({ acquireToken: () => acquireToken() }) as ScheduleCreateHandler)
        : (makeMockScheduleCreator() as ScheduleCreateHandler),
    [sharePointCreateEnabled, acquireToken],
  );

  const port = useMemo(() => {
    let selectedPort: SchedulesPort;

    // CRITICAL: In demo/skip-login mode, NEVER use SharePoint
    // Always fall back to demo port to avoid token acquisition errors
    const isDemoOrSkipLogin = isDemoModeEnabled() || shouldSkipLogin();

    const sharePointRunnable = !isDemoOrSkipLogin && sharePointListEnabled && (spfxContextAvailable || allowSharePointOutsideSpfx);

    if (sharePointRunnable) {
      if (import.meta.env.DEV) console.info('[schedules] using SharePoint port');
      selectedPort = makeSharePointSchedulesPort({
        acquireToken: () => acquireToken(),
        create: createHandler,
        currentOwnerUserId,
      });

    } else if (graphEnabled && !isDemoOrSkipLogin) {
      if (import.meta.env.DEV) console.info('[schedules] using Graph port');
      selectedPort = makeGraphSchedulesPort(() => acquireToken(GRAPH_RESOURCE), { create: createHandler });
    } else {
      if (import.meta.env.DEV) console.info('[schedules] using Demo port');
      selectedPort = {
        list: (range) => demoSchedulesPort.list(range),
        create: (input) => createHandler(input),
        update: demoSchedulesPort.update,
        remove: demoSchedulesPort.remove,
      } satisfies SchedulesPort;
    }

    return selectedPort;
  }, [createHandler, graphEnabled, sharePointListEnabled, spfxContextAvailable, currentOwnerUserId]);

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
      </QueryClientProvider>
    </MsalProvider>
  );
}

export default App;

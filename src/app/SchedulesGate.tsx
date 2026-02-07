import { useFeatureFlags } from '@/config/featureFlags';
import { getFlag } from '@/env';
import { getAppConfig } from '@/lib/env';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Development-only debug logging to avoid production noise
 */
const debug = (...args: unknown[]) => {
  if (getAppConfig().isDev) {
    // eslint-disable-next-line no-console
    console.log('[SchedulesGate]', ...args);
  }
};

export default function SchedulesGate({ children }: PropsWithChildren): JSX.Element {
  const flags = useFeatureFlags();
  const { pathname } = useLocation();

  // E2E環境では無条件でパス - 動的に確認（runtime env ロード待機のため）
  const isE2eRuntime = getFlag('VITE_E2E', false);
  if (isE2eRuntime) {
    debug('E2E bypass enabled for path:', pathname);
    return <>{children}</>;
  }

  // スケジュール関連パスの判定（startsWith で意図を明確化）
  const isScheduleRelatedPath =
    pathname === '/schedule' ||
    pathname.startsWith('/schedules') ||
    pathname.startsWith('/admin/integrated-resource-calendar');

  if (!flags.schedules && isScheduleRelatedPath) {
    debug('Blocking access to schedule path:', pathname);
    return <Navigate to="/" replace />;
  }

  debug('Allowing access to path:', pathname);
  return <>{children}</>;
}

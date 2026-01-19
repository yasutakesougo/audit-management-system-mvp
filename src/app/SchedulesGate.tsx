import { useFeatureFlags } from '@/config/featureFlags';
import { isE2E } from '@/env';
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

  // E2E環境では schedules フラグが有効な場合のみバイパス
  if (isE2E && flags.schedules) {
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

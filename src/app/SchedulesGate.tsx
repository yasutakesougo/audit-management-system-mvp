import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useFeatureFlags } from '@/config/featureFlags';
import { readBool } from '@/lib/env';

export default function SchedulesGate({ children }: PropsWithChildren): JSX.Element {
  const flags = useFeatureFlags();
  const { pathname } = useLocation();

  // E2E/デモ用: ログイン・SPチェック・E2Eフラグいずれかで素通し
  const e2eBypass = readBool('VITE_E2E', false) || readBool('VITE_SKIP_SP_CHECK', false) || readBool('VITE_SKIP_LOGIN', false);
  if (e2eBypass) {
    return <>{children}</>;
  }

  if (!flags.schedules && (pathname === '/schedule' || pathname.startsWith('/schedules'))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

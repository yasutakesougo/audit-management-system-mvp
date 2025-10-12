import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useFeatureFlags } from '@/config/featureFlags';

export default function SchedulesGate({ children }: PropsWithChildren): JSX.Element {
  const flags = useFeatureFlags();
  const { pathname } = useLocation();

  if (!flags.schedules && (pathname === '/schedule' || pathname.startsWith('/schedules'))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

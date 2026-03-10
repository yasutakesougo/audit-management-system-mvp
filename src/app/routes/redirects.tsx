/**
 * Redirect helper components.
 * Extracted from router.tsx for single-responsibility.
 */
import { useUserAuthz } from '@/auth/useUserAuthz';
import { useFeatureFlag } from '@/config/featureFlags';
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Role-aware landing redirect.
 *
 * - admin  → /dashboard (Decision Layer: 判断・俯瞰・管理)
 * - others → /today     (Execution Layer: 実行・未処理ゼロ化)
 *
 * Falls back to /dashboard if todayOps feature flag is disabled.
 */
export const DashboardRedirect: React.FC = () => {
  const location = useLocation();
  const { role } = useUserAuthz();
  const todayOpsEnabled = useFeatureFlag('todayOps');

  // admin は Decision Layer、現場スタッフは Execution Layer
  const isFieldStaff = role !== 'admin';
  const target = isFieldStaff && todayOpsEnabled ? '/today' : '/dashboard';

  return <Navigate to={`${target}${location.search}`} replace />;
};

export const SchedulesTimelineRedirect: React.FC = () => {
  const location = useLocation();
  const nextParams = new URLSearchParams(location.search);
  nextParams.set('tab', 'week');
  const suffix = nextParams.toString();
  return <Navigate to={`/schedules/week${suffix ? `?${suffix}` : ''}`} replace />;
};

export const SchedulesDayRedirect: React.FC = () => {
  const location = useLocation();
  const nextParams = new URLSearchParams(location.search);
  nextParams.set('tab', 'day');
  const suffix = nextParams.toString();
  return <Navigate to={`/schedules/week${suffix ? `?${suffix}` : ''}`} replace />;
};

export const SchedulesMonthRedirect: React.FC = () => {
  const location = useLocation();
  const nextParams = new URLSearchParams(location.search);
  nextParams.set('tab', 'month');
  const suffix = nextParams.toString();
  return <Navigate to={`/schedules/week${suffix ? `?${suffix}` : ''}`} replace />;
};

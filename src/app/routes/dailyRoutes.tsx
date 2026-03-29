/**
 * Daily record domain routes: /daily/*, /dailysupport
 */
import RequireAudience from '@/components/RequireAudience';
import { Navigate, type RouteObject } from 'react-router-dom';

import {
    SuspendedAttendanceRecordPage,
    SuspendedDailyRecordMenuPage,
    SuspendedDailyRecordPage,
    SuspendedHealthObservationPage,
    SuspendedTableDailyRecordPage,
    SuspendedTimeBasedSupportRecordPage,
    SuspendedTimeFlowSupportRecordPage,
} from './lazyPages';

export const dailyRoutes: RouteObject[] = [
  {
    path: 'daily',
    element: (
      <RequireAudience requiredRole="viewer">
        <Navigate to="/dailysupport" replace />
      </RequireAudience>
    ),
  },
  {
    path: 'dailysupport',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedDailyRecordMenuPage />
      </RequireAudience>
    ),
  },
  {
    path: 'daily/menu',
    element: (
      <RequireAudience requiredRole="viewer">
        <Navigate to="/dailysupport" replace />
      </RequireAudience>
    ),
  },
  {
    path: 'daily/table',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedTableDailyRecordPage />
      </RequireAudience>
    ),
  },
  {
    path: 'daily/activity',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedDailyRecordPage />
      </RequireAudience>
    ),
  },
  {
    path: 'daily/attendance',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedAttendanceRecordPage />
      </RequireAudience>
    ),
  },
  {
    path: 'daily/support',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedTimeBasedSupportRecordPage />
      </RequireAudience>
    ),
  },
  {
    path: 'daily/support-checklist',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedTimeFlowSupportRecordPage />
      </RequireAudience>
    ),
  },
  {
    path: 'daily/time-based',
    element: (
      <RequireAudience requiredRole="viewer">
        <Navigate to="/daily/support" replace />
      </RequireAudience>
    ),
  },
  {
    path: 'daily/health',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedHealthObservationPage />
      </RequireAudience>
    ),
  },
];

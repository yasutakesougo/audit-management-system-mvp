/**
 * Dashboard domain routes: /, /dashboard, /today, /dashboard/briefing
 */
import ProtectedRoute from '@/app/ProtectedRoute';
import { AuthCallbackRoute } from '@/auth/AuthCallbackRoute';
import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedDashboardBriefingPage,
    SuspendedMeetingGuidePage,
    SuspendedRoomManagementPage,
    SuspendedStaffDashboardPage,
    SuspendedTodayOpsPage,
} from './lazyPages';
import { DashboardRedirect } from './redirects';

export const dashboardRoutes: RouteObject[] = [
  { path: 'auth/callback', element: <AuthCallbackRoute /> },
  { index: true, element: <DashboardRedirect /> },
  { path: 'dashboard', element: <SuspendedStaffDashboardPage /> },
  { path: 'dashboard/briefing', element: <SuspendedDashboardBriefingPage /> },
  {
    path: 'today',
    element: (
      <ProtectedRoute flag="todayOps">
        <RequireAudience requiredRole="viewer">
          <SuspendedTodayOpsPage />
        </RequireAudience>
      </ProtectedRoute>
    ),
  },
  { path: 'room-management', element: <SuspendedRoomManagementPage /> },
  { path: 'meeting-guide', element: <SuspendedMeetingGuidePage /> },
  {
    path: 'compliance',
    element: (
      <RequireAudience requiredRole="viewer">
        <div className="p-4">コンプラ報告（近日公開）</div>
      </RequireAudience>
    ),
  },
];

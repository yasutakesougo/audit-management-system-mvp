/**
 * Dashboard domain routes: /, /dashboard, /today, /dashboard/briefing
 */
import HubLanding from '@/app/hubs/HubLanding';
import { withHubAudienceGuard } from '@/app/hubs/hubRouting';
import ProtectedRoute from '@/app/ProtectedRoute';
import { AuthCallbackRoute } from '@/auth/AuthCallbackRoute';
import AdminSurfaceRouteGuard from '@/components/AdminSurfaceRouteGuard';
import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedDashboardBriefingPage,
    SuspendedMeetingGuidePage,
    SuspendedOpsMetricsPage,
    SuspendedRoomManagementPage,
    SuspendedStaffDashboardPage,
    SuspendedTodayOpsPage,
} from './lazyPages';
import { DashboardRedirect } from './redirects';

export const dashboardRoutes: RouteObject[] = [
  { path: 'auth/callback', element: <AuthCallbackRoute /> },
  {
    index: true,
    element: (
      <RequireAudience requiredRole="viewer">
        <DashboardRedirect />
      </RequireAudience>
    ),
  },
  {
    path: 'dashboard',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedStaffDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'dashboard/briefing',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedDashboardBriefingPage />
      </RequireAudience>
    ),
  },
  {
    path: 'today',
    element: (
      <ProtectedRoute flag="todayOps">
        {withHubAudienceGuard(
          'today',
          <HubLanding hubId="today" hideCardsWhenKiosk>
            <SuspendedTodayOpsPage />
          </HubLanding>,
        )}
      </ProtectedRoute>
    ),
  },
  {
    path: 'room-management',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedRoomManagementPage />
      </RequireAudience>
    ),
  },
  {
    path: 'meeting-guide',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedMeetingGuidePage />
      </RequireAudience>
    ),
  },
  {
    path: 'compliance',
    element: (
      <RequireAudience requiredRole="viewer">
        <div className="p-4">コンプラ報告（近日公開）</div>
      </RequireAudience>
    ),
  },
  {
    path: 'ops',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard>
          <SuspendedOpsMetricsPage />
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
];

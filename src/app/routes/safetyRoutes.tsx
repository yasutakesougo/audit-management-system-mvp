/**
 * Safety domain routes: /incidents
 */
import RequireAudience from '@/components/RequireAudience';
import AdminSurfaceRouteGuard from '@/components/AdminSurfaceRouteGuard';
import type { RouteObject } from 'react-router-dom';

import { SuspendedExceptionCenterPage, SuspendedIncidentListPage, SuspendedNotificationAuditLogPage } from './lazyPages';

export const safetyRoutes: RouteObject[] = [
  {
    path: 'incidents',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedIncidentListPage />
      </RequireAudience>
    ),
  },
  {
    path: 'exceptions',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard>
          <SuspendedExceptionCenterPage />
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
  {
    path: 'exceptions/audit',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard>
          <SuspendedNotificationAuditLogPage />
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
];

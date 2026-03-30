/**
 * Safety domain routes: /incidents
 */
import RequireAudience from '@/components/RequireAudience';
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
        <SuspendedExceptionCenterPage />
      </RequireAudience>
    ),
  },
  {
    path: 'exceptions/audit',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedNotificationAuditLogPage />
      </RequireAudience>
    ),
  },
];

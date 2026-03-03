/**
 * Admin domain routes: /admin/*, /users/*, /staff/*, /checklist, /audit
 */
import ProtectedRoute from '@/app/ProtectedRoute';
import SchedulesGate from '@/app/SchedulesGate';
import RequireAudience from '@/components/RequireAudience';
import { isDev } from '@/env';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedAdminDashboardPage,
    SuspendedAuditPanel,
    SuspendedChecklistPage,
    SuspendedCsvImportPage,
    SuspendedDataIntegrityPage,
    SuspendedDebugZodErrorPage,
    SuspendedIndividualSupportManagementPage,
    SuspendedIntegratedResourceCalendarPage,
    SuspendedModeSwitchPage,
    SuspendedNavigationDiagnosticsPage,
    SuspendedSmokeTestPage,
    SuspendedStaffAttendanceAdminPage,
    SuspendedStaffAttendanceInput,
    SuspendedStaffPanel,
    SuspendedSupportActivityMasterPage,
    SuspendedSupportStepMasterPage,
    SuspendedUserDetailPage,
    SuspendedUsersPanel,
} from './lazyPages';

export const adminRoutes: RouteObject[] = [
  // Dev-only debug routes
  ...(isDev ? [
    { path: 'admin/debug/smoke-test', element: <SuspendedSmokeTestPage /> },
    { path: 'admin/debug/zod-error', element: <SuspendedDebugZodErrorPage /> },
  ] : []),

  {
    path: 'admin/dashboard',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedAdminDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'checklist',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedChecklistPage />
      </RequireAudience>
    ),
  },
  {
    path: 'audit',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedAuditPanel />
      </RequireAudience>
    ),
  },
  {
    path: 'users',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedUsersPanel />
      </RequireAudience>
    ),
  },
  {
    path: 'users/:userId',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedUserDetailPage />
      </RequireAudience>
    ),
  },
  {
    path: 'staff',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedStaffPanel />
      </RequireAudience>
    ),
  },
  {
    path: 'staff/attendance',
    element: (
      <ProtectedRoute>
        <RequireAudience requiredRole="reception">
          <SuspendedStaffAttendanceInput />
        </RequireAudience>
      </ProtectedRoute>
    ),
  },
  {
    path: 'admin/templates',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedSupportActivityMasterPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/step-templates',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedSupportStepMasterPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/individual-support/:userCode?',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedIndividualSupportManagementPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/staff-attendance',
    element: (
      <RequireAudience requiredRole="reception">
        <SuspendedStaffAttendanceAdminPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/integrated-resource-calendar',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="admin">
            <SuspendedIntegratedResourceCalendarPage />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'admin/navigation-diagnostics',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedNavigationDiagnosticsPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/data-integrity',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedDataIntegrityPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/csv-import',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedCsvImportPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/mode-switch',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedModeSwitchPage />
      </RequireAudience>
    ),
  },
];

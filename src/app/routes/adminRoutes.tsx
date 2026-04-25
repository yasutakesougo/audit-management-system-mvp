/**
 * Admin domain routes: /admin/*, /users/*, /staff/*, /checklist, /audit
 */
import { UserDetailRedirect } from '@/app/routes/redirects';
import ProtectedRoute from '@/app/ProtectedRoute';
import SchedulesGate from '@/app/SchedulesGate';
import RequireAudience from '@/components/RequireAudience';
import { isDev } from '@/env';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedAdminDashboardPage,
    SuspendedHealthPage,
    SuspendedAdminHubPage,
    SuspendedAuditPanel,
    SuspendedChecklistPage,
    SuspendedCsvImportPage,
    SuspendedDataIntegrityPage,
    SuspendedDebugZodErrorPage,
    SuspendedIndividualSupportManagementPage,
    SuspendedIntegratedResourceCalendarPage,
    SuspendedModeSwitchPage,
    SuspendedNavigationDiagnosticsPage,
    SuspendedOpeningVerificationPage,
    SuspendedOperationFlowSettingsPage,
    SuspendedSmokeTestPage,
    SuspendedStaffAttendanceAdminPage,
    SuspendedStaffAttendanceInput,
    SuspendedStaffPanel,
    SuspendedSupportActivityMasterPage,
    SuspendedSupportStepMasterPage,
    SuspendedUserDetailPage,
    SuspendedUsersPanel,
    SuspendedRegulatoryDashboardPage,
    SuspendedComplianceDashboardPage,
    SuspendedExceptionCenterPage,
    SuspendedTelemetryDashboardPage,
} from './lazyPages';

export const adminRoutes: RouteObject[] = [
  // Dev-only debug routes
  ...(isDev ? [
    {
      path: 'admin/debug/smoke-test',
      element: (
        <RequireAudience requiredRole="admin">
          <SuspendedSmokeTestPage />
        </RequireAudience>
      ),
    },
    {
      path: 'admin/debug/zod-error',
      element: (
        <RequireAudience requiredRole="admin">
          <SuspendedDebugZodErrorPage />
        </RequireAudience>
      ),
    },
    {
      path: 'admin/debug/opening-verification',
      element: (
        <RequireAudience requiredRole="admin">
          <SuspendedOpeningVerificationPage />
        </RequireAudience>
      ),
    },
  ] : []),

  {
    path: 'admin',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedAdminHubPage />
      </RequireAudience>
    ),
  },
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
      <RequireAudience requiredRole="reception">
        <SuspendedUsersPanel />
      </RequireAudience>
    ),
  },
  {
    path: 'users/:userId',
    element: (
      <RequireAudience requiredRole="reception">
        <UserDetailRedirect />
      </RequireAudience>
    ),
  },
  {
    path: 'users/hub/:userId',
    element: (
      <RequireAudience requiredRole="reception">
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
  {
    path: 'admin/regulatory-dashboard',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedRegulatoryDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/compliance-dashboard',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedComplianceDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'settings/operation-flow',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedOperationFlowSettingsPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/exception-center',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedExceptionCenterPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/telemetry',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedTelemetryDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/status',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedHealthPage />
      </RequireAudience>
    ),
  },
];

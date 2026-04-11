/**
 * Support Plan domain routes: /support-plan-guide, /isp-editor, /support-planning-sheet, /abc-record
 */
import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedAbcRecordPage,
    SuspendedISPComparisonEditorPage,
    SuspendedPlanningSheetListPage,
    SuspendedSupportPlanGuidePage,
    SuspendedSupportPlanningSheetPage,
    SuspendedMonitoringMeetingRecordPage,
} from './lazyPages';

export const supportPlanRoutes: RouteObject[] = [
  {
    path: 'support-plan-guide',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedSupportPlanGuidePage />
      </RequireAudience>
    ),
  },
  {
    path: 'isp-editor',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedISPComparisonEditorPage />
      </RequireAudience>
    ),
  },
  {
    path: 'isp-editor/:userId',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedISPComparisonEditorPage />
      </RequireAudience>
    ),
  },
  {
    path: 'support-planning-sheet/:planningSheetId',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedSupportPlanningSheetPage />
      </RequireAudience>
    ),
  },
  {
    path: 'planning-sheet-list',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedPlanningSheetListPage />
      </RequireAudience>
    ),
  },
  {
    path: 'abc-record',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedAbcRecordPage />
      </RequireAudience>
    ),
  },
  {
    path: 'monitoring-meeting/:userId',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedMonitoringMeetingRecordPage />
      </RequireAudience>
    ),
  },
];

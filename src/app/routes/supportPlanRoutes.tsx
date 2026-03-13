/**
 * Support Plan domain routes: /support-plan-guide, /isp-editor, /support-planning-sheet
 */
import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedISPComparisonEditorPage,
    SuspendedPlanningSheetListPage,
    SuspendedSupportPlanGuidePage,
    SuspendedSupportPlanningSheetPage,
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
    element: <SuspendedISPComparisonEditorPage />,
  },
  {
    path: 'isp-editor/:userId',
    element: <SuspendedISPComparisonEditorPage />,
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
];

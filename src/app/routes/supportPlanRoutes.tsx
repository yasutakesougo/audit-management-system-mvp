/**
 * Support Plan domain routes: /support-plan-guide, /isp-editor
 */
import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedISPComparisonEditorPage,
    SuspendedSupportPlanGuidePage,
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
];

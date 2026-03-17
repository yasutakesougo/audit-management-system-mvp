/**
 * Safety domain routes: /incidents
 */
import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';

import { SuspendedIncidentListPage } from './lazyPages';

export const safetyRoutes: RouteObject[] = [
  {
    path: 'incidents',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedIncidentListPage />
      </RequireAudience>
    ),
  },
];

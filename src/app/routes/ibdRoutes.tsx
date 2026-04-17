/**
 * IBD (強度行動障害) domain routes: /ibd*, /ibd-demo
 */
import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedIBDHubPage,
} from './lazyPages';

export const ibdRoutes: RouteObject[] = [
  {
    path: 'ibd',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedIBDHubPage />
      </RequireAudience>
    ),
  },
];

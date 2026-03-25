import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';
import { SuspendedTransportAssignmentPage } from './lazyPages';

export const transportRoutes: RouteObject[] = [
  {
    path: 'transport/assignments',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedTransportAssignmentPage />
      </RequireAudience>
    ),
  },
];

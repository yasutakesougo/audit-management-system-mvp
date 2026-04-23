import RequireAudience from '@/components/RequireAudience';
import type { RouteObject } from 'react-router-dom';
import { SuspendedTransportAssignmentPage, SuspendedTransportExecutionPage } from './lazyPages';

export const transportRoutes: RouteObject[] = [
  {
    path: 'transport/assignments',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedTransportAssignmentPage />
      </RequireAudience>
    ),
  },
  {
    path: 'transport/execution',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedTransportExecutionPage />
      </RequireAudience>
    ),
  },
];

/**
 * Record domain routes: /records/*, /billing, /handoff-timeline, /meeting-minutes/*
 */
import RequireAudience from '@/components/RequireAudience';
import { MeetingMinutesRoutes } from '@/features/meeting-minutes/routes';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedBillingPage,
    SuspendedHandoffTimelinePage,
    SuspendedMonthlyRecordPage,
    SuspendedRecordList,
} from './lazyPages';

export const recordRoutes: RouteObject[] = [
  {
    path: 'records',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedRecordList />
      </RequireAudience>
    ),
  },
  {
    path: 'records/monthly',
    element: (
      <RequireAudience requiredRole="reception">
        <SuspendedMonthlyRecordPage />
      </RequireAudience>
    ),
  },
  {
    path: 'billing',
    element: (
      <RequireAudience requiredRole="reception">
        <SuspendedBillingPage />
      </RequireAudience>
    ),
  },
  { path: 'handoff-timeline', element: <SuspendedHandoffTimelinePage /> },
  { path: 'meeting-minutes', element: MeetingMinutesRoutes.List },
  { path: 'meeting-minutes/new', element: MeetingMinutesRoutes.New },
  { path: 'meeting-minutes/:id', element: MeetingMinutesRoutes.Detail },
  { path: 'meeting-minutes/:id/edit', element: MeetingMinutesRoutes.Edit },
];

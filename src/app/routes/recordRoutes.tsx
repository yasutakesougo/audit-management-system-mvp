/**
 * Record domain routes: /records/*, /billing, /handoff-timeline, /meeting-minutes/*
 */
import HubLanding from '@/app/hubs/HubLanding';
import { withHubAudienceGuard } from '@/app/hubs/hubRouting';
import RequireAudience from '@/components/RequireAudience';
import { MeetingMinutesRoutes } from '@/features/meeting-minutes/routes';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedBillingPage,
    SuspendedBusinessJournalPreviewPage,
    SuspendedHandoffAnalysisPage,
    SuspendedHandoffTimelinePage,
    SuspendedMonthlyRecordPage,
    SuspendedPersonalJournalPage,
    SuspendedRecordList,
    SuspendedServiceProvisionFormPage,
} from './lazyPages';

export const recordRoutes: RouteObject[] = [
  {
    path: 'records',
    element: (
      withHubAudienceGuard(
        'records',
        <HubLanding hubId="records">
          <SuspendedRecordList />
        </HubLanding>,
      )
    ),
  },
  {
    path: 'records/monthly',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedMonthlyRecordPage />
      </RequireAudience>
    ),
  },
  {
    path: 'records/journal',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedBusinessJournalPreviewPage />
      </RequireAudience>
    ),
  },
  {
    path: 'records/journal/personal',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedPersonalJournalPage />
      </RequireAudience>
    ),
  },
  {
    path: 'records/service-provision',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedServiceProvisionFormPage />
      </RequireAudience>
    ),
  },
  {
    path: 'billing',
    element: (
      withHubAudienceGuard(
        'billing',
        <HubLanding hubId="billing">
          <SuspendedBillingPage />
        </HubLanding>,
      )
    ),
  },
  {
    path: 'handoff-timeline',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedHandoffTimelinePage />
      </RequireAudience>
    ),
  },
  {
    path: 'handoff-analysis',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedHandoffAnalysisPage />
      </RequireAudience>
    ),
  },
  {
    path: 'meeting-minutes',
    element: (
      <RequireAudience requiredRole="viewer">
        {MeetingMinutesRoutes.List}
      </RequireAudience>
    ),
  },
  {
    path: 'meeting-minutes/new',
    element: (
      <RequireAudience requiredRole="viewer">
        {MeetingMinutesRoutes.New}
      </RequireAudience>
    ),
  },
  {
    path: 'meeting-minutes/:id',
    element: (
      <RequireAudience requiredRole="viewer">
        {MeetingMinutesRoutes.Detail}
      </RequireAudience>
    ),
  },
  {
    path: 'meeting-minutes/:id/edit',
    element: (
      <RequireAudience requiredRole="viewer">
        {MeetingMinutesRoutes.Edit}
      </RequireAudience>
    ),
  },
];

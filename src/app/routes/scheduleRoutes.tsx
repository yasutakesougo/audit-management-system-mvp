/**
 * Schedule domain routes: /schedule*, /schedules/*
 */
import ProtectedRoute from '@/app/ProtectedRoute';
import SchedulesGate from '@/app/SchedulesGate';
import RequireAudience from '@/components/RequireAudience';
import { Navigate, type RouteObject } from 'react-router-dom';

import {
    devHarnessEnabled,
    SuspendedDevScheduleCreateDialogPage,
    SuspendedNewSchedulesWeekPage,
} from './lazyPages';
import {
    SchedulesDayRedirect,
    SchedulesMonthRedirect,
    SchedulesTimelineRedirect,
} from './redirects';

export const scheduleRoutes: RouteObject[] = [
  {
    path: 'schedule',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <Navigate to="/schedules/week" replace />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedule/*',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <Navigate to="/schedules/week" replace />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedule-ops',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <Navigate to="/schedules/week?tab=ops" replace />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <Navigate to="/schedules/week" replace />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/week',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <SuspendedNewSchedulesWeekPage />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/day',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <SchedulesDayRedirect />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/month',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <SchedulesMonthRedirect />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/timeline',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <SchedulesTimelineRedirect />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/unified',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="viewer">
            <Navigate to="/schedules/week" replace />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/create',
    element: <Navigate to="/schedules/week" replace />,
  },
  ...(devHarnessEnabled && SuspendedDevScheduleCreateDialogPage
    ? [{
        path: 'dev/schedule-create-dialog',
        element: (
          <SchedulesGate>
            <ProtectedRoute flag="schedules">
              <RequireAudience requiredRole="viewer">
                <SuspendedDevScheduleCreateDialogPage />
              </RequireAudience>
            </ProtectedRoute>
          </SchedulesGate>
        ),
      }]
    : []),
];

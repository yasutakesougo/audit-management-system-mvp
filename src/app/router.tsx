import React from 'react';
import { Navigate, createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';
import RecordList from '../features/records/RecordList';
import ChecklistPage from '../features/compliance-checklist/ChecklistPage';
import AuditPanel from '../features/audit/AuditPanel';
import { UsersPanel } from '@/features/users';
import ProtectedRoute from '@/app/ProtectedRoute';
import { routerFutureFlags } from './routerFuture';
import SchedulesGate from './SchedulesGate';

const WeekPage = React.lazy(() => import('@/features/schedule/WeekPage'));
const MonthPage = React.lazy(() => import('@/features/schedule/views/MonthView'));
const SchedulePage = React.lazy(() => import('@/features/schedule/SchedulePage'));
const ScheduleCreatePage = React.lazy(() => import('@/pages/ScheduleCreatePage'));

const SuspendedWeekPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        週表示を読み込んでいます…
      </div>
    )}
  >
    <WeekPage />
  </React.Suspense>
);

const SuspendedMonthPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        月表示を読み込んでいます…
      </div>
    )}
  >
    <MonthPage />
  </React.Suspense>
);

const SuspendedSchedulePage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        スケジュールを読み込んでいます…
      </div>
    )}
  >
    <SchedulePage />
  </React.Suspense>
);

const SuspendedCreatePage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        新規予定を読み込んでいます…
      </div>
    )}
  >
    <ScheduleCreatePage />
  </React.Suspense>
);

const childRoutes: RouteObject[] = [
  { index: true, element: <RecordList /> },
  { path: 'checklist', element: <ChecklistPage /> },
  { path: 'audit', element: <AuditPanel /> },
  { path: 'users', element: <UsersPanel /> },
  {
    path: 'schedule',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <SuspendedSchedulePage />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedule/*',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <Navigate to="/schedules/week" replace />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <Navigate to="/schedules/week" replace />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/week',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <SuspendedWeekPage />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/month',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <SuspendedMonthPage />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/create',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedulesCreate">
          <SuspendedCreatePage />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
];

const routes: RouteObject[] = [
  {
    element: (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
    children: childRoutes,
  },
];

export const router = createBrowserRouter(routes, {
  future: routerFutureFlags,
});

const RouterPlaceholder: React.FC = () => null;

export default RouterPlaceholder;

import React from 'react';
import { Navigate, createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';
import RecordList from '../features/records/RecordList';
import ChecklistPage from '../features/compliance-checklist/ChecklistPage';
import AuditPanel from '../features/audit/AuditPanel';
import { UsersPanel } from '@/features/users';
import ProtectedRoute from '@/app/ProtectedRoute';
import { routerFutureFlags } from './routerFuture';

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
      <ProtectedRoute flag="schedules">
        <SuspendedSchedulePage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'schedule/*',
    element: (
      <ProtectedRoute flag="schedules">
        <Navigate to="/schedules/week" replace />
      </ProtectedRoute>
    ),
  },
  {
    path: 'schedules',
    element: (
      <ProtectedRoute flag="schedules">
        <Navigate to="/schedules/week" replace />
      </ProtectedRoute>
    ),
  },
  {
    path: 'schedules/week',
    element: (
      <ProtectedRoute flag="schedules">
        <SuspendedWeekPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'schedules/month',
    element: (
      <ProtectedRoute flag="schedules">
        <SuspendedMonthPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'schedules/create',
    element: (
      <ProtectedRoute flag="schedulesCreate">
        <SuspendedCreatePage />
      </ProtectedRoute>
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

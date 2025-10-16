import ProtectedRoute from '@/app/ProtectedRoute';
import { StaffPanel } from '@/features/staff';
import { UsersPanel } from '@/features/users';
import React from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import AuditPanel from '../features/audit/AuditPanel';
import ChecklistPage from '../features/compliance-checklist/ChecklistPage';
import RecordList from '../features/records/RecordList';
import AppShell from './AppShell';
import { routerFutureFlags } from './routerFuture';
import SchedulesGate from './SchedulesGate';

const MonthPage = React.lazy(() => import('@/features/schedule/MonthPage'));
const SchedulePage = React.lazy(() => import('@/features/schedule/SchedulePage'));
const ScheduleCreatePage = React.lazy(() => import('@/pages/ScheduleCreatePage'));
const DailyRecordPage = React.lazy(() => import('@/pages/DailyRecordPage'));
const DailyRecordMenuPage = React.lazy(() => import('@/pages/DailyRecordMenuPage'));
const TimeFlowSupportRecordPage = React.lazy(() => import('@/pages/TimeFlowSupportRecordPage'));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const SupportActivityMasterPage = React.lazy(() => import('@/pages/SupportActivityMasterPage'));
const SupportStepMasterPage = React.lazy(() => import('@/pages/SupportStepMasterPage'));
const IndividualSupportManagementPage = React.lazy(() => import('@/pages/IndividualSupportManagementPage'));

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

const SuspendedDailyRecordPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        活動日誌を読み込んでいます…
      </div>
    )}
  >
    <DailyRecordPage />
  </React.Suspense>
);

const SuspendedDailyRecordMenuPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        日次記録メニューを読み込んでいます…
      </div>
    )}
  >
    <DailyRecordMenuPage />
  </React.Suspense>
);

const SuspendedTimeFlowSupportRecordPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        支援手順兼記録を読み込んでいます…
      </div>
    )}
  >
    <TimeFlowSupportRecordPage />
  </React.Suspense>
);

const SuspendedDashboardPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        ダッシュボードを読み込んでいます…
      </div>
    )}
  >
    <DashboardPage />
  </React.Suspense>
);

const SuspendedSupportActivityMasterPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        支援活動テンプレート管理を読み込んでいます…
      </div>
    )}
  >
    <SupportActivityMasterPage />
  </React.Suspense>
);

const SuspendedSupportStepMasterPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        支援手順テンプレート管理を読み込んでいます…
      </div>
    )}
  >
    <SupportStepMasterPage />
  </React.Suspense>
);

const SuspendedIndividualSupportManagementPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        個別支援手順管理を読み込んでいます…
      </div>
    )}
  >
    <IndividualSupportManagementPage />
  </React.Suspense>
);

const childRoutes: RouteObject[] = [
  { index: true, element: <SuspendedDashboardPage /> },
  { path: 'records', element: <RecordList /> },
  { path: 'checklist', element: <ChecklistPage /> },
  { path: 'audit', element: <AuditPanel /> },
  { path: 'users', element: <UsersPanel /> },
  { path: 'staff', element: <StaffPanel /> },
  { path: 'daily', element: <SuspendedDailyRecordMenuPage /> },
  { path: 'daily/activity', element: <SuspendedDailyRecordPage /> },
  { path: 'daily/support', element: <SuspendedTimeFlowSupportRecordPage /> },
  { path: 'admin/templates', element: <SuspendedSupportActivityMasterPage /> },
  { path: 'admin/step-templates', element: <SuspendedSupportStepMasterPage /> },
  { path: 'admin/individual-support', element: <SuspendedIndividualSupportManagementPage /> },
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
          <SuspendedSchedulePage />
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
    path: 'schedules/unified',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <Navigate to="/schedules/week" replace />
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

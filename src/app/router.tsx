import ProtectedRoute from '@/app/ProtectedRoute';
import { RouteHydrationErrorBoundary } from '@/hydration/RouteHydrationListener';
import { StaffPanel } from '@/features/staff';
import { UsersPanel } from '@/features/users';
import React from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';
import { routerFutureFlags } from './routerFuture';
import SchedulesGate from './SchedulesGate';

const RecordList = React.lazy(() => import('@/features/records/RecordList'));
const ChecklistPage = React.lazy(() => import('@/features/compliance-checklist/ChecklistPage'));
const AuditPanel = React.lazy(() => import('@/features/audit/AuditPanel'));

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
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          月表示を読み込んでいます…
        </div>
      )}
    >
      <MonthPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedSchedulePage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          スケジュールを読み込んでいます…
        </div>
      )}
    >
      <SchedulePage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedCreatePage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          新規予定を読み込んでいます…
        </div>
      )}
    >
      <ScheduleCreatePage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedDailyRecordPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          活動日誌を読み込んでいます…
        </div>
      )}
    >
      <DailyRecordPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedDailyRecordMenuPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          日次記録メニューを読み込んでいます…
        </div>
      )}
    >
      <DailyRecordMenuPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedTimeFlowSupportRecordPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          支援手順兼記録を読み込んでいます…
        </div>
      )}
    >
      <TimeFlowSupportRecordPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedDashboardPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          ダッシュボードを読み込んでいます…
        </div>
      )}
    >
      <DashboardPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedRecordList: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          記録一覧を読み込んでいます…
        </div>
      )}
    >
      <RecordList />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedChecklistPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          自己点検ページを読み込んでいます…
        </div>
      )}
    >
      <ChecklistPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedAuditPanel: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          監査ログを読み込んでいます…
        </div>
      )}
    >
      <AuditPanel />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedSupportActivityMasterPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          支援活動テンプレート管理を読み込んでいます…
        </div>
      )}
    >
      <SupportActivityMasterPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedSupportStepMasterPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          支援手順テンプレート管理を読み込んでいます…
        </div>
      )}
    >
      <SupportStepMasterPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedIndividualSupportManagementPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          個別支援手順管理を読み込んでいます…
        </div>
      )}
    >
      <IndividualSupportManagementPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const childRoutes: RouteObject[] = [
  { index: true, element: <SuspendedDashboardPage /> },
  { path: 'records', element: <SuspendedRecordList /> },
  { path: 'checklist', element: <SuspendedChecklistPage /> },
  { path: 'audit', element: <SuspendedAuditPanel /> },
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

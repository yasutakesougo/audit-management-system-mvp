import ProtectedRoute from '@/app/ProtectedRoute';
import RoleRoute from '@/app/RoleRoute';
import { getArchiveYears } from '@/features/archive/archiveUtils';
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
const HealthRecordTabletMock = React.lazy(() => import('@/pages/HealthRecordTabletMock'));
const DailyCareRecordEntryDemoPage = React.lazy(() => import('@/pages/DailyCareRecordEntryDemo'));

const MonthPage = React.lazy(() => import('@/features/schedule/MonthPage'));
const SchedulePage = React.lazy(() => import('@/features/schedule/SchedulePage'));
const ScheduleCreatePage = React.lazy(() => import('@/pages/ScheduleCreatePage'));
const HomePage = React.lazy(() => import('@/app/Home'));
const DailyRecordPage = React.lazy(() => import('@/pages/DailyRecordPage'));
const DailyRecordMenuPage = React.lazy(() => import('@/pages/DailyRecordMenuPage'));
const AttendanceRecordPage = React.lazy(() => import('@/pages/AttendanceRecordPage'));
const TimeFlowSupportRecordPage = React.lazy(() => import('@/pages/TimeFlowSupportRecordPage'));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const SupportActivityMasterPage = React.lazy(() => import('@/pages/SupportActivityMasterPage'));
const SupportStepMasterPage = React.lazy(() => import('@/pages/SupportStepMasterPage'));
const IndividualSupportManagementPage = React.lazy(() => import('@/pages/IndividualSupportManagementPage'));
const SupportPlanGuidePage = React.lazy(() => import('@/pages/SupportPlanGuidePage'));
const SupportProcedurePage = React.lazy(() => import('@/pages/SupportProcedurePage'));
const CoffeeShopPage = React.lazy(() => import('@/pages/CoffeeShopPage'));
const CoffeeShopSummaryPage = React.lazy(() => import('@/pages/CoffeeShopSummaryPage'));
const ArchiveYearPage = React.lazy(() => import('@/pages/ArchiveYearPage'));
const StaffMeetingsPage = React.lazy(() => import('@/pages/StaffMeetingsPage'));
const ActivityAlbumPage = React.lazy(() => import('@/pages/ActivityAlbumPage'));
const UserProfileFaceSheetPage = React.lazy(() => import('@/pages/UserProfileFaceSheetPage'));

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

const SuspendedAttendanceRecordPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        通所実績を読み込んでいます…
      </div>
    )}
  >
    <AttendanceRecordPage />
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

const SuspendedSupportProcedurePage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        Mirai-Canvas 連携メニューを読み込んでいます…
      </div>
    )}
  >
    <SupportProcedurePage />
  </React.Suspense>
);

const SuspendedCoffeeShopPageSummary: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        コーヒー集計ページを読み込んでいます…
      </div>
    )}
  >
    <CoffeeShopSummaryPage />
  </React.Suspense>
);

const SuspendedCoffeeShopPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        コーヒーショップボードを読み込んでいます…
      </div>
    )}
  >
    <CoffeeShopPage />
  </React.Suspense>
);

const SuspendedStaffMeetingsPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        職員会議のページを読み込んでいます…
      </div>
    )}
  >
    <StaffMeetingsPage />
  </React.Suspense>
);

const SuspendedActivityAlbumPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        活動アルバムを読み込んでいます…
      </div>
    )}
  >
    <ActivityAlbumPage />
  </React.Suspense>
);

const SuspendedArchiveYearPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        アーカイブを読み込んでいます…
      </div>
    )}
  >
    <ArchiveYearPage />
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

const SuspendedUserProfileFaceSheetPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        利用者プロファイルを読み込んでいます…
      </div>
    )}
  >
    <UserProfileFaceSheetPage />
  </React.Suspense>
);

const SuspendedHomePage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        ホームを読み込んでいます…
      </div>
    )}
  >
    <HomePage />
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

const SuspendedDailyCareRecordEntryDemoPage: React.FC = () => (
  <React.Suspense
    fallback={(
      <div className="p-4 text-sm text-slate-600" role="status">
        DailyCareデモを読み込んでいます…
      </div>
    )}
  >
    <DailyCareRecordEntryDemoPage />
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
  { path: 'health-record-tablet-mock', element: (
    <React.Suspense fallback={<div className="p-4 text-sm text-slate-600" role="status">健康記録UIを読み込んでいます…</div>}>
      <HealthRecordTabletMock />
    </React.Suspense>
  ) },
  { path: 'dailycare/record-entry-demo', element: <SuspendedDailyCareRecordEntryDemoPage /> },
  { index: true, element: <SuspendedHomePage /> },
  { path: 'dashboard', element: <SuspendedDashboardPage /> },
  { path: 'albums', element: <SuspendedActivityAlbumPage /> },
  { path: 'records', element: <RecordList /> },
  { path: 'records/diary', element: <SuspendedDailyRecordPage /> },
  { path: 'records/diary/:userId', element: <SuspendedDailyRecordPage /> },
  { path: 'records/support-procedures', element: <SuspendedTimeFlowSupportRecordPage /> },
  { path: 'records/support-procedures/:userId', element: <SuspendedTimeFlowSupportRecordPage /> },
  { path: 'checklist', element: <ChecklistPage /> },
  { path: 'audit', element: <AuditPanel /> },
  { path: 'users', element: (
    <RoleRoute required={['Admin','Manager']}>
      <UsersPanel />
    </RoleRoute>
  ) },
  { path: 'staff', element: (
    <RoleRoute required={['Admin','Manager']}>
      <StaffPanel />
    </RoleRoute>
  ) },
  { path: 'staff/meetings', element: (
    <RoleRoute required={['Admin','Manager']}>
      <SuspendedStaffMeetingsPage />
    </RoleRoute>
  ) },
  { path: 'daily', element: <SuspendedDailyRecordMenuPage /> },
  { path: 'daily/activity', element: <Navigate to="/records/diary" replace /> },
  { path: 'daily/attendance', element: <SuspendedAttendanceRecordPage /> },
  { path: 'daily/support', element: <Navigate to="/records/support-procedures" replace /> },
  { path: 'daily/procedure', element: <SuspendedSupportProcedurePage /> },
  { path: 'profiles/:userId', element: <SuspendedUserProfileFaceSheetPage /> },
  { path: 'coffee-shop', element: <SuspendedCoffeeShopPage /> },
  { path: 'coffee-shop/summary', element: <SuspendedCoffeeShopPageSummary /> },
  { path: 'archives', element: <Navigate to={`/archives/${getArchiveYears()[0]}`} replace /> },
  { path: 'archives/:year', element: <SuspendedArchiveYearPage /> },
  { path: 'admin/templates', element: (
    <RoleRoute required={['Admin']}>
      <SuspendedSupportActivityMasterPage />
    </RoleRoute>
  ) },
  { path: 'admin/step-templates', element: (
    <RoleRoute required={['Admin']}>
      <SuspendedSupportStepMasterPage />
    </RoleRoute>
  ) },
  { path: 'admin/individual-support', element: (
    <RoleRoute required={['Admin']}>
      <SuspendedIndividualSupportManagementPage />
    </RoleRoute>
  ) },
  { path: 'guide/support-plan', element: (
    <React.Suspense fallback={<div className="p-4 text-sm text-slate-600" role="status">ガイドを読み込んでいます…</div>}>
      <SupportPlanGuidePage />
    </React.Suspense>
  ) },
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

import ProtectedRoute from '@/app/ProtectedRoute';
import { useFeatureFlags } from '@/config/featureFlags';
import { nurseRoutes } from '@/features/nurse/routes/NurseRoutes';
import { LegacyDayRedirect, LegacyMonthRedirect } from '@/features/schedule/legacyRedirects';
import { StaffPanel } from '@/features/staff';
import { UsersPanel } from '@/features/users';
import { RouteHydrationErrorBoundary } from '@/hydration/RouteHydrationListener';
import { getAppConfig } from '@/lib/env';
import lazyWithPreload from '@/utils/lazyWithPreload';
import React from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject, useLocation } from 'react-router-dom';
import AppShell from './AppShell';
import { routerFutureFlags } from './routerFuture';
import SchedulesGate from './SchedulesGate';

const RecordList = React.lazy(() => import('@/features/records/RecordList'));
const ChecklistPage = React.lazy(() => import('@/features/compliance-checklist/ChecklistPage'));
const AuditPanel = React.lazy(() => import('@/features/audit/AuditPanel'));

const SchedulePage = lazyWithPreload(() => import('@/features/schedule/SchedulePage'));
const NewSchedulesWeekPage = lazyWithPreload(() => import('@/features/schedules/WeekPage'));
const ScheduleCreatePage = React.lazy(() => import('@/pages/ScheduleCreatePage'));
const DailyRecordPage = React.lazy(() => import('@/pages/DailyRecordPage'));
const DailyRecordMenuPage = React.lazy(() => import('@/pages/DailyRecordMenuPage'));
const TableDailyRecordPage = React.lazy(() => import('@/features/daily/TableDailyRecordPage'));
const TimeFlowSupportRecordPage = React.lazy(() => import('@/pages/TimeFlowSupportRecordPage'));
const TimeBasedSupportRecordPage = React.lazy(() => import('@/pages/TimeBasedSupportRecordPage'));

const HealthObservationPage = React.lazy(() => import('@/pages/HealthObservationPage'));
const AnalysisDashboardPage = React.lazy(() => import('@/pages/AnalysisDashboardPage'));
const AssessmentDashboardPage = React.lazy(() => import('@/pages/AssessmentDashboardPage'));
const TokuseiSurveyResultsPage = React.lazy(() => import('@/pages/TokuseiSurveyResultsPage'));
const IcebergPdcaPage = React.lazy(() => import('@/pages/IcebergPdcaPage'));
const IcebergAnalysisPage = React.lazy(() => import('@/pages/IcebergAnalysisPage'));
const MonthlyRecordPage = React.lazy(() => import('@/pages/MonthlyRecordPage'));

const AttendanceRecordPage = React.lazy(() => import('@/pages/AttendanceRecordPage'));
const StaffAttendanceAdminPage = React.lazy(() => import('@/pages/StaffAttendanceAdminPage'));
const StaffAttendanceInput = React.lazy(() =>
  import('@/features/staff/attendance/StaffAttendanceInput').then((module) => ({
    default: module.StaffAttendanceInput,
  })),
);

const StaffDashboardPage = React.lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({
    default: module.StaffDashboardPage ?? module.default,
  })),
);

const AdminDashboardPage = React.lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({
    default: module.AdminDashboardPage ?? module.default,
  })),
);

const DashboardBriefingPage = React.lazy(() => import('@/pages/DashboardPageTabs'));

const MeetingGuidePage = React.lazy(() => import('@/pages/MeetingGuidePage'));
const HandoffTimelinePage = React.lazy(() => import('@/pages/HandoffTimelinePage'));
const IntegratedResourceCalendarPage = React.lazy(() => import('@/pages/IntegratedResourceCalendarPage'));

const SupportActivityMasterPage = React.lazy(() => import('@/pages/SupportActivityMasterPage'));
const SupportStepMasterPage = React.lazy(() => import('@/pages/SupportStepMasterPage'));
const IndividualSupportManagementPage = React.lazy(() => import('@/pages/IndividualSupportManagementPage'));
const UserDetailPage = React.lazy(() => import('@/pages/UserDetailPage'));

// Dev harness（開発環境のみ）
const devHarnessEnabled = getAppConfig().isDev;
const DevScheduleCreateDialogPage = devHarnessEnabled
  ? React.lazy(() => import('@/features/schedules/DevScheduleCreateDialogPage'))
  : null;

const SuspendedDevScheduleCreateDialogPage: React.FC | null = DevScheduleCreateDialogPage
  ? () => (
      <RouteHydrationErrorBoundary>
        <React.Suspense
          fallback={(
            <div className="p-4 text-sm text-slate-600" role="status">
              ScheduleCreateDialog を読み込んでいます…
            </div>
          )}
        >
          <DevScheduleCreateDialogPage />
        </React.Suspense>
      </RouteHydrationErrorBoundary>
    )
  : null;

const SuspendedNewSchedulesWeekPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          週間予定を読み込んでいます…
        </div>
      )}
    >
      <NewSchedulesWeekPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedSchedulePage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          マスター スケジュールを読み込んでいます…
        </div>
      )}
    >
      <SchedulePage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

// 週間スケジュールの表示は feature flag で新旧UIを出し分ける
const SchedulesWeekRoute: React.FC = () => {
  const { schedulesWeekV2 } = useFeatureFlags();
  // schedulesWeekV2=true should surface the v2 WeekPage; keep legacy page as fallback when disabled.
  return schedulesWeekV2 ? <SuspendedNewSchedulesWeekPage /> : <SuspendedSchedulePage />;
};

const DashboardRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/dashboard${location.search}`} replace />;
};

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
          支援記録（ケース記録）を読み込んでいます…
        </div>
      )}
    >
      <DailyRecordPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedMonthlyRecordPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          月次記録を読み込んでいます…
        </div>
      )}
    >
      <MonthlyRecordPage />
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

const SuspendedTableDailyRecordPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          一覧形式ケース記録を読み込んでいます…
        </div>
      )}
    >
      <TableDailyRecordPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);
const SuspendedAttendanceRecordPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          通所管理ページを読み込んでいます…
        </div>
      )}
    >
      <AttendanceRecordPage />
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

const SuspendedTimeBasedSupportRecordPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          時間別支援記録を読み込んでいます…
        </div>
      )}
    >
      <TimeBasedSupportRecordPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedAnalysisDashboardPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          行動分析ダッシュボードを読み込んでいます…
        </div>
      )}
    >
      <AnalysisDashboardPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

import { IcebergPdcaGate } from '@/features/iceberg-pdca/IcebergPdcaGate';
const SuspendedIcebergPdcaPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          氷山PDCAボードを読み込んでいます…
        </div>
      )}
    >
      <IcebergPdcaPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedIcebergAnalysisPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          氷山分析ワークスペースを読み込んでいます…
        </div>
      )}
    >
      <IcebergAnalysisPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedAssessmentDashboardPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          アセスメント管理ページを読み込んでいます…
        </div>
      )}
    >
      <AssessmentDashboardPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedTokuseiSurveyResultsPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          特性アンケート結果を読み込んでいます…
        </div>
      )}
    >
      <TokuseiSurveyResultsPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedHealthObservationPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          健康記録入力画面を読み込んでいます…
        </div>
      )}
    >
      <HealthObservationPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedStaffDashboardPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          ダッシュボードを読み込んでいます…
        </div>
      )}
    >
      <StaffDashboardPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedAdminDashboardPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          管理者ダッシュボードを読み込んでいます…
        </div>
      )}
    >
      <AdminDashboardPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedRecordList: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          黒ノートを読み込んでいます…
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

const SuspendedStaffAttendanceInput: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          職員勤怠入力を読み込んでいます…
        </div>
      )}
    >
      <StaffAttendanceInput />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedStaffAttendanceAdminPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          職員出勤管理を読み込んでいます…
        </div>
      )}
    >
      <StaffAttendanceAdminPage />
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

const SuspendedUserDetailPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          利用者ページを読み込んでいます…
        </div>
      )}
    >
      <UserDetailPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedIntegratedResourceCalendarPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          統合リソースカレンダーを読み込んでいます…
        </div>
      )}
    >
      <IntegratedResourceCalendarPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedMeetingGuidePage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          司会ガイドを読み込んでいます…
        </div>
      )}
    >
      <MeetingGuidePage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedDashboardBriefingPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          朝会・夕会情報を読み込んでいます…
        </div>
      )}
    >
      <DashboardBriefingPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedHandoffTimelinePage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          申し送りタイムラインを読み込んでいます…
        </div>
      )}
    >
      <HandoffTimelinePage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);
const childRoutes: RouteObject[] = [
  { index: true, element: <DashboardRedirect /> },
  { path: 'dashboard', element: <SuspendedStaffDashboardPage /> },
  { path: 'admin/dashboard', element: <SuspendedAdminDashboardPage /> },
  { path: 'dashboard/briefing', element: <SuspendedDashboardBriefingPage /> },
  { path: 'meeting-guide', element: <SuspendedMeetingGuidePage /> },
  { path: 'handoff-timeline', element: <SuspendedHandoffTimelinePage /> },
  { path: 'records', element: <SuspendedRecordList /> },
  { path: 'records/monthly', element: <SuspendedMonthlyRecordPage /> },
  { path: 'checklist', element: <SuspendedChecklistPage /> },
  { path: 'audit', element: <SuspendedAuditPanel /> },
  { path: 'users', element: <UsersPanel /> },
  { path: 'users/:userId', element: <SuspendedUserDetailPage /> },
  { path: 'staff', element: <StaffPanel /> },
  {
    path: 'staff/attendance',
    element: (
      <ProtectedRoute flag="schedules">
        <SuspendedStaffAttendanceInput />
      </ProtectedRoute>
    ),
  },
  { path: 'daily', element: <Navigate to="/daily/table" replace /> },
  { path: 'daily/menu', element: <SuspendedDailyRecordMenuPage /> },
  { path: 'daily/table', element: <SuspendedTableDailyRecordPage /> },
  { path: 'daily/activity', element: <SuspendedDailyRecordPage /> },
  { path: 'daily/attendance', element: <SuspendedAttendanceRecordPage /> },
  { path: 'daily/support', element: <SuspendedTimeBasedSupportRecordPage /> },
  { path: 'daily/support-checklist', element: <SuspendedTimeFlowSupportRecordPage /> },
  { path: 'daily/time-based', element: <SuspendedTimeBasedSupportRecordPage /> },
  { path: 'daily/health', element: <SuspendedHealthObservationPage /> },
  { path: 'analysis', element: <Navigate to="/analysis/dashboard" replace /> },
  { path: 'analysis/dashboard', element: <SuspendedAnalysisDashboardPage /> },
  {
    path: 'analysis/iceberg-pdca',
    element: (
      <IcebergPdcaGate>
        <SuspendedIcebergPdcaPage />
      </IcebergPdcaGate>
    ),
  },
  {
    path: 'analysis/iceberg-pdca/edit',
    element: (
      <IcebergPdcaGate requireEdit>
        <SuspendedIcebergPdcaPage />
      </IcebergPdcaGate>
    ),
  },
  { path: 'analysis/iceberg', element: <SuspendedIcebergAnalysisPage /> },
  { path: 'assessment', element: <SuspendedAssessmentDashboardPage /> },
  { path: 'survey/tokusei', element: <SuspendedTokuseiSurveyResultsPage /> },
  { path: 'admin/templates', element: <SuspendedSupportActivityMasterPage /> },
  { path: 'admin/step-templates', element: <SuspendedSupportStepMasterPage /> },
  { path: 'admin/individual-support', element: <SuspendedIndividualSupportManagementPage /> },
  { path: 'admin/staff-attendance', element: <SuspendedStaffAttendanceAdminPage /> },
  {
    path: 'admin/integrated-resource-calendar',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <SuspendedIntegratedResourceCalendarPage />
        </ProtectedRoute>
      </SchedulesGate>
    )
  },
  {
    path: 'schedule',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <Navigate to="/schedules/week" replace />
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
          <SchedulesWeekRoute />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/day',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <LegacyDayRedirect />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  {
    path: 'schedules/month',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <LegacyMonthRedirect />
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
        <ProtectedRoute flag="schedules">
          <SuspendedCreatePage />
        </ProtectedRoute>
      </SchedulesGate>
    ),
  },
  ...(devHarnessEnabled && SuspendedDevScheduleCreateDialogPage
    ? [{
        path: 'dev/schedule-create-dialog',
        element: (
          <SchedulesGate>
            <ProtectedRoute flag="schedules">
              <SuspendedDevScheduleCreateDialogPage />
            </ProtectedRoute>
          </SchedulesGate>
        ),
      }]
    : []),
  nurseRoutes(),
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

import ProtectedRoute from '@/app/ProtectedRoute';
import { AuthCallbackRoute } from '@/auth/AuthCallbackRoute';
import RequireAudience from '@/components/RequireAudience';
import { isDev } from '@/env';
import { MeetingMinutesRoutes } from '@/features/meeting-minutes/routes';
import { nurseRoutes } from '@/features/nurse/routes/NurseRoutes';

import { RouteHydrationErrorBoundary } from '@/hydration/RouteHydrationListener';
import { getAppConfig } from '@/lib/env';
import lazyWithPreload from '@/utils/lazyWithPreload';
import React from 'react';
import { Navigate, Outlet, createBrowserRouter, useLocation, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';
import { routerFutureFlags } from './routerFuture';
import SchedulesGate from './SchedulesGate';

const RecordList = React.lazy(() => import('@/features/records/RecordList'));
const ChecklistPage = React.lazy(() => import('@/features/compliance-checklist/ChecklistPage'));
const AuditPanel = React.lazy(() => import('@/features/audit/AuditPanel'));

const NewSchedulesWeekPage = lazyWithPreload(() => import('@/features/schedules/routes/WeekPage'));
const DailyRecordPage = React.lazy(() => import('@/pages/DailyRecordPage'));
const DailyRecordMenuPage = React.lazy(() => import('@/pages/DailyRecordMenuPage'));
const TableDailyRecordPage = React.lazy(() => import('@/features/daily/table/TableDailyRecordPage'));
const TimeFlowSupportRecordPage = React.lazy(() => import('@/pages/TimeFlowSupportRecordPage'));
const TimeBasedSupportRecordPage = React.lazy(() => import('@/pages/TimeBasedSupportRecordPage'));

const HealthObservationPage = React.lazy(() => import('@/pages/HealthObservationPage'));
const AnalysisDashboardPage = React.lazy(() => import('@/pages/AnalysisDashboardPage'));
const AssessmentDashboardPage = React.lazy(() => import('@/pages/AssessmentDashboardPage'));
const TokuseiSurveyResultsPage = React.lazy(() => import('@/pages/TokuseiSurveyResultsPage'));
const IcebergPdcaPage = React.lazy(() => import('@/pages/IcebergPdcaPage'));
const IcebergAnalysisPage = React.lazy(() => import('@/pages/IcebergAnalysisPage'));
const InterventionDashboardPage = React.lazy(() => import('@/pages/InterventionDashboardPage'));
const MonthlyRecordPage = React.lazy(() => import('@/pages/MonthlyRecordPage'));
const BillingPage = React.lazy(() => import('@/pages/BillingPage'));

const AttendanceRecordPage = React.lazy(() => import('@/pages/AttendanceRecordPage'));
const StaffAttendanceAdminPage = React.lazy(() => import('@/pages/StaffAttendanceAdminPage'));
const StaffAttendanceInputPage = React.lazy(() =>
  import('@/pages/StaffAttendanceInputPage').then((module) => ({
    default: module.StaffAttendanceInputPage,
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
const DebugZodErrorPage = React.lazy(() => import('@/pages/DebugZodErrorPage'));

const SupportActivityMasterPage = React.lazy(() => import('@/pages/SupportActivityMasterPage'));
const SupportStepMasterPage = React.lazy(() => import('@/pages/SupportStepMasterPage'));
const IndividualSupportManagementPage = React.lazy(() => import('@/pages/IndividualSupportManagementPage'));
const UserDetailPage = React.lazy(() => import('@/pages/UserDetailPage'));
const NavigationDiagnosticsPage = React.lazy(() => import('@/pages/admin/NavigationDiagnosticsPage'));
const DataIntegrityPage = React.lazy(() => import('@/pages/admin/DataIntegrityPage'));
const CsvImportPage = React.lazy(() => import('@/pages/admin/CsvImportPage'));
const ModeSwitchPage = React.lazy(() => import('@/pages/admin/ModeSwitchPage'));

const StaffPanel = React.lazy(() => import('@/features/staff').then(m => ({ default: m.StaffPanel })));
const UsersPanel = React.lazy(() => import('@/features/users').then(m => ({ default: m.UsersPanel })));

// Dev harness・磯幕逋ｺ迺ｰ蠅・・縺ｿ・・
const devHarnessEnabled = getAppConfig().isDev;
const DevScheduleCreateDialogPage = devHarnessEnabled
  ? React.lazy(() => import('@/features/schedules/routes/DevScheduleCreateDialogPage'))
  : null;

const SuspendedDevScheduleCreateDialogPage: React.FC | null = DevScheduleCreateDialogPage
  ? () => (
      <RouteHydrationErrorBoundary>
        <React.Suspense
          fallback={(
            <div className="p-4 text-sm text-slate-600" role="status">
              ScheduleCreateDialog 繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
            </div>
          )}
        >
          <DevScheduleCreateDialogPage />
        </React.Suspense>
      </RouteHydrationErrorBoundary>
    )
  : null;

// --- Suspended wrappers via createSuspended helper ---------------------
import { IcebergPdcaGate } from '@/features/ibd/analysis/pdca/IcebergPdcaGate';
import { createSuspended } from './createSuspended';

const SuspendedNewSchedulesWeekPage = createSuspended(NewSchedulesWeekPage, '週間予定を読み込んでいます…');
const SuspendedDailyRecordPage = createSuspended(DailyRecordPage, '支援記録を読み込んでいます…');
const SuspendedMonthlyRecordPage = createSuspended(MonthlyRecordPage, '月次記録を読み込んでいます…');
const SuspendedBillingPage = createSuspended(BillingPage, '請求管理画面を読み込んでいます…');
const SuspendedDailyRecordMenuPage = createSuspended(DailyRecordMenuPage, '日次記録メニューを読み込んでいます…');
const SuspendedTableDailyRecordPage = createSuspended(TableDailyRecordPage, '一覧形式ケース記録を読み込んでいます…');
const SuspendedAttendanceRecordPage = createSuspended(AttendanceRecordPage, '通園管理ページを読み込んでいます…');
const SuspendedTimeFlowSupportRecordPage = createSuspended(TimeFlowSupportRecordPage, '支援記録を読み込んでいます…');
const SuspendedTimeBasedSupportRecordPage = createSuspended(TimeBasedSupportRecordPage, '時間別支援記録を読み込んでいます…');
const SuspendedAnalysisDashboardPage = createSuspended(AnalysisDashboardPage, '行動分析ダッシュボードを読み込んでいます…');
const SuspendedIcebergPdcaPage = createSuspended(IcebergPdcaPage, '氷山PDCAボードを読み込んでいます…');
const SuspendedIcebergAnalysisPage = createSuspended(IcebergAnalysisPage, '氷山分析ワークスペースを読み込んでいます…');
const SuspendedInterventionDashboardPage = createSuspended(InterventionDashboardPage, '行動対応プランを読み込んでいます…');
const SuspendedAssessmentDashboardPage = createSuspended(AssessmentDashboardPage, 'アセスメント管理ページを読み込んでいます…');
const SuspendedTokuseiSurveyResultsPage = createSuspended(TokuseiSurveyResultsPage, '特性アンケート結果を読み込んでいます…');
const SuspendedHealthObservationPage = createSuspended(HealthObservationPage, '身体記録入力画面を読み込んでいます…');
const SuspendedStaffDashboardPage = createSuspended(StaffDashboardPage, 'ダッシュボードを読み込んでいます…');
const SuspendedAdminDashboardPage = createSuspended(AdminDashboardPage, '管理ダッシュボードを読み込んでいます…');
const SuspendedRecordList = createSuspended(RecordList, '記録ノートを読み込んでいます…');
const SuspendedChecklistPage = createSuspended(ChecklistPage, '自己点検ページを読み込んでいます…');
const SuspendedAuditPanel = createSuspended(AuditPanel, '監査ログを読み込んでいます…');
const SuspendedSupportActivityMasterPage = createSuspended(SupportActivityMasterPage, '支援活動テンプレート管理を読み込んでいます…');
const SuspendedStaffAttendanceInput = createSuspended(StaffAttendanceInputPage, '勤務交代入力を読み込んでいます…');
const SuspendedStaffAttendanceAdminPage = createSuspended(StaffAttendanceAdminPage, '勤務出勤管理を読み込んでいます…');
const SuspendedSupportStepMasterPage = createSuspended(SupportStepMasterPage, '支援手順テンプレート管理を読み込んでいます…');
const SuspendedIndividualSupportManagementPage = createSuspended(IndividualSupportManagementPage, '個別支援手順管理を読み込んでいます…');
const SuspendedUserDetailPage = createSuspended(UserDetailPage, '利用者ページを読み込んでいます…');
const SuspendedStaffPanel = createSuspended(StaffPanel, '勤務一覧を読み込んでいます…');
const SuspendedUsersPanel = createSuspended(UsersPanel, '利用者一覧を読み込んでいます…');
const SuspendedIntegratedResourceCalendarPage = createSuspended(IntegratedResourceCalendarPage, '統合リソースカレンダーを読み込んでいます…');
const SuspendedNavigationDiagnosticsPage = createSuspended(NavigationDiagnosticsPage, 'ナビ診断を読み込んでいます…');
const SuspendedDataIntegrityPage = createSuspended(DataIntegrityPage, 'データ整合性チェックを読み込んでいます…');
const SuspendedCsvImportPage = createSuspended(CsvImportPage, 'CSVインポートを読み込んでいます…');
const SuspendedModeSwitchPage = createSuspended(ModeSwitchPage, 'モード切替を読み込んでいます…');
const SuspendedMeetingGuidePage = createSuspended(MeetingGuidePage, '会議ガイドを読み込んでいます…');
const SuspendedDashboardBriefingPage = createSuspended(DashboardBriefingPage, '最新の大切情報を読み込んでいます…');
const RoomManagementPage = React.lazy(() => import('@/pages/RoomManagementPage').then((module) => ({ default: module.RoomManagementPage ?? module.default })));
const SuspendedRoomManagementPage = createSuspended(RoomManagementPage, 'お部屋情報を読み込んでいます…');
const SuspendedHandoffTimelinePage = createSuspended(HandoffTimelinePage, '申し送りタイムラインを読み込んでいます…');
const TodayOpsPage = React.lazy(() => import('@/pages/TodayOpsPage').then((module) => ({ default: module.TodayOpsPage ?? module.default })));
const SuspendedTodayOpsPage = createSuspended(TodayOpsPage, '本日の業務を読み込んでいます…');
const SupportPlanGuidePage = React.lazy(() => import('@/pages/SupportPlanGuidePage'));
const SuspendedSupportPlanGuidePage = createSuspended(SupportPlanGuidePage, '個別支援計画書モジュールを読み込んでいます…');
const ISPComparisonEditorPage = React.lazy(() => import('@/pages/ISPComparisonEditorPage'));
const SuspendedISPComparisonEditorPage = createSuspended(ISPComparisonEditorPage, 'ISP比較エディタを読み込んでいます…');
const SmokeTestPage = React.lazy(() => import('@/pages/SmokeTestPage').then((module) => ({ default: module.default })));
const SuspendedSmokeTestPage = createSuspended(SmokeTestPage, 'スモークテストを読み込んでいます…');
const SuspendedDebugZodErrorPage = createSuspended(DebugZodErrorPage, 'デバッグ情報を読み込んでいます…');
const IBDDemoPage = React.lazy(() => import('@/pages/IBDDemoPage'));
const SuspendedIBDDemoPage = createSuspended(IBDDemoPage, 'IBDデモを読み込んでいます…');
const IBDHubPage = React.lazy(() => import('@/pages/IBDHubPage'));
const SuspendedIBDHubPage = createSuspended(IBDHubPage, '強度行動障害支援を読み込んでいます…');

const DashboardRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/dashboard${location.search}`} replace />;
};

const SchedulesTimelineRedirect: React.FC = () => {
  const location = useLocation();
  const nextParams = new URLSearchParams(location.search);
  nextParams.set('tab', 'week');
  const suffix = nextParams.toString();
  return <Navigate to={`/schedules/week${suffix ? `?${suffix}` : ''}`} replace />;
};

const SchedulesDayRedirect: React.FC = () => {
  const location = useLocation();
  const nextParams = new URLSearchParams(location.search);
  nextParams.set('tab', 'day');
  const suffix = nextParams.toString();
  return <Navigate to={`/schedules/week${suffix ? `?${suffix}` : ''}`} replace />;
};

const SchedulesMonthRedirect: React.FC = () => {
  const location = useLocation();
  const nextParams = new URLSearchParams(location.search);
  nextParams.set('tab', 'month');
  const suffix = nextParams.toString();
  return <Navigate to={`/schedules/week${suffix ? `?${suffix}` : ''}`} replace />;
};

const childRoutes: RouteObject[] = [
  ...(isDev ? [
    { path: 'admin/debug/smoke-test', element: <SuspendedSmokeTestPage /> },
    { path: 'admin/debug/zod-error', element: <SuspendedDebugZodErrorPage /> },
    { path: 'ibd-demo', element: <SuspendedIBDDemoPage /> },
  ] : []),

  { path: 'ibd', element: <SuspendedIBDHubPage /> },

  { path: 'auth/callback', element: <AuthCallbackRoute /> },
  { index: true, element: <DashboardRedirect /> },
  { path: 'dashboard', element: <SuspendedStaffDashboardPage /> },
  {
    path: 'admin/dashboard',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedAdminDashboardPage />
      </RequireAudience>
    ),
  },
  { path: 'dashboard/briefing', element: <SuspendedDashboardBriefingPage /> },
  {
    path: 'today',
    element: (
      <ProtectedRoute flag="todayOps">
        <RequireAudience requiredRole="viewer">
          <SuspendedTodayOpsPage />
        </RequireAudience>
      </ProtectedRoute>
    ),
  },
  { path: 'room-management', element: <SuspendedRoomManagementPage /> },
  { path: 'meeting-guide', element: <SuspendedMeetingGuidePage /> },
  {
    path: 'compliance',
    element: (
      <RequireAudience requiredRole="viewer">
        <div className="p-4">コンプラ報告（近日公開）</div>
      </RequireAudience>
    ),
  },
  {
    path: 'support-plan-guide',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedSupportPlanGuidePage />
      </RequireAudience>
    ),
  },
  {
    path: 'isp-editor',
    element: <SuspendedISPComparisonEditorPage />,
  },
  {
    path: 'isp-editor/:userId',
    element: <SuspendedISPComparisonEditorPage />,
  },
  { path: 'handoff-timeline', element: <SuspendedHandoffTimelinePage /> },
  { path: 'meeting-minutes', element: MeetingMinutesRoutes.List },
  { path: 'meeting-minutes/new', element: MeetingMinutesRoutes.New },
  { path: 'meeting-minutes/:id', element: MeetingMinutesRoutes.Detail },
  { path: 'meeting-minutes/:id/edit', element: MeetingMinutesRoutes.Edit },
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
  {
    path: 'checklist',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedChecklistPage />
      </RequireAudience>
    ),
  },
  {
    path: 'audit',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedAuditPanel />
      </RequireAudience>
    ),
  },
  {
    path: 'users',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedUsersPanel />
      </RequireAudience>
    ),
  },
  {
    path: 'users/:userId',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedUserDetailPage />
      </RequireAudience>
    ),
  },
  {
    path: 'staff',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedStaffPanel />
      </RequireAudience>
    ),
  },
  {
    path: 'staff/attendance',
    element: (
      <ProtectedRoute>
        <RequireAudience requiredRole="reception">
          <SuspendedStaffAttendanceInput />
        </RequireAudience>
      </ProtectedRoute>
    ),
  },
  { path: 'daily', element: <Navigate to="/dailysupport" replace /> },
  { path: 'dailysupport', element: <SuspendedDailyRecordMenuPage /> },
  { path: 'daily/menu', element: <Navigate to="/dailysupport" replace /> },
  { path: 'daily/table', element: <SuspendedTableDailyRecordPage /> },
  { path: 'daily/activity', element: <SuspendedDailyRecordPage /> },
  { path: 'daily/attendance', element: <SuspendedAttendanceRecordPage /> },
  { path: 'daily/support', element: <SuspendedTimeBasedSupportRecordPage /> },
  { path: 'daily/support-checklist', element: <SuspendedTimeFlowSupportRecordPage /> },
  { path: 'daily/time-based', element: <Navigate to="/daily/support" replace /> },
  { path: 'daily/health', element: <SuspendedHealthObservationPage /> },
  { path: 'analysis', element: <Navigate to="/analysis/dashboard" replace /> },
  {
    path: 'analysis/dashboard',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedAnalysisDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg-pdca',
    element: (
      <RequireAudience requiredRole="viewer">
        <IcebergPdcaGate>
          <SuspendedIcebergPdcaPage />
        </IcebergPdcaGate>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg-pdca/edit',
    element: (
      <RequireAudience requiredRole="viewer">
        <IcebergPdcaGate requireEdit>
          <SuspendedIcebergPdcaPage />
        </IcebergPdcaGate>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedIcebergAnalysisPage />
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/intervention',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedInterventionDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'assessment',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedAssessmentDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'survey/tokusei',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedTokuseiSurveyResultsPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/templates',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedSupportActivityMasterPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/step-templates',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedSupportStepMasterPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/individual-support/:userCode?',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedIndividualSupportManagementPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/staff-attendance',
    element: (
      <RequireAudience requiredRole="reception">
        <SuspendedStaffAttendanceAdminPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/integrated-resource-calendar',
    element: (
      <SchedulesGate>
        <ProtectedRoute flag="schedules">
          <RequireAudience requiredRole="admin">
            <SuspendedIntegratedResourceCalendarPage />
          </RequireAudience>
        </ProtectedRoute>
      </SchedulesGate>
    )
  },
  {
    path: 'admin/navigation-diagnostics',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedNavigationDiagnosticsPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/data-integrity',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedDataIntegrityPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/csv-import',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedCsvImportPage />
      </RequireAudience>
    ),
  },
  {
    path: 'admin/mode-switch',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedModeSwitchPage />
      </RequireAudience>
    ),
  },
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
  nurseRoutes(),
];

export const routes: RouteObject[] = [
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

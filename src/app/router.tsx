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

const SuspendedNewSchedulesWeekPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          騾ｱ髢謎ｺ亥ｮ壹ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <NewSchedulesWeekPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);


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


const SuspendedDailyRecordPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          謾ｯ謠ｴ險倬鹸・医こ繝ｼ繧ｹ險倬鹸・峨ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          譛域ｬ｡險倬鹸繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <MonthlyRecordPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedBillingPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          隲区ｱょ・逅・判髱｢繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <BillingPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedDailyRecordMenuPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          譌･谺｡險倬鹸繝｡繝九Η繝ｼ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          荳隕ｧ蠖｢蠑上こ繝ｼ繧ｹ險倬鹸繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          騾壽園邂｡逅・・繝ｼ繧ｸ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          謾ｯ謠ｴ謇矩・・險倬鹸繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          譎る俣蛻･謾ｯ謠ｴ險倬鹸繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          陦悟虚蛻・梵繝繝・す繝･繝懊・繝峨ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          豌ｷ螻ｱPDCA繝懊・繝峨ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          豌ｷ螻ｱ蛻・梵繝ｯ繝ｼ繧ｯ繧ｹ繝壹・繧ｹ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          繧｢繧ｻ繧ｹ繝｡繝ｳ繝育ｮ｡逅・・繝ｼ繧ｸ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          迚ｹ諤ｧ繧｢繝ｳ繧ｱ繝ｼ繝育ｵ先棡繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          蛛･蠎ｷ險倬鹸蜈･蜉帷判髱｢繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          繝繝・す繝･繝懊・繝峨ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          邂｡逅・・ム繝・す繝･繝懊・繝峨ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          鮟偵ヮ繝ｼ繝医ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          閾ｪ蟾ｱ轤ｹ讀懊・繝ｼ繧ｸ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          逶｣譟ｻ繝ｭ繧ｰ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          謾ｯ謠ｴ豢ｻ蜍輔ユ繝ｳ繝励Ξ繝ｼ繝育ｮ｡逅・ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          閨ｷ蜩｡蜍､諤蜈･蜉帙ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <StaffAttendanceInputPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedStaffAttendanceAdminPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          閨ｷ蜩｡蜃ｺ蜍､邂｡逅・ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          謾ｯ謠ｴ謇矩・ユ繝ｳ繝励Ξ繝ｼ繝育ｮ｡逅・ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          蛟句挨謾ｯ謠ｴ謇矩・ｮ｡逅・ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          蛻ｩ逕ｨ閠・・繝ｼ繧ｸ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <UserDetailPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedStaffPanel: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          閨ｷ蜩｡荳隕ｧ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <StaffPanel />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedUsersPanel: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          蛻ｩ逕ｨ閠・ｸ隕ｧ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <UsersPanel />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedIntegratedResourceCalendarPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          邨ｱ蜷医Μ繧ｽ繝ｼ繧ｹ繧ｫ繝ｬ繝ｳ繝繝ｼ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <IntegratedResourceCalendarPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedNavigationDiagnosticsPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          ナビ診断を読み込んでいます…
        </div>
      )}
    >
      <NavigationDiagnosticsPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedMeetingGuidePage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          蜿ｸ莨壹ぎ繧､繝峨ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
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
          譛昜ｼ壹・螟穂ｼ壽ュ蝣ｱ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <DashboardBriefingPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const RoomManagementPage = React.lazy(() => import('@/pages/RoomManagementPage').then((module) => ({
  default: module.RoomManagementPage ?? module.default,
})));
const SuspendedRoomManagementPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          縺企Κ螻区ュ蝣ｱ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <RoomManagementPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedHandoffTimelinePage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          逕ｳ縺鈴√ｊ繧ｿ繧､繝繝ｩ繧､繝ｳ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <HandoffTimelinePage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const TodayOpsPage = React.lazy(() => import('@/pages/TodayOpsPage').then((module) => ({
  default: module.TodayOpsPage ?? module.default,
})));
const SuspendedTodayOpsPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          莉頑律縺ｮ讌ｭ蜍吶ｒ隱ｭ縺ｿ霎ｼ繧薙〒縺・∪縺吮ｦ
        </div>
      )}
    >
      <TodayOpsPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SupportPlanGuidePage = React.lazy(() => import('@/pages/SupportPlanGuidePage'));
const SuspendedSupportPlanGuidePage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense
      fallback={(
        <div className="p-4 text-sm text-slate-600" role="status">
          個別支援計画書モジュールを読み込んでいます…
        </div>
      )}
    >
      <SupportPlanGuidePage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SmokeTestPage = React.lazy(() => import('@/pages/SmokeTestPage').then((module) => ({ default: module.default })));
const SuspendedSmokeTestPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense fallback={<div className="p-4 text-sm text-slate-600" role="status">スモークテストを読み込んでいます…</div>}>
      <SmokeTestPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const SuspendedDebugZodErrorPage: React.FC = () => (
  <RouteHydrationErrorBoundary>
    <React.Suspense fallback={<div className="p-4 text-sm text-slate-600" role="status">デバッグ情報を読み込んでいます…</div>}>
      <DebugZodErrorPage />
    </React.Suspense>
  </RouteHydrationErrorBoundary>
);

const childRoutes: RouteObject[] = [
  ...(isDev ? [
    { path: 'admin/debug/smoke-test', element: <SuspendedSmokeTestPage /> },
    { path: 'admin/debug/zod-error', element: <SuspendedDebugZodErrorPage /> }
  ] : []),

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
    path: 'admin/individual-support',
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

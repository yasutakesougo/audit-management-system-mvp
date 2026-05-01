/**
 * Lazy-loaded page components and Suspense wrappers.
 * Extracted from router.tsx for single-responsibility.
 */
import { RouteHydrationErrorBoundary } from '@/hydration/RouteHydrationListener';
import { getAppConfig } from '@/lib/env';
import lazyWithPreload from '@/utils/lazyWithPreload';
import React from 'react';
import { createSuspended } from '../createSuspended';

// ── React.lazy imports ─────────────────────────────────────────────────────

const RecordList = React.lazy(() => import('@/features/records/RecordList'));
const ChecklistPage = React.lazy(() => import('@/features/compliance-checklist/ChecklistPage'));
const AuditPanel = React.lazy(() => import('@/features/audit/AuditPanel'));

const NewSchedulesWeekPage = lazyWithPreload(() => import('@/features/schedules/routes/WeekPage'));
/** @deprecated Use /schedules/week?tab=ops instead. Kept for backward compatibility redirect only. */
const OpsSchedulePage = React.lazy(() => import('@/features/schedules/components/ops/OpsSchedulePage').then(m => ({ default: m.OpsSchedulePage })));
const DailyRecordPage = React.lazy(() => import('@/pages/DailyRecordPage'));
const DailyRecordMenuPage = React.lazy(() => import('@/pages/DailyRecordMenuPage'));
const TableDailyRecordPage = React.lazy(() => import('@/features/daily/components/table/TableDailyRecordPage'));
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
const ServiceProvisionFormPage = React.lazy(() => import('@/pages/ServiceProvisionFormPage'));
const BusinessJournalPreviewPage = React.lazy(() => import('@/pages/BusinessJournalPreviewPage'));
const PersonalJournalPage = React.lazy(() => import('@/pages/PersonalJournalPage'));
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
const MonitoringMeetingRecordPage = React.lazy(() => import('@/pages/MonitoringMeetingRecordPage'));

const StaffPanel = React.lazy(() => import('@/features/staff').then(m => ({ default: m.StaffPanel })));
const UsersPanel = React.lazy(() => import('@/features/users').then(m => ({ default: m.UsersPanel })));

// ── Dev harness ────────────────────────────────────────────────────────────

export const devHarnessEnabled = getAppConfig().isDev;
const DevScheduleCreateDialogPage = devHarnessEnabled
  ? React.lazy(() => import('@/features/schedules/routes/DevScheduleCreateDialogPage'))
  : null;

export const SuspendedDevScheduleCreateDialogPage: React.FC | null = DevScheduleCreateDialogPage
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

// ── Suspended wrappers ─────────────────────────────────────────────────────

export const SuspendedNewSchedulesWeekPage = createSuspended(NewSchedulesWeekPage, '週間予定を読み込んでいます…');
/** @deprecated Use /schedules/week?tab=ops instead. Kept for backward compatibility redirect only. */
export const SuspendedOpsSchedulePage = createSuspended(OpsSchedulePage, 'スケジュール（運営ビュー）を読み込んでいます…');
export const SuspendedDailyRecordPage = createSuspended(DailyRecordPage, '日々の記録を読み込んでいます…');
export const SuspendedMonthlyRecordPage = createSuspended(MonthlyRecordPage, '月次記録を読み込んでいます…');
export const SuspendedServiceProvisionFormPage = createSuspended(ServiceProvisionFormPage, 'サービス提供実績記録を読み込んでいます…');
export const SuspendedBusinessJournalPreviewPage = createSuspended(BusinessJournalPreviewPage, '業務日誌プレビューを読み込んでいます…');
export const SuspendedPersonalJournalPage = createSuspended(PersonalJournalPage, '個人月次業務日誌を読み込んでいます…');
export const SuspendedBillingPage = createSuspended(BillingPage, '請求管理画面を読み込んでいます…');
export const SuspendedDailyRecordMenuPage = createSuspended(DailyRecordMenuPage, '日々の記録メニューを読み込んでいます…');
export const SuspendedTableDailyRecordPage = createSuspended(TableDailyRecordPage, '一覧形式の日々の記録を読み込んでいます…');
export const SuspendedAttendanceRecordPage = createSuspended(AttendanceRecordPage, '通所管理ページを読み込んでいます…');
export const SuspendedTimeFlowSupportRecordPage = createSuspended(TimeFlowSupportRecordPage, '日々の記録を読み込んでいます…');
export const SuspendedTimeBasedSupportRecordPage = createSuspended(TimeBasedSupportRecordPage, '時間別日々の記録を読み込んでいます…');
export const SuspendedAnalysisDashboardPage = createSuspended(AnalysisDashboardPage, '行動分析ダッシュボードを読み込んでいます…');
export const SuspendedIcebergPdcaPage = createSuspended(IcebergPdcaPage, '氷山PDCAボードを読み込んでいます…');
export const SuspendedIcebergAnalysisPage = createSuspended(IcebergAnalysisPage, '氷山分析ワークスペースを読み込んでいます…');
export const SuspendedInterventionDashboardPage = createSuspended(InterventionDashboardPage, '行動対応プランを読み込んでいます…');
export const SuspendedAssessmentDashboardPage = createSuspended(AssessmentDashboardPage, 'アセスメント管理ページを読み込んでいます…');
export const SuspendedTokuseiSurveyResultsPage = createSuspended(TokuseiSurveyResultsPage, '特性アンケート結果を読み込んでいます…');
export const SuspendedHealthObservationPage = createSuspended(HealthObservationPage, '身体記録画面を読み込んでいます…');
export const SuspendedStaffDashboardPage = createSuspended(StaffDashboardPage, 'ダッシュボードを読み込んでいます…');
export const SuspendedAdminDashboardPage = createSuspended(AdminDashboardPage, '管理ダッシュボードを読み込んでいます…');
export const SuspendedRecordList = createSuspended(RecordList, '記録ノートを読み込んでいます…');
export const SuspendedChecklistPage = createSuspended(ChecklistPage, '自己点検ページを読み込んでいます…');
export const SuspendedAuditPanel = createSuspended(AuditPanel, '監査ログを読み込んでいます…');
export const SuspendedSupportActivityMasterPage = createSuspended(SupportActivityMasterPage, '支援活動テンプレート管理を読み込んでいます…');
export const SuspendedStaffAttendanceInput = createSuspended(StaffAttendanceInputPage, '勤務交代入力を読み込んでいます…');
export const SuspendedStaffAttendanceAdminPage = createSuspended(StaffAttendanceAdminPage, '勤務出勤管理を読み込んでいます…');
export const SuspendedSupportStepMasterPage = createSuspended(SupportStepMasterPage, '支援手順テンプレート管理を読み込んでいます…');
export const SuspendedIndividualSupportManagementPage = createSuspended(IndividualSupportManagementPage, '個別支援手順管理を読み込んでいます…');
export const SuspendedUserDetailPage = createSuspended(UserDetailPage, '利用者ページを読み込んでいます…');
export const SuspendedStaffPanel = createSuspended(StaffPanel, '勤務一覧を読み込んでいます…');
export const SuspendedUsersPanel = createSuspended(UsersPanel, '利用者一覧を読み込んでいます…');

export const SuspendedIntegratedResourceCalendarPage = createSuspended(IntegratedResourceCalendarPage, '統合リソースカレンダーを読み込んでいます…');
export const SuspendedNavigationDiagnosticsPage = createSuspended(NavigationDiagnosticsPage, 'ナビ診断を読み込んでいます…');
export const SuspendedDataIntegrityPage = createSuspended(DataIntegrityPage, 'データ整合性チェックを読み込んでいます…');
export const SuspendedCsvImportPage = createSuspended(CsvImportPage, 'CSVインポートを読み込んでいます…');
export const SuspendedModeSwitchPage = createSuspended(ModeSwitchPage, 'モード切替を読み込んでいます…');
export const SuspendedMonitoringMeetingRecordPage = createSuspended(MonitoringMeetingRecordPage, 'モニタリング会議記録画面を読み込んでいます…');

const AdminHubPage = React.lazy(() => import('@/pages/admin/AdminHubPage'));
export const SuspendedAdminHubPage = createSuspended(AdminHubPage, '管理ツールを読み込んでいます…');
export const SuspendedMeetingGuidePage = createSuspended(MeetingGuidePage, '会議ガイドを読み込んでいます…');
export const SuspendedDashboardBriefingPage = createSuspended(DashboardBriefingPage, '最新の大切情報を読み込んでいます…');
const RoomManagementPage = React.lazy(() => import('@/pages/RoomManagementPage').then((module) => ({ default: module.RoomManagementPage ?? module.default })));
export const SuspendedRoomManagementPage = createSuspended(RoomManagementPage, 'お部屋情報を読み込んでいます…');
export const SuspendedHandoffTimelinePage = createSuspended(HandoffTimelinePage, '申し送りタイムラインを読み込んでいます…');

const TodayOpsPage = React.lazy(() => import('@/pages/today-isolated/TodayOpsPage_v3').then((module) => ({ default: module.TodayOpsPage ?? module.default })));
export const SuspendedTodayOpsPage = createSuspended(TodayOpsPage, '本日の業務を読み込んでいます…');

const SupportPlanGuidePage = React.lazy(() => import('@/pages/SupportPlanGuidePage'));
export const SuspendedSupportPlanGuidePage = createSuspended(SupportPlanGuidePage, '個別支援計画書モジュールを読み込んでいます…');
const ISPComparisonEditorPage = React.lazy(() => import('@/pages/ISPComparisonEditorPage'));
export const SuspendedISPComparisonEditorPage = createSuspended(ISPComparisonEditorPage, '個別支援計画比較エディタを読み込んでいます…');
const SmokeTestPage = React.lazy(() => import('@/pages/SmokeTestPage').then((module) => ({ default: module.default })));
export const SuspendedSmokeTestPage = createSuspended(SmokeTestPage, 'スモークテストを読み込んでいます…');
const OpeningVerificationPage = React.lazy(() => import('@/pages/OpeningVerificationPage').then((module) => ({ default: module.default })));
export const SuspendedOpeningVerificationPage = createSuspended(OpeningVerificationPage, '開通確認コンソールを読み込んでいます…');
export const SuspendedDebugZodErrorPage = createSuspended(DebugZodErrorPage, 'デバッグ情報を読み込んでいます…');
const IBDHubPage = React.lazy(() => import('@/pages/IBDHubPage'));
export const SuspendedIBDHubPage = createSuspended(IBDHubPage, '強度行動障害支援を読み込んでいます…');
const RegulatoryDashboardPage = React.lazy(() => import('@/pages/RegulatoryDashboardPage'));
export const SuspendedRegulatoryDashboardPage = createSuspended(RegulatoryDashboardPage, '制度遵守ダッシュボードを読み込んでいます…');
const ComplianceDashboardPage = React.lazy(() => import('@/pages/admin/ComplianceDashboardPage'));
export const SuspendedComplianceDashboardPage = createSuspended(ComplianceDashboardPage, '適正化運用ダッシュボードを読み込んでいます…');
const SupportPlanningSheetPage = React.lazy(() => import('@/pages/SupportPlanningSheetPage'));
export const SuspendedSupportPlanningSheetPage = createSuspended(SupportPlanningSheetPage, '支援計画シートを読み込んでいます…');
const PlanningSheetListPage = React.lazy(() => import('@/pages/PlanningSheetListPage'));
export const SuspendedPlanningSheetListPage = createSuspended(PlanningSheetListPage, '支援計画シート一覧を読み込んでいます…');
const OperationFlowSettingsPage = React.lazy(() => import('@/features/settings/pages/OperationFlowSettingsPage'));
export const SuspendedOperationFlowSettingsPage = createSuspended(OperationFlowSettingsPage, '1日の流れ設定を読み込んでいます…');
const AbcRecordPage = React.lazy(() => import('@/pages/AbcRecordPage'));
export const SuspendedAbcRecordPage = createSuspended(AbcRecordPage, 'ABC行動記録を読み込んでいます…');
const HandoffAnalysisPage = React.lazy(() => import('@/pages/HandoffAnalysisPage'));
export const SuspendedHandoffAnalysisPage = createSuspended(HandoffAnalysisPage, '申し送り分析ダッシュボードを読み込んでいます…');
const OpsMetricsPage = React.lazy(() => import('@/pages/OpsMetricsPage'));
export const SuspendedOpsMetricsPage = createSuspended(OpsMetricsPage, '運用指標ダッシュボードを読み込んでいます…');
const IncidentListPage = React.lazy(() => import('@/pages/IncidentListPage'));
export const SuspendedIncidentListPage = createSuspended(IncidentListPage, 'インシデント履歴を読み込んでいます…');
const ExceptionCenterPage = React.lazy(() => import('@/pages/admin/ExceptionCenterPage'));
export const SuspendedExceptionCenterPage = createSuspended(ExceptionCenterPage, '例外センターを読み込んでいます…');
const NotificationAuditLogPage = React.lazy(() => import('@/pages/admin/NotificationAuditLogPage'));
export const SuspendedNotificationAuditLogPage = createSuspended(NotificationAuditLogPage, '通知監査ログを読み込んでいます…');
const TransportExecutionPage = React.lazy(() => import('@/pages/TransportExecutionPage'));
export const SuspendedTransportExecutionPage = createSuspended(TransportExecutionPage, '送迎実施画面を読み込んでいます…');

const TransportAssignmentPage = React.lazy(() => import('@/pages/TransportAssignmentPage'));
export const SuspendedTransportAssignmentPage = createSuspended(TransportAssignmentPage, '送迎配車表を読み込んでいます…');
const TelemetryDashboardPage = React.lazy(() => import('@/pages/admin/TelemetryDashboardPage'));
export const SuspendedTelemetryDashboardPage = createSuspended(TelemetryDashboardPage, 'テレメトリダッシュボードを読み込んでいます…');

const KioskHomePage = React.lazy(() => import('@/pages/kiosk/KioskHomePage'));
const HealthPage = React.lazy(() => import('@/pages/HealthPage'));
export const SuspendedHealthPage = createSuspended(HealthPage, '環境診断を読み込んでいます…');
export const SuspendedKioskHomePage = createSuspended(KioskHomePage, 'キオスク画面を読み込んでいます…');
const KioskUserSelectPage = React.lazy(() => import('@/pages/kiosk/KioskUserSelectPage'));
export const SuspendedKioskUserSelectPage = createSuspended(KioskUserSelectPage, '利用者選択を読み込んでいます…');
const KioskProcedureListPage = React.lazy(() => import('@/pages/kiosk/KioskProcedureListPage'));
export const SuspendedKioskProcedureListPage = createSuspended(KioskProcedureListPage, '支援手順一覧を読み込んでいます…');
const KioskProcedureDetailPage = React.lazy(() => import('@/pages/kiosk/KioskProcedureDetailPage'));
export const SuspendedKioskProcedureDetailPage = createSuspended(KioskProcedureDetailPage, '手順詳細を読み込んでいます…');

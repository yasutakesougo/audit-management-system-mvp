/**
 * SharePoint リスト定義 — リストキーと構成レジストリ
 *
 * ListKeys:    全 SP リスト名の enum
 * LIST_CONFIG: リスト名 → { title } のマッピング
 */

export enum ListKeys {
  UsersMaster = 'Users_Master',
  StaffMaster = 'Staff_Master',
  ComplianceCheckRules = 'Compliance_CheckRules',

  DailyActivityRecords = 'DailyActivityRecords',
  IcebergAnalysis = 'Iceberg_Analysis',
  IcebergPdca = 'Iceberg_PDCA',
  SurveyTokusei = 'FormsResponses_Tokusei',
  OrgMaster = 'Org_Master',
  StaffAttendance = 'Staff_Attendance',
  DiagnosticsReports = 'Diagnostics_Reports',
  AttendanceUsers = 'AttendanceUsers',
  AttendanceDaily = 'AttendanceDaily',
  MeetingMinutes = 'MeetingMinutes',
  SupportTemplates = 'SupportTemplates',
  PlanGoals = 'PlanGoals',
  SupportPlans = 'SupportPlans',
  TransportLog = 'Transport_Log',
  // ── ISP 三層モデル (監査 P0-2 追加) ──
  IspMaster = 'ISP_Master',
  PlanningSheetMaster = 'SupportPlanningSheet_Master',
  ProcedureRecordDaily = 'SupportProcedureRecord_Daily',
  BehaviorMonitoringMaster = 'BehaviorMonitoringRecord_Master',
  PlanningSheetReassessmentMaster = 'PlanningSheetReassessment_Master',
  HolidayMaster = 'Holiday_Master',
  // ── P1-2/P1-3 追加 ──
  PdfOutputLog = 'PdfOutput_Log',
  NurseObservations = 'NurseObservations',
  DailyAttendance = 'Daily_Attendance',
  // ── P3: モニタリング会議 ──
  MonitoringMeetings = 'MonitoringMeetings',
  // ── スケジュール（登録漏れ修正） ──
  Schedules = 'Schedules',
  // ── 電話受付ログ ──
  CallLogs = 'CallLogs',
}

export const LIST_CONFIG: Record<ListKeys, { title: string }> = {
  [ListKeys.UsersMaster]: { title: 'Users_Master' },
  [ListKeys.StaffMaster]: { title: 'Staff_Master' },
  [ListKeys.ComplianceCheckRules]: { title: 'Compliance_CheckRules' },

  [ListKeys.DailyActivityRecords]: { title: 'DailyActivityRecords' },
  [ListKeys.IcebergAnalysis]: { title: 'Iceberg_Analysis' },
  [ListKeys.IcebergPdca]: { title: 'Iceberg_PDCA' },
  [ListKeys.SurveyTokusei]: { title: 'FormsResponses_Tokusei' },
  [ListKeys.OrgMaster]: { title: 'Org_Master' },
  [ListKeys.StaffAttendance]: { title: 'Staff_Attendance' },
  [ListKeys.DiagnosticsReports]: { title: 'Diagnostics_Reports' },
  [ListKeys.AttendanceUsers]: { title: 'AttendanceUsers' },
  [ListKeys.AttendanceDaily]: { title: 'AttendanceDaily' },
  [ListKeys.MeetingMinutes]: { title: 'MeetingMinutes' },
  [ListKeys.SupportTemplates]: { title: 'SupportTemplates' },
  [ListKeys.PlanGoals]: { title: 'PlanGoals' },
  [ListKeys.SupportPlans]: { title: 'SupportPlans' },
  [ListKeys.TransportLog]: { title: 'Transport_Log' },
  // ── ISP 三層モデル (監査 P0-2 追加) ──
  [ListKeys.IspMaster]: { title: 'ISP_Master' },
  [ListKeys.PlanningSheetMaster]: { title: 'SupportPlanningSheet_Master' },
  [ListKeys.ProcedureRecordDaily]: { title: 'SupportProcedureRecord_Daily' },
  [ListKeys.BehaviorMonitoringMaster]: { title: 'BehaviorMonitoringRecord_Master' },
  [ListKeys.PlanningSheetReassessmentMaster]: { title: 'PlanningSheetReassessment_Master' },
  [ListKeys.HolidayMaster]: { title: 'Holiday_Master' },
  // ── P1-2/P1-3 追加 ──
  [ListKeys.PdfOutputLog]: { title: 'PdfOutput_Log' },
  [ListKeys.NurseObservations]: { title: 'NurseObservations' },
  [ListKeys.DailyAttendance]: { title: 'Daily_Attendance' },
  // ── P3: モニタリング会議 ──
  [ListKeys.MonitoringMeetings]: { title: 'MonitoringMeetings' },
  // ── スケジュール（登録漏れ修正） ──
  [ListKeys.Schedules]: { title: 'Schedules' },
  // ── 電話受付ログ ──
  [ListKeys.CallLogs]: { title: 'CallLogs' },
};

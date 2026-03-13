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
};

# Zombie Column Audit — Summary

**Scan timestamp**: 2026-04-22T04:54:46.657Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 113084c0

## Per-list counts

| List | Total | keep_ssot | keep_system | drift_suffix | drift_encoded | legacy_unknown |
|---|---|---|---|---|---|---|
| [Users_Master](./Users_Master.md) | 335 | 21 | 85 | 62 | 152 | 15 |
| [User_Feature_Flags](./User_Feature_Flags.md) | 89 | 4 | 85 | 0 | 0 | 0 |
| [UserTransport_Settings](./UserTransport_Settings.md) | 109 | 10 | 85 | 11 | 3 | 0 |
| [UserBenefit_Profile](./UserBenefit_Profile.md) | 92 | 7 | 85 | 0 | 0 | 0 |
| [UserBenefit_Profile_Ext](./UserBenefit_Profile_Ext.md) | 88 | 3 | 85 | 0 | 0 | 0 |
| [Staff_Master](./Staff_Master.md) | 114 | 20 | 85 | 4 | 0 | 5 |
| [Org_Master](./Org_Master.md) | 91 | 6 | 85 | 0 | 0 | 0 |
| [Holiday_Master](./Holiday_Master.md) | 90 | 0 | 85 | 0 | 0 | 5 |
| [Daily_Attendance](./Daily_Attendance.md) | 121 | 7 | 85 | 29 | 0 | 0 |
| [AttendanceUsers](./AttendanceUsers.md) | 96 | 6 | 85 | 0 | 1 | 4 |
| [AttendanceDaily](./AttendanceDaily.md) | 490 | 19 | 85 | 112 | 274 | 0 |
| [Staff_Attendance](./Staff_Attendance.md) | 103 | 12 | 85 | 3 | 0 | 3 |
| [Transport_Log](./Transport_Log.md) | 96 | 9 | 85 | 0 | 0 | 2 |
| [SupportRecord_Daily](./SupportRecord_Daily.md) | 115 | 11 | 85 | 0 | 6 | 13 |
| [SupportProcedureRecord_Daily](./SupportProcedureRecord_Daily.md) | 139 | 18 | 85 | 28 | 5 | 3 |
| [DailyRecordRows](./DailyRecordRows.md) | 106 | 7 | 85 | 12 | 0 | 2 |
| [DailyActivityRecords](./DailyActivityRecords.md) | 99 | 10 | 85 | 1 | 0 | 3 |
| [ServiceProvisionRecords](./ServiceProvisionRecords.md) | 177 | 16 | 85 | 2 | 74 | 0 |
| [ActivityDiary](./ActivityDiary.md) | 238 | 8 | 85 | 0 | 145 | 0 |
| [Schedules](./Schedules.md) | 108 | 9 | 85 | 0 | 0 | 14 |
| [SupportProcedure_Results](./SupportProcedure_Results.md) | 93 | 2 | 85 | 0 | 6 | 0 |
| [Approval_Logs](./Approval_Logs.md) | 90 | 5 | 85 | 0 | 0 | 0 |
| [MeetingSessions](./MeetingSessions.md) | 320 | 16 | 85 | 219 | 0 | 0 |
| [MeetingSteps](./MeetingSteps.md) | 110 | 11 | 85 | 13 | 1 | 0 |
| [MeetingMinutes](./MeetingMinutes.md) | 101 | 8 | 85 | 0 | 0 | 8 |
| [MonitoringMeetings](./MonitoringMeetings.md) | 121 | 18 | 85 | 0 | 0 | 18 |
| [Handoff](./Handoff.md) | 105 | 8 | 85 | 0 | 0 | 12 |
| [SupportTemplates](./SupportTemplates.md) | 98 | 0 | 85 | 0 | 0 | 13 |
| [PlanGoals](./PlanGoals.md) | 85 | 0 | 85 | 0 | 0 | 0 |
| [SupportPlans](./SupportPlans.md) | 97 | 6 | 85 | 6 | 0 | 0 |
| [Iceberg_PDCA](./Iceberg_PDCA.md) | 92 | 4 | 85 | 0 | 0 | 3 |
| [Iceberg_Analysis](./Iceberg_Analysis.md) | 91 | 6 | 85 | 0 | 0 | 0 |
| [ISP_Master](./ISP_Master.md) | 106 | 8 | 85 | 0 | 0 | 13 |
| [SupportPlanningSheet_Master](./SupportPlanningSheet_Master.md) | 125 | 0 | 85 | 0 | 0 | 40 |
| [Compliance_CheckRules](./Compliance_CheckRules.md) | 102 | 6 | 85 | 1 | 0 | 10 |
| [Diagnostics_Reports](./Diagnostics_Reports.md) | 91 | 0 | 85 | 0 | 4 | 2 |
| [DriftEventsLog_v2](./DriftEventsLog_v2.md) | 92 | 7 | 85 | 0 | 0 | 0 |
| [FormsResponses_Tokusei](./FormsResponses_Tokusei.md) | 112 | 0 | 85 | 0 | 0 | 27 |
| [NurseObservations](./NurseObservations.md) | 327 | 0 | 85 | 0 | 236 | 6 |
| [OfficialForms](./OfficialForms.md) | 87 | 2 | 85 | 0 | 0 | 0 |
| [BillingOrders](./BillingOrders.md) | 89 | 1 | 85 | 0 | 3 | 0 |
| [MonthlyRecord_Summary](./MonthlyRecord_Summary.md) | 377 | 16 | 85 | 228 | 41 | 7 |
| [PdfOutput_Log](./PdfOutput_Log.md) | 95 | 0 | 85 | 0 | 0 | 10 |

## Next steps

1. Review each list's `.md` report and confirm the deletion candidates.
2. For `legacy_unknown` rows, trace usage via `git log -S` before deciding.
3. Once confirmed, either:
   - Use the SharePoint UI to delete columns manually (safest), or
   - Run `node scripts/ops/zombie-column-purger.mjs --force` (⚠️ deletes columns matching the hardcoded `TARGETS.patterns` — not the audit output).
4. After deletion, re-run bootstrap and confirm `sp:provision_partial` no longer fires for these lists.


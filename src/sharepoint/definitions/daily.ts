import { ListKeys } from '@/sharepoint/fields';
import { envOr, fromConfig } from '../spListRegistry.shared';
import type { SpListEntry } from '../spListRegistry.shared';

export const dailyListEntries: readonly SpListEntry[] = [
// ── 2. 日々の記録系 ─────────────────────────────────────
  {
    key: 'support_record_daily',
    displayName: '日次支援記録 (親/統括)',
    resolve: () => envOr('VITE_SP_LIST_DAILY_RECORD', fromConfig(ListKeys.DailyRecordParent)),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required',
    // DAILY_RECORD_CANONICAL_ESSENTIALS と一致させる:
    //   Title / RecordDate / UserRowsJSON が必須。
    //   ReporterName は欠落時でも記録者不明として継続可能なためオプション。
    essentialFields: ['Title', 'RecordDate', 'UserRowsJSON'],
    provisioningFields: [
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true, candidates: ['RecordDate', 'Record_x0020_Date'] },
      { internalName: 'ReporterName', type: 'Text', displayName: 'Reporter Name', candidates: ['ReporterName', 'Reporter_x0020_Name'] },
      { internalName: 'ReporterRole', type: 'Text', displayName: 'Reporter Role', candidates: ['ReporterRole', 'Reporter_x0020_Role'] },
      { internalName: 'UserRowsJSON', type: 'Note', displayName: 'User Rows JSON', required: true, richText: false, candidates: ['UserRowsJSON', 'User_x0020_Rows_x0020_JSON'] },
      { internalName: 'UserCount', type: 'Number', displayName: 'User Count', candidates: ['UserCount', 'User_x0020_Count'] },
      { internalName: 'ApprovalStatus', type: 'Text', displayName: 'Approval Status', candidates: ['ApprovalStatus', 'Approval_x0020_Status'] },
      { internalName: 'ApprovedBy', type: 'Text', displayName: 'Approved By', candidates: ['ApprovedBy', 'Approved_x0020_By'] },
      { internalName: 'ApprovedAt', type: 'DateTime', displayName: 'Approved At', dateTimeFormat: 'DateTime', candidates: ['ApprovedAt', 'Approved_x0020_At'] },
      { internalName: 'Completed', type: 'Boolean', displayName: 'Completed (Legacy)', governance: 'allow', isSilent: true, candidates: ['Completed'] },
      { internalName: 'Incident', type: 'Text', displayName: 'Incident (Legacy)', governance: 'allow', isSilent: true, candidates: ['Incident'] },
      { internalName: 'UserId', type: 'Text', displayName: 'User ID (Legacy Row Aggregate)', governance: 'allow', isSilent: true, candidates: ['UserId', 'UserID', 'UserCode', 'User_x0020_ID', 'cr013_personId', 'cr013_usercode'] },
      { internalName: 'Status', type: 'Text', displayName: 'Status (Legacy Row Aggregate)', governance: 'allow', isSilent: true, candidates: ['Status', 'status', 'cr013_status'] },
      { internalName: 'cr013_recorddate', type: 'DateTime', displayName: 'Record Date (Legacy)', dateTimeFormat: 'DateOnly', governance: 'allow', isSilent: true, candidates: ['cr013_recorddate', 'RecordDate', 'Date'] },
      { internalName: 'cr013_specialnote', type: 'Note', displayName: 'Special Note (Legacy)', richText: false, governance: 'allow', isSilent: true, candidates: ['cr013_specialnote', 'SpecialNote'] },
    ],
  },
  {
    key: 'support_procedure_record_daily',
    displayName: '支援手順記録 (ISP詳細)',
    resolve: () => envOr('VITE_SP_LIST_PROCEDURE_RECORD', fromConfig(ListKeys.ProcedureRecordDaily)),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required', // 三層モデルの核となるため required
    essentialFields: [
      'UserCode', 'RecordDate', 'ExecutionStatus', 'PlanningSheetId'
    ],
    provisioningFields: [
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true, candidates: ['UserCode', 'User_ID', 'cr013_userCode'] },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true, candidates: ['RecordDate', 'Date', 'cr013_recordDate'] },
      { internalName: 'ISP_x0020_ID', type: 'Number', displayName: 'ISP ID', candidates: ['ISP_x0020_ID', 'ISPId', 'cr013_ispId'] },
      { internalName: 'PlanningSheetId', type: 'Text', displayName: 'Planning Sheet ID', required: true, candidates: ['PlanningSheetId', 'cr013_planningSheetId'] },
      { internalName: 'ProcedureText', type: 'Note', displayName: 'Procedure Text', richText: false, candidates: ['ProcedureText', 'Procedure', 'Procedure_x0020_Text', 'cr013_procedureText'] },
      { internalName: 'ExecutionStatus', type: 'Text', displayName: 'Execution Status', candidates: ['ExecutionStatus', 'Status', 'Execution_x0020_Status', 'cr013_executionStatus'] },
      { internalName: 'TimeSlot', type: 'Text', displayName: 'Time Slot', candidates: ['TimeSlot', 'Time', 'Time_x0020_Slot', 'cr013_timeSlot'] },
      { internalName: 'Activity', type: 'Text', displayName: 'Activity', candidates: ['Activity', 'Action', 'cr013_activity'] },
      { internalName: 'PerformedBy', type: 'Text', displayName: 'Performed By', candidates: ['PerformedBy', 'Staff', 'Performed_x0020_By', 'cr013_performedBy'] },
      { internalName: 'PerformedAt', type: 'DateTime', displayName: 'Performed At', candidates: ['PerformedAt', 'Time', 'Performed_x0020_At', 'cr013_performedAt'] },
      { internalName: 'UserResponse', type: 'Note', displayName: 'User Response', richText: false, candidates: ['UserResponse', 'User_x0020_Response'] },
      { internalName: 'SpecialNotes', type: 'Note', displayName: 'Special Notes', richText: false, candidates: ['SpecialNotes', 'Special_x0020_Notes'] },
      { internalName: 'Handoff_x0020_Notes', type: 'Note', displayName: 'Handoff Notes', richText: false, candidates: ['HandoffNotes', 'Handoff_x0020_Notes', 'cr013_handoffNotes'] },
    ],
  },
  {
    key: 'support_record_rows',
    displayName: '日次支援記録 (詳細行)',
    resolve: () => envOr('VITE_SP_LIST_PROCEDURE_RECORD_ROWS', 'DailyRecordRows'),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required',
    essentialFields: [
      'ParentID', 'UserID'
    ],
    provisioningFields: [
      { internalName: 'ParentID', type: 'Number', displayName: 'Parent ID', required: true, indexed: true, candidates: ['ParentID', 'Parent_x0020_ID'] },
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true, indexed: true, candidates: ['UserID', 'User_x0020_ID', 'Title'] },
      { internalName: 'Version', type: 'Number', displayName: 'Version', default: 1, governance: 'allow', isSilent: true, candidates: ['Version', 'VersionNo', 'cr013_version'] },
      { internalName: 'Status', type: 'Text', displayName: 'Status' },
      { internalName: 'Status0', type: 'Text', displayName: 'Status (Legacy)', governance: 'allow', isSilent: true, candidates: ['Status0'] },
      { internalName: 'Observation', type: 'Note', displayName: 'Observation (Legacy)', richText: false, governance: 'allow', isSilent: true, candidates: ['Observation'] },
      { internalName: 'User_x0020_ID', type: 'Text', displayName: 'User ID (Legacy SP-encoded)', governance: 'allow', isSilent: true, candidates: ['User_x0020_ID'] },
      { internalName: 'RowNo', type: 'Number', displayName: 'Row No', candidates: ['RowNo', 'cr013_rowNo', 'RowIndex'] },
      { internalName: 'Payload', type: 'Note', displayName: 'Row Data JSON', richText: false, governance: 'allow', isSilent: true, candidates: ['Payload', 'payload', 'cr013_payload', 'cr013_draftJson', 'PayloadJSON', 'SupportRecordPayload', 'Payload_x0020_JSON', 'Observation'] },
      { internalName: 'RecordedAt', type: 'DateTime', displayName: 'Recorded At', candidates: ['RecordedAt', 'Recorded_x0020_At'] },
    ],
  },
  {
    key: 'daily_activity_records',
    displayName: '日次活動記録',
    resolve: () => envOr('VITE_SP_LIST_DAILY_ACTIVITY_RECORDS', fromConfig(ListKeys.DailyActivityRecords)),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required',
    essentialFields: ['UserCode', 'RecordDate', 'TimeSlot', 'Observation'],
    provisioningFields: [
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, candidates: ['UserCode', 'User_x0020_Code'] },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', candidates: ['RecordDate', 'Record_x0020_Date'] },
      { internalName: 'TimeSlot', type: 'Text', displayName: 'Time Slot', candidates: ['TimeSlot', 'Time_x0020_Slot'] },
      { internalName: 'PlanSlotKey', type: 'Text', displayName: 'Plan Slot Key', candidates: ['PlanSlotKey', 'Plan_x0020_Slot_x0020_Key'] },
      { internalName: 'PlannedActivity', type: 'Text', displayName: 'Planned Activity', candidates: ['PlannedActivity', 'Planned_x0020_Activity'] },
      { internalName: 'RecordedAtText', type: 'Text', displayName: 'Recorded At', candidates: ['RecordedAtText', 'RecordedAt'] },
      { internalName: 'Observation', type: 'Note', displayName: 'Observation' },
      { internalName: 'Behavior', type: 'Note', displayName: 'Behavior' },
      { internalName: 'version', type: 'Text', displayName: 'Intensity/Version', governance: 'allow' },
      { internalName: 'duration', type: 'Text', displayName: 'Duration' },
      { internalName: 'Order', type: 'Number', displayName: 'Order' },
    ],
  },
  {
    key: 'service_provision_records',
    displayName: 'サービス提供実績',
    resolve: () => envOr('VITE_SP_LIST_SERVICE_PROVISION', 'ServiceProvisionRecords'),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required', // 業務継続に不可欠なため required へ昇格
    essentialFields: [
      'EntryKey', 'UserCode', 'RecordDate', 'Status', 'StartHHMM', 'EndHHMM'
    ],
    provisioningFields: [
      { internalName: 'EntryKey', type: 'Text', displayName: 'Entry Key', required: true, indexed: true, candidates: ['EntryKey', 'Entry_x0020_Key'] },
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true, candidates: ['UserCode', 'User_x0020_Code'] },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true, candidates: ['RecordDate', 'Record_x0020_Date'] },
      { internalName: 'Status', type: 'Text', displayName: 'Status' },
      { internalName: 'StartHHMM', type: 'Text', displayName: 'Start Time (HHMM)', candidates: ['StartHHMM', 'Start_x0020_Time_x0020__x0028_HH'] },
      { internalName: 'EndHHMM', type: 'Text', displayName: 'End Time (HHMM)', candidates: ['EndHHMM', 'End_x0020_Time_x0020__x0028_HHMM'] },
      { internalName: 'HasTransport', type: 'Boolean', displayName: 'Has Transport', candidates: ['HasTransport', 'Has_x0020_Transport'] },
      { internalName: 'HasTransportPickup', type: 'Boolean', displayName: 'Has Transport Pickup' },
      { internalName: 'HasTransportDropoff', type: 'Boolean', displayName: 'Has Transport Dropoff' },
      { internalName: 'HasMeal', type: 'Boolean', displayName: 'Has Meal', candidates: ['HasMeal', 'Has_x0020_Meal'] },
      { internalName: 'HasBath', type: 'Boolean', displayName: 'Has Bath', candidates: ['HasBath', 'Has_x0020_Bath'] },
      { internalName: 'HasExtended', type: 'Boolean', displayName: 'Has Extended', candidates: ['HasExtended', 'Has_x0020_Extended'] },
      { internalName: 'HasAbsentSupport', type: 'Boolean', displayName: 'Has Absent Support', candidates: ['HasAbsentSupport', 'Has_x0020_Absent_x0020_Support'] },
      { internalName: 'Note', type: 'Note', displayName: 'Note', richText: false },
      { internalName: 'Status0', type: 'Text', displayName: 'Status (Legacy)', governance: 'allow', isSilent: true, candidates: ['Status0'] },
      { internalName: 'Source', type: 'Text', displayName: 'Source' },
      { internalName: 'UpdatedByUPN', type: 'Text', displayName: 'UpdatedByUPN' },
    ],
  },
  {
    key: 'activity_diary',
    displayName: '活動日誌',
    resolve: () => envOr('VITE_SP_LIST_ACTIVITY_DIARY', 'ActivityDiary'),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required', // 業務継続に不可欠なため required へ昇格
    essentialFields: ['UserID', 'Date', 'Shift', 'Category'],
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true },
      { internalName: 'Date', type: 'DateTime', displayName: 'Date', required: true, dateTimeFormat: 'DateOnly', indexed: true, candidates: ['Date', 'ServiceDate', 'RecordDate', 'EntryDate', 'cr013_date'] },
      { internalName: 'Shift', type: 'Choice', displayName: 'Shift', choices: ['AM', 'PM', '1日'], required: true },
      { internalName: 'Category', type: 'Choice', displayName: 'Category', choices: ['請負', '個別', '外活動', '余暇'], required: true },
      { internalName: 'LunchAmount', type: 'Choice', displayName: 'Lunch Amount', choices: ['完食', '8割', '半分', '少量', 'なし'] },
      { internalName: 'ProblemBehavior', type: 'Boolean', displayName: 'Problem Behavior' },
      { internalName: 'Seizure', type: 'Boolean', displayName: 'Seizure' },
      { internalName: 'Goals', type: 'Note', displayName: 'Goals JSON', richText: false, governance: 'allow', isSilent: true, candidates: ['Goals', 'goals', 'GoalIds', 'cr013_goals'] },
      { internalName: 'Notes', type: 'Note', displayName: 'Notes', richText: false },
    ],
  },
  {
    key: 'abc_behavior_records',
    displayName: 'ABC行動記録',
    resolve: () => envOr('VITE_SP_LIST_ABC_BEHAVIOR_RECORDS', 'AbcBehaviorRecords'),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required',
    essentialFields: ['AbcRecordId', 'UserId', 'RecordDate', 'Behavior', 'IsDeleted'],
    provisioningFields: [
      { internalName: 'AbcRecordId', type: 'Text', displayName: 'ABC記録ID (UUID)', required: true, indexed: true, candidates: ['AbcRecordId', 'abcRecordId', 'cr013_abcRecordId'] },
      { internalName: 'UserId', type: 'Text', displayName: '利用者コード', required: true, indexed: true, candidates: ['UserId', 'userId', 'cr013_userId', 'UserID'] },
      { internalName: 'RecordDate', type: 'DateTime', displayName: '記録日', required: true, dateTimeFormat: 'DateOnly', indexed: true, candidates: ['RecordDate', 'recordDate', 'cr013_recordDate'] },
      { internalName: 'OccurredAt', type: 'Text', displayName: '発生時刻', candidates: ['OccurredAt', 'occurredAt', 'cr013_occurredAt'] },
      { internalName: 'Setting', type: 'Text', displayName: '環境・状況(S)', candidates: ['Setting', 'setting'] },
      { internalName: 'Antecedent', type: 'Note', displayName: '直前の状況(A)', richText: false, candidates: ['Antecedent', 'antecedent'] },
      { internalName: 'Behavior', type: 'Note', displayName: '行動の様子(B)', required: true, richText: false, candidates: ['Behavior', 'behavior'] },
      { internalName: 'Consequence', type: 'Note', displayName: '直後の結果(C)', richText: false, candidates: ['Consequence', 'consequence'] },
      { internalName: 'Intensity', type: 'Text', displayName: '強度', candidates: ['Intensity', 'intensity'] },
      { internalName: 'DurationMinutes', type: 'Number', displayName: '継続時間(分)', candidates: ['DurationMinutes', 'durationMinutes'] },
      { internalName: 'RiskFlag', type: 'Boolean', displayName: '自他害・物損フラグ', candidates: ['RiskFlag', 'riskFlag'] },
      { internalName: 'TagsJson', type: 'Note', displayName: 'タグJSON', richText: false, candidates: ['TagsJson', 'tagsJson'] },
      { internalName: 'Notes', type: 'Note', displayName: '備考・特記事項', richText: false, candidates: ['Notes', 'notes'] },
      { internalName: 'SourcePage', type: 'Text', displayName: '遷移元画面', candidates: ['SourcePage', 'sourcePage'] },
      { internalName: 'SourceDate', type: 'Text', displayName: '遷移元日付', candidates: ['SourceDate', 'sourceDate'] },
      { internalName: 'SourceSlotId', type: 'Text', displayName: '遷移元スロットID', candidates: ['SourceSlotId', 'sourceSlotId'] },
      { internalName: 'SourceSlotLabel', type: 'Text', displayName: '遷移元スロット名', candidates: ['SourceSlotLabel', 'sourceSlotLabel'] },
      { internalName: 'ReturnUrl', type: 'Text', displayName: '戻り先URL', candidates: ['ReturnUrl', 'returnUrl'] },
      { internalName: 'RecorderName', type: 'Text', displayName: '記録者氏名', candidates: ['RecorderName', 'recorderName'] },
      { internalName: 'CreatedByCode', type: 'Text', displayName: '作成者コード', required: true, candidates: ['CreatedByCode', 'createdByCode', 'CreatedBy'] },
      { internalName: 'UpdatedByCode', type: 'Text', displayName: '更新者コード', candidates: ['UpdatedByCode', 'updatedByCode', 'ModifiedBy'] },
      { internalName: 'CreatedAt', type: 'Text', displayName: '作成日時', required: true, candidates: ['CreatedAt', 'createdAt', 'Created'] },
      { internalName: 'UpdatedAt', type: 'Text', displayName: '更新日時', candidates: ['UpdatedAt', 'updatedAt', 'Modified'] },
      { internalName: 'IsDeleted', type: 'Boolean', displayName: '論理削除フラグ', default: false, candidates: ['IsDeleted', 'isDeleted'] },
      { internalName: 'DeletedAt', type: 'Text', displayName: '削除日時', candidates: ['DeletedAt', 'deletedAt'] },
      { internalName: 'DeletedByCode', type: 'Text', displayName: '削除者コード', candidates: ['DeletedByCode', 'deletedByCode'] },
    ],
  },
];

/**
 * DailyRecordRows 17行モデル向け 追加予定列（dry-run 専用）
 *
 * 注意:
 * - 本定義は guarded apply 前の候補整理用途。
 * - 現時点では support_record_rows の provisioningFields へは反映しない。
 */
export const DAILY_RECORD_ROWS_17ROW_PROPOSED_FIELDS = [
  { internalName: 'UserCode0', type: 'Text', displayName: '利用者コード', candidates: ['UserCode0', 'UserCode', 'User_x0020_Code'] },
  { internalName: 'RecordDate0', type: 'DateTime', displayName: '記録日', dateTimeFormat: 'DateOnly', candidates: ['RecordDate0', 'RecordDate', 'Record_x0020_Date'] },
  { internalName: 'RowNo0', type: 'Number', displayName: '行番号', candidates: ['RowNo0', 'RowNo'] },
  { internalName: 'TimeSlot0', type: 'Text', displayName: '時間帯', candidates: ['TimeSlot0', 'TimeSlot', 'Time_x0020_Slot'] },
  { internalName: 'Activity0', type: 'Text', displayName: '活動内容', candidates: ['Activity0', 'Activity'] },
  { internalName: 'PersonManual0', type: 'Note', displayName: '本人の動き', richText: false, candidates: ['PersonManual0', 'PersonManual'] },
  { internalName: 'SupporterManual0', type: 'Note', displayName: '支援者の動き', richText: false, candidates: ['SupporterManual0', 'SupporterManual'] },
  { internalName: 'Situation0', type: 'Note', displayName: '当日の様子・記録', richText: false, candidates: ['Situation0', 'Situation'] },
  { internalName: 'Completed0', type: 'Text', displayName: '実行ステータス', candidates: ['Completed0', 'Completed'] },
  { internalName: 'ProcedureType0', type: 'Text', displayName: 'ブロックカテゴリ', candidates: ['ProcedureType0', 'ProcedureType'] },
  { internalName: 'ParentRowNo0', type: 'Number', displayName: '親行番号', candidates: ['ParentRowNo0', 'ParentRowNo'] },
  { internalName: 'CreatedByName0', type: 'Text', displayName: '記録者氏名', candidates: ['CreatedByName0', 'CreatedByName'] },
  { internalName: 'SourceFileName0', type: 'Text', displayName: '取込元ファイル名', required: true, candidates: ['SourceFileName0', 'SourceFileName'] },
] as const;

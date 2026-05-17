import { ListKeys } from '@/sharepoint/fields';
import { envOr, fromConfig } from '../spListRegistry.shared';
import type { SpListEntry } from '../spListRegistry.shared';

export const complianceListEntries: readonly SpListEntry[] = [
// ── 7. コンプライアンス・診断系 ────────────────────────
  {
    key: 'compliance_check_rules',
    displayName: '監査チェックルール',
    resolve: () => envOr('VITE_SP_LIST_COMPLIANCE', fromConfig(ListKeys.ComplianceCheckRules)),
    operations: ['R'],
    category: 'compliance',
    lifecycle: 'optional',
    provisioningFields: [
      { internalName: 'RuleID', type: 'Text', displayName: 'Rule ID', required: true, indexed: true },
      { internalName: 'Checkpoint', type: 'Text', displayName: 'Checkpoint', required: true },
      { internalName: 'Criteria', type: 'Note', displayName: 'Criteria', richText: false },
      { internalName: 'EvidenceRequired', type: 'Note', displayName: 'Evidence Required', richText: false },
      { internalName: 'RuleName', type: 'Text', displayName: 'Rule Name (Legacy)', governance: 'allow', isSilent: true, candidates: ['RuleName'] },
      { internalName: 'EvaluationLogic', type: 'Note', displayName: 'Evaluation Logic (Legacy)', richText: false, governance: 'allow', isSilent: true, candidates: ['EvaluationLogic'] },
      { internalName: 'SeverityLevel', type: 'Text', displayName: 'Severity Level (Legacy)', governance: 'allow', isSilent: true, candidates: ['SeverityLevel'] },
      { internalName: 'ValidFrom', type: 'DateTime', displayName: 'Valid From (Legacy)', governance: 'allow', isSilent: true, candidates: ['ValidFrom'] },
      { internalName: 'ValidTo', type: 'DateTime', displayName: 'Valid To (Legacy)', governance: 'allow', isSilent: true, candidates: ['ValidTo'] },
      { internalName: 'SortOrder', type: 'Number', displayName: 'Sort Order' },
      { internalName: 'IsActive', type: 'Boolean', displayName: 'Active', default: true },
    ],
  },
  {
    key: 'diagnostics_reports',
    displayName: '環境診断レポート',
    resolve: () => envOr('VITE_SP_LIST_DIAGNOSTICS_REPORTS', fromConfig(ListKeys.DiagnosticsReports)),
    operations: ['R', 'W'],
    category: 'compliance',
    lifecycle: 'optional',
    provisioningFields: [
      { internalName: 'Status', type: 'Text', displayName: 'Status (Legacy)', governance: 'allow', isSilent: true },
      { internalName: 'Notified', type: 'Boolean', displayName: 'Notified (Legacy)', governance: 'allow', isSilent: true },
      { internalName: 'Overall', type: 'Text', displayName: 'Overall (Legacy)', governance: 'allow', isSilent: true },
      { internalName: 'Top_x0020_Issue', type: 'Text', displayName: 'Top Issue', candidates: ['Top_x0020_Issue', 'TopIssue'] },
      { internalName: 'Summary_x0020_Text', type: 'Note', displayName: 'Summary Text (Legacy SP-encoded)', richText: false, governance: 'allow', isSilent: true, candidates: ['Summary_x0020_Text'] },
      { internalName: 'Report_x0020_Link', type: 'Text', displayName: 'Report Link (Legacy SP-encoded)', governance: 'allow', isSilent: true, candidates: ['Report_x0020_Link'] },
      { internalName: 'Notified_x0020_At', type: 'DateTime', displayName: 'Notified At (Legacy SP-encoded)', governance: 'allow', isSilent: true, candidates: ['Notified_x0020_At'] },
    ],
  },
  {
    key: 'drift_events_log',
    displayName: 'ドリフトイベント記録',
    resolve: () => envOr('VITE_SP_LIST_DRIFT_LOG', 'DriftEventsLog_v2'),
    operations: ['R', 'W'],
    category: 'compliance',
    lifecycle: 'optional',
    // Severity は SharePointDriftEventRepository が任意扱い（fail-open）で、
    // かつ本リストは lifecycle: 'optional' な観測用途のため essential から除外する。
    // 診断契約を実装契約に合わせ、宣言だけが厳しい状態を解消する。
    essentialFields: ['ListName', 'FieldName', 'DetectedAt', 'DriftType'],
    provisioningFields: [
      { internalName: 'ListName', type: 'Text', displayName: 'List Name', required: true, indexed: true, candidates: ['ListName', 'List_x0020_Name', 'cr013_listName'] },
      { internalName: 'FieldName', type: 'Text', displayName: 'Field Name', required: true, indexed: true, candidates: ['FieldName', 'Field_x0020_Name', 'cr013_fieldName'] },
      { internalName: 'DetectedAt', type: 'DateTime', displayName: 'Detected At', required: true, candidates: ['DetectedAt', 'Detected_x0020_At', 'cr013_detectedAt'] },
      { internalName: 'List_x0020_Name', type: 'Text', displayName: 'List Name (Legacy SP-encoded)', governance: 'allow', isSilent: true, candidates: ['List_x0020_Name'] },
      { internalName: 'Field_x0020_Name', type: 'Text', displayName: 'Field Name (Legacy SP-encoded)', governance: 'allow', isSilent: true, candidates: ['Field_x0020_Name'] },
      { internalName: 'Detected_x0020_At', type: 'DateTime', displayName: 'Detected At (Legacy SP-encoded)', governance: 'allow', isSilent: true, candidates: ['Detected_x0020_At'] },
      { internalName: 'LoggedAt', type: 'DateTime', displayName: 'Logged At', candidates: ['Logged_x0020_At', 'LoggedAt', 'cr013_loggedAt'] },
      { internalName: 'Severity', type: 'Text', displayName: 'Severity', isSilent: true, candidates: ['Severity', 'Level', 'cr013_severity'] },
      { internalName: 'ResolutionType', type: 'Text', displayName: 'Resolution Type', isSilent: true, candidates: ['Resolution_x0020_Type', 'ResolutionType', 'cr013_resolutionType'] },
      { internalName: 'DriftType', type: 'Text', displayName: 'Drift Type', isSilent: true, candidates: ['Drift_x0020_Type', 'DriftType', 'cr013_driftType'] },
      { internalName: 'Resolved', type: 'Boolean', displayName: 'Resolved', default: false, isSilent: true, candidates: ['Resolved', 'IsResolved', 'cr013_resolved'] },
      { internalName: 'Description', type: 'Note', displayName: 'Description', richText: false, isSilent: true, candidates: ['Description', 'Details', 'cr013_description'] },
      { internalName: 'RemediationSource', type: 'Text', displayName: 'Remediation Source', isSilent: true, candidates: ['RemediationSource', 'Source', 'cr013_remediationSource'] },
    ],
  },
  {
    key: 'remediation_audit_log',
    displayName: '自動修復・ガバナンス監査ログ',
    resolve: () => envOr('VITE_SP_LIST_REMEDIATION_LOG', fromConfig(ListKeys.RemediationAuditLog)),
    operations: ['R', 'W'],
    category: 'compliance',
    lifecycle: 'optional',
    essentialFields: ['PlanId', 'Phase', 'ListKey', 'Action', 'Timestamp'],
    provisioningFields: [
      { internalName: 'PlanId', type: 'Text', displayName: 'Plan ID', required: true, indexed: true, candidates: ['PlanId', 'Plan_x0020_ID', 'cr013_planId'] },
      { internalName: 'Phase', type: 'Text', displayName: 'Phase', required: true, candidates: ['Phase', 'Phase0', 'cr013_phase'] },
      { internalName: 'ListKey', type: 'Text', displayName: 'List Key', required: true, indexed: true, isSilent: true, candidates: ['ListKey', 'List_x0020_Key', 'cr013_listKey'] },
      { internalName: 'Action', type: 'Text', displayName: 'Action', required: true, candidates: ['Action', 'Action0', 'cr013_action'] },
      { internalName: 'Timestamp', type: 'DateTime', displayName: 'Timestamp', required: true, candidates: ['Timestamp', 'Timestamp0', 'cr013_timestamp'] },
      { internalName: 'Plan_x0020_ID', type: 'Text', displayName: 'Plan ID (Legacy SP-encoded)', governance: 'allow', isSilent: true, candidates: ['Plan_x0020_ID'] },
      { internalName: 'CorrelationId', type: 'Text', displayName: 'Correlation ID (Legacy)', governance: 'allow', isSilent: true, candidates: ['CorrelationId'] },
      { internalName: 'Correlation_x0020_ID', type: 'Text', displayName: 'Correlation ID (Legacy SP-encoded)', governance: 'allow', isSilent: true, candidates: ['Correlation_x0020_ID'] },
      { internalName: 'Status', type: 'Text', displayName: 'Status', isSilent: true, candidates: ['Status', 'ExecutionStatus', 'cr013_status'] },
      { internalName: 'Payload', type: 'Note', displayName: 'Payload JSON', richText: false, governance: 'allow', isSilent: true, candidates: ['Payload', 'payload', 'cr013_payload', 'cr013_draftJson', 'PayloadJSON', 'SupportRecordPayload', 'Payload_x0020_JSON', 'Observation'] },
    ],
  },
];

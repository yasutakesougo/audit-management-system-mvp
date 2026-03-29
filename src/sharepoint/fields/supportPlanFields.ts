/**
 * SharePoint フィールド定義 — SupportPlans
 *
 * 個別支援計画 — Draft → Confirmed → Obsolete ライフサイクル
 *
 * フォームデータは FormDataJson カラムに JSON シリアライズして格納。
 * スキーマ変更（項目追加等）に SP リスト側の列変更が不要。
 */

export const SUPPORT_PLANS_LIST_TITLE = 'SupportPlans' as const;

export const SUPPORT_PLANS_FIELDS = {
  id: 'Id',
  title: 'Title',              // composite key: <userCode>:<draftId>
  draftId: 'DraftId',          // UUID (matches client-side draft.id)
  userCode: 'UserCode',        // links to Users_Master.UserID
  draftName: 'DraftName',      // display name (利用者名)
  formDataJson: 'FormDataJson',// JSON of SupportPlanForm (17 fields)
  status: 'Status',            // 'draft' | 'confirmed' | 'obsolete'
  schemaVersion: 'SchemaVersion', // number (currently 2)
  created: 'Created',
  modified: 'Modified',
} as const;

export const SUPPORT_PLANS_SELECT_FIELDS = [
  SUPPORT_PLANS_FIELDS.id,
  SUPPORT_PLANS_FIELDS.title,
  SUPPORT_PLANS_FIELDS.draftId,
  SUPPORT_PLANS_FIELDS.userCode,
  SUPPORT_PLANS_FIELDS.draftName,
  SUPPORT_PLANS_FIELDS.formDataJson,
  SUPPORT_PLANS_FIELDS.status,
  SUPPORT_PLANS_FIELDS.schemaVersion,
  SUPPORT_PLANS_FIELDS.created,
  SUPPORT_PLANS_FIELDS.modified,
] as const;

/** Dynamic schema candidates for Support Plans. */
export const SUPPORT_PLANS_CANDIDATES = {
  draftId: ['DraftId', 'cr013_draftid'],
  userCode: ['UserCode', 'cr013_usercode', 'UserID'],
  draftName: ['DraftName', 'cr013_draftname', 'Title'],
  formDataJson: ['FormDataJson', 'cr013_formdatajson'],
  status: ['Status', 'cr013_status'],
  schemaVersion: ['SchemaVersion', 'cr013_schemaversion'],
} as const;

/** Essential fields for Support Plans list. */
export const SUPPORT_PLANS_ESSENTIALS = ['draftId', 'userCode', 'formDataJson'] as const;

/** Fields to ensure for modern Support Plans list. */
export const SUPPORT_PLANS_ENSURE_FIELDS = [
  { internalName: 'DraftId', displayName: 'DraftId', type: 'Text' },
  { internalName: 'UserCode', displayName: 'UserCode', type: 'Text' },
  { internalName: 'DraftName', displayName: 'DraftName', type: 'Text' },
  { internalName: 'FormDataJson', displayName: 'FormDataJson', type: 'Note' },
  { internalName: 'Status', displayName: 'Status', type: 'Text' },
  { internalName: 'SchemaVersion', displayName: 'SchemaVersion', type: 'Number' },
] as const;

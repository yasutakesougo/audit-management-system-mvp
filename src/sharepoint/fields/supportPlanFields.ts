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

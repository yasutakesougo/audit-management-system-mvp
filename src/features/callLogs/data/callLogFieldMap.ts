/**
 * CallLog SharePoint フィールドマップ
 *
 * Internal Name (列の内部名) を SSOT で一元管理する。
 * SP の表示名を変更しても、ここだけ修正すれば済む。
 */

export const CALL_LOG_LIST_TITLE = 'CallLogs' as const;

export const CALL_LOG_FIELDS = {
  /** Title (タイトル列: 件名 + 発信者の複合) */
  title: 'Title',

  /** 受電日時 (DateTime) */
  receivedAt: 'ReceivedAt',

  /** 発信者名 (Text) */
  callerName: 'CallerName',

  /** 発信者所属 (Text, optional) */
  callerOrg: 'CallerOrg',

  /** 対象担当者名 (Text) */
  targetStaffName: 'TargetStaffName',

  /** 受付者名 (Text) */
  receivedByName: 'ReceivedByName',

  /** 用件本文 (Note) */
  message: 'MessageBody',

  /** 折返し要否 (YesNo) */
  needCallback: 'NeedCallback',

  /** 緊急度 (Choice: normal / today / urgent) */
  urgency: 'Urgency',

  /** 対応状況 (Choice: new / callback_pending / done) */
  status: 'Status',

  /** 関連利用者 ID (Text, optional) */
  relatedUserId: 'RelatedUserId',

  /** 関連利用者名 (Text, optional) */
  relatedUserName: 'RelatedUserName',

  /** 折返し期限 (DateTime, optional) */
  callbackDueAt: 'CallbackDueAt',

  /** 完了日時 (DateTime, optional) */
  completedAt: 'CompletedAt',

  /** SP standard: 作成日時 */
  created: 'Created',

  /** SP standard: 更新日時 */
  modified: 'Modified',
} as const;

export type CallLogFieldKey = keyof typeof CALL_LOG_FIELDS;

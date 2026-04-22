/**
 * SP Index Advisor — 既知の「必須インデックスフィールド」定義
 *
 * 各リストについて、インデックスが必要なフィールドとその理由を静的に定義する。
 * - このセットに「ある」が SP に「ない」 → 追加候補
 * - SP に「ある」がこのセットに「ない」 → 削除候補
 *
 * ソース: sharepoint/fields/ のスキーマ定義 + $filter/$orderby の実利用パターン
 */

export interface IndexFieldSpec {
  /** SP InternalName */
  internalName: string;
  /** 表示用ラベル */
  displayName: string;
  /** このフィールドにインデックスが必要な理由 */
  reason: string;
}

/**
 * リストタイトル → 必須インデックスフィールド一覧
 *
 * 注意: ここにないリストは「定義なし」として扱い、
 * 削除候補は提示せず、追加候補のみ「不明」として表示する。
 */
export const KNOWN_REQUIRED_INDEXED_FIELDS: Record<string, IndexFieldSpec[]> = {
  SupportProcedure_Results: [
    {
      internalName: 'ParentScheduleId',
      displayName: '親スケジュールID',
      reason: '$filter=ParentScheduleId eq X（5000件上限回避）',
    },
  ],
  Approval_Logs: [
    {
      internalName: 'ParentScheduleId',
      displayName: '親スケジュールID',
      reason: '$filter=ParentScheduleId eq X（5000件上限回避）',
    },
    {
      internalName: 'ApprovedAt',
      displayName: '承認日時',
      reason: 'ParentScheduleId + ApprovedAt の複合ユニーク判定（$orderby 利用）',
    },
  ],
  User_Feature_Flags: [
    {
      internalName: 'UserCode',
      displayName: 'ユーザーコード',
      reason: '$filter=UserCode eq X（ユーザー機能フラグ取得）',
    },
  ],
  // 高頻度フィルタを使うリストは随時追加
  DailyActivityRecords: [
    {
      internalName: 'RecordDate',
      displayName: 'Record Date',
      reason: '$filter=RecordDate eq X（日次取得）',
    },
  ],
  Schedules: [
    {
      internalName: 'AssignedStaffId',
      displayName: '職員コード',
      reason: '$filter=AssignedStaffId eq X（職員別スケジュール取得）',
    },
  ],
  UserBenefit_Profile_Ext: [
    {
      internalName: 'User_x0020_ID',
      displayName: 'User ID',
      reason: '$filter=User_x0020_ID eq X（利用者属性取得のキー）',
    },
  ],
  UserBenefit_Profile: [
    {
      internalName: 'User_x0020_ID',
      displayName: '利用者ID',
      reason: '結合・取得の主キー',
    },
    {
      internalName: 'Grant_x0020_Period_x0020_End',
      displayName: '支給終了日',
      reason: '更新勧告・有効性判定のフィルタ用',
    },
    {
      internalName: 'Modified',
      displayName: '更新日時',
      reason: '最終更新順の取得用',
    },
  ],
  Iceberg_Analysis: [
    {
      internalName: 'EntryHash',
      displayName: '登録ハッシュ',
      reason: 'Upsert（冪等書き込み）の判定キー',
    },
    {
      internalName: 'UserId',
      displayName: '利用者ID',
      reason: 'ユーザー別最新取得のフィルタ用',
    },
    {
      internalName: 'UpdatedAt',
      displayName: '更新日時',
      reason: '最新スナップショット特定用（$orderby）',
    },
    {
      internalName: 'SessionId',
      displayName: 'セッションID',
      reason: '特定分析セッションの識別用',
    },
  ],
};

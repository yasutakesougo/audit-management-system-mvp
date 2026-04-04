/**
 * DriftActionEvent — SharePoint インフラ層で検知されたドリフトイベントの統一定義。
 * 
 * このイベントは、GenericSchemaResolver や GenericSaver で検知された
 * スキーマの揺れ、フィールドの欠損、リストのフォールバック等の事実を
 * 上位層（KPI集計、Action生成、Teams通知等）へ通知するために使用される。
 */

export type DriftActionSeverity = 'info' | 'warn' | 'error';

export type DriftActionKind = 
  | 'fallback_success'     // 動的解決（サフィックス一致等）に成功
  | 'optional_missing'     // オプションフィールドが欠損
  | 'essential_missing'    // 必須フィールドが欠損（解決不能）
  | 'list_resolved'        // リスト名のフォールバック解決に成功
  | 'list_not_found'        // どの候補リストも見つからない
  | 'auto_heal_started'     // 自動修復開始
  | 'auto_heal_succeeded'   // 自動修復成功
  | 'auto_heal_failed'      // 自動修復失敗
  | 'auto_heal_skipped';     // 自動修復スキップ

export interface DriftActionEvent {
  /** ドメイン識別子 (例: 'daily', 'activityDiary', 'monitoringMeeting') */
  domain: string;
  
  /** 内部リストキー (例: 'DailyRecords') */
  listKey: string;
  
  /** 緊急度 */
  severity: DriftActionSeverity;
  
  /** イベントの種類 */
  kind: DriftActionKind;
  
  /** 標準名称 (例: 'recordDate') — フィールドイベントの場合 */
  canonicalField?: string;
  
  /** SP上の物理名称 (例: 'RecordDate0') — 解決成功時のみ */
  resolvedField?: string;
  
  /** ドリフトの詳細型 (例: 'fuzzy_match', 'suffix_mismatch') */
  driftType?: string;
  
  /** 詳細メッセージ */
  message: string;
  
  /** 発生時刻 (ISOString) */
  timestamp: string;
}

/** イベントハンドラの型定義 */
export type DriftEventHandler = (event: DriftActionEvent) => void;

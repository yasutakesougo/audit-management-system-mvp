/**
 * Exception Trigger Bridge Type Contract
 * 
 * 計画 (Planning) と 実績 (Daily Record) の差分から、リスクや未実施を検知するための契約。
 */

export type ExceptionCategory = 
  | 'unperformed'    // 手順の未実施・記録の未作成
  | 'deviated'       // 注意点からの逸脱、危険行動の検知
  | 'missing_focus'  // 重点観察項目の記述漏れ
  | 'stale_guidance' // 計画とガイダンスの不一致
  | 'risk_detected'; // リスク（発作、自傷等）の直接検知

export type ExceptionSeverity = 
  | 'critical' // 安全に関わる、即座に対応が必要 (Red)
  | 'warning'  // 記録漏れ、手順不備 (Orange)
  | 'info';    // 計画の古さ、品質向上 (Blue)

export interface ExceptionProvenance {
  userId: string;
  /** 出典元ガイダンス項目 ID */
  sourceGuidanceId?: string;
  /** 対象となった実績記録 ID (もしあれば) */
  sourceRecordId?: number;
  /** 検知時刻 (ISO 8601) */
  detectedAt: string;
}

/** 検知された例外 */
export interface TriggeredException {
  /** 例外 ID */
  id: string;
  /** カテゴリ */
  category: ExceptionCategory;
  /** 重要度 */
  severity: ExceptionSeverity;
  /** 例外タイトル */
  title: string;
  /** 理由（なぜ例外と判定されたか） */
  reason: string;
  /** 推奨される次の一手（現場職員への指示） */
  suggestedAction: string;
  /** 出典情報 */
  provenance: ExceptionProvenance;
  /** 解決済みフラグ */
  isResolved: boolean;
  /** 関連する計画値（期待される値） */
  expectedContent?: string;
  /** 実際の実績値（観測された値） */
  observedContent?: string;
}

/** 
 * 画面表示・通知用サマリ
 */
export interface ExceptionSummary {
  criticalCount: number;
  warningCount: number;
  totalActiveExceptions: number;
  /** 即座に実施すべき Next Action の提案リスト */
  topActionLabels: string[];
}

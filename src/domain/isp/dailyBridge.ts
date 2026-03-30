/**
 * Planning → Daily Bridge Type Contract
 * 
 * L2 (支援計画) で決定した支援方針を L0 (日次記録) の現場導線へ配備するための契約。
 */

export type DailyDeploymentType = 
  | 'procedure'     // 実施手順・手順ステップ
  | 'caution'       // 注意点・リスク・緊急対応
  | 'focus'         // 重点観察ポイント（モニタリング用）
  | 'environmental'; // 環境調整・準備事項

export interface DeploymentProvenance {
  /** 出典元計画シート ID */
  planningSheetId: string;
  /** 出典元セクション */
  sourceSection: string;
  /** 計画の承認・適用開始日 (ISO 8601) */
  effectiveDate: string;
}

/** 現場への配備（デプロイ）項目 */
export interface DailyDeploymentItem {
  /** 項目 ID */
  id: string;
  /** 分類 */
  type: DailyDeploymentType;
  /** 短い見出し（現場でパッと見て分かる内容） */
  title: string;
  /** 詳細内容（実施手順や具体的な関わり方） */
  content: string;
  /** 出典情報 */
  provenance: DeploymentProvenance;
  /** 優先度 (0.0 - 1.0) */
  priority: number;
  /** 関連する目標サマリ（なぜこれをするのか） */
  goalSummary?: string;
}

/** 
 * 現場向けガイダンス・一式
 * 特定の利用者の「今日の記録画面」に表示されるべき情報の集約。
 */
export interface DailyGuidanceBundle {
  /** 対象利用者 ID */
  userId: string;
  /** 対象日 (ISO 8601) */
  targetDate: string;
  /** 配備項目のリスト */
  items: DailyDeploymentItem[];
  /** 現場向けサマリ（Hero セクション等で表示） */
  summary: {
    cautionCount: number;
    procedureCount: number;
    focusPointCount: number;
    latestUpdateAt: string | null;
  };
}

/**
 * 外部接続用（Today Hub / Exception 検知用）
 */
export interface DailyExecutionContract {
  userId: string;
  hasCriticalCaution: boolean;
  requiredProceduresIds: string[];
  lastPlanSyncAt: string;
}

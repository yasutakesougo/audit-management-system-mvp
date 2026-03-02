// ---------------------------------------------------------------------------
// IBD Audit Evidence Report — 型定義
// 実地指導用エビデンスレポートのデータ構造
// ---------------------------------------------------------------------------
import type { PDCARecommendation } from './ibdTypes';

// ---------------------------------------------------------------------------
// SPS確定履歴テーブル行
// ---------------------------------------------------------------------------

export interface SPSHistoryRow {
  spsId: string;
  version: string;
  createdAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;        // 確定者名（表示用）
  nextReviewDueDate: string;
  daysFromConfirmation: number;      // 確定日からの経過日数
  isWithinCycle: boolean;            // 90日サイクル内か
}

// ---------------------------------------------------------------------------
// 観察ログテーブル行
// ---------------------------------------------------------------------------

export interface SupervisionLogRow {
  logId: string;
  observedAt: string;
  supervisorName: string;            // 観察者名（表示用）
  adherenceToManual: number | null;  // 手順書遵守度（1-5）
  pdcaRecommendation: PDCARecommendation | null;
  discoveredConditionsCount: number;
  suggestedUpdatesCount: number;
  notesSummary: string;              // メモの要約（100文字以内）
}

// ---------------------------------------------------------------------------
// 遵守状況サマリ
// ---------------------------------------------------------------------------

export interface ComplianceSummary {
  /** SPS 90日サイクル遵守 */
  spsReviewCycleCount: number;       // サイクル回数
  spsReviewOnTimeCount: number;      // 期限内見直し回数
  spsComplianceRate: number;         // 充足率（0-100%）

  /** 観察義務（2回に1回ルール） */
  totalSupportCount: number;         // 総支援回数
  totalObservationCount: number;     // 総観察回数
  observationRatio: number;          // 観察比率（%）
  meetsObservationRequirement: boolean;

  /** PDCA 統計 */
  averageAdherence: number | null;   // 平均遵守度
  pdcaBreakdown: Record<PDCARecommendation, number>;
  totalDiscoveredConditions: number;
  totalSuggestedUpdates: number;
}

// ---------------------------------------------------------------------------
// レポート全体
// ---------------------------------------------------------------------------

export interface AuditEvidenceReportData {
  /** 利用者情報 */
  userName: string;
  userId: number;

  /** 対象期間 */
  reportPeriod: {
    from: string;    // YYYY-MM-DD
    to: string;      // YYYY-MM-DD
  };

  /** 真正性担保 */
  generatedAt: string;     // 出力日時（ISO 8601）
  generatedBy: string;     // 作成責任者名

  /** セクション */
  spsHistory: SPSHistoryRow[];
  supervisionLogs: SupervisionLogRow[];
  complianceSummary: ComplianceSummary;
}

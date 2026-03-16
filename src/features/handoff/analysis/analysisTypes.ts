/**
 * 申し送り分析 — 型定義
 *
 * Phase 1 のすべての分析モジュールで共有される型。
 * ランタイムロジック・定数値は含まない。
 */

import type { HandoffCategory, HandoffRecord, HandoffSeverity, TimeBand } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Keyword Extraction (Phase 1-A)
// ────────────────────────────────────────────────────────────

/** 福祉ドメインのキーワードカテゴリ */
export type KeywordCategory =
  | 'health'     // 体調・医療
  | 'behavior'   // 行動面
  | 'family'     // 家族連絡
  | 'positive'   // 良かったこと
  | 'risk'       // 事故・リスク
  | 'daily'      // 日常生活
  | 'support';   // 支援技法

/** キーワード1語のヒット結果 */
export interface KeywordHit {
  /** マッチしたキーワード（正規化後） */
  keyword: string;
  /** キーワードのカテゴリ */
  category: KeywordCategory;
  /** 出現した申し送りの件数 */
  count: number;
  /** 出現した申し送りの ID リスト */
  handoffIds: number[];
  /** 関連する利用者コード一覧 */
  matchedUserCodes: string[];
  /** 最後に出現した日時 (ISO) */
  lastSeenAt: string;
}

/** extractKeywords の出力 */
export interface KeywordExtractionResult {
  /** 出現頻度降順のキーワードヒット */
  hits: KeywordHit[];
  /** カテゴリ別のヒット数 */
  byCategory: Record<KeywordCategory, number>;
  /** 分析対象の申し送り件数 */
  totalRecordsAnalyzed: number;
}

// ────────────────────────────────────────────────────────────
// User Trends (Phase 1-B, 型だけ先に定義)
// ────────────────────────────────────────────────────────────

export type TrendDirection = 'increasing' | 'stable' | 'decreasing';

export interface UserTrend {
  userCode: string;
  userDisplayName: string;
  totalMentions: number;
  topCategories: { category: HandoffCategory; count: number }[];
  topKeywords: { keyword: string; count: number }[];
  severityDistribution: Record<HandoffSeverity, number>;
  recentTrend: TrendDirection;
}

// ────────────────────────────────────────────────────────────
// Time Patterns (Phase 1-C, 型だけ先に定義)
// ────────────────────────────────────────────────────────────

export interface TimePattern {
  timeBand: TimeBand;
  dayOfWeek: number; // 0=日, 1=月, ..., 6=土
  avgCount: number;
  topCategory: HandoffCategory;
}

// ────────────────────────────────────────────────────────────
// Re-export convenience
// ────────────────────────────────────────────────────────────

export type { HandoffCategory, HandoffRecord, HandoffSeverity, TimeBand };

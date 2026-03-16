/**
 * @fileoverview Metrics Thresholds — 運用指標のしきい値定義
 * @description
 * Ops Dashboard の各カードで使うステータス判定しきい値を
 * 1 ファイルに集約する。運用フェーズでの調整を容易にする。
 *
 * 各カードはここの定数を import して status を決定する。
 * しきい値を変えるだけで全カードの色が変わる。
 *
 * @see docs/ops/metrics-framework.md
 */

// ─── Proposal Adoption ──────────────────────────────────

export const PROPOSAL_ADOPTION = {
  /** 採用率がこれ以上なら good（緑） */
  GOOD_THRESHOLD: 50,
  /** 採用率がこれ以上なら warning（黄）、未満なら critical（赤） */
  WARNING_THRESHOLD: 30,
} as const;

// ─── PDCA Cycle Speed ───────────────────────────────────

export const CYCLE_SPEED = {
  /** 中央所要日数がこれ以下なら good */
  GOOD_MAX_DAYS: 60,
  /** 中央所要日数がこれ以下なら warning、超えたら critical */
  WARNING_MAX_DAYS: 90,
} as const;

// ─── PDCA Stalled Detection ─────────────────────────────

export const STALLED_DETECTION = {
  /** 提案採用後、見直し未完了でこの日数を超えたら stalled */
  STALLED_THRESHOLD_DAYS: 14,
} as const;

// ─── Knowledge Growth ───────────────────────────────────

export const KNOWLEDGE_GROWTH = {
  /** 成功パターン数がこれ以上なら good */
  GOOD_PROVEN_PATTERNS: 3,
  /** 成功パターン定義: 採用率しきい値 (%) */
  PROVEN_ACCEPTANCE_RATE: 60,
  /** 成功パターン定義: 最低出現回数 */
  PROVEN_MIN_OCCURRENCES: 3,
} as const;

// ─── Alert Severity ─────────────────────────────────────

export const ALERT_SEVERITY = {
  /** アラート表示の最大件数（デフォルト） */
  DEFAULT_MAX_ALERTS: 5,
  /** 超過日数がこれ以上なら severe */
  SEVERE_OVERDUE_DAYS: 30,
} as const;

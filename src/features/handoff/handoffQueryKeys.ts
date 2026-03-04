/**
 * Handoff Query Key Factory
 *
 * TanStack Query のキャッシュ無効化を予測可能にするための
 * 階層化された Query Key 定義。
 *
 * 公式推奨パターン:
 * @see https://tanstack.com/query/latest/docs/react/community/lukemorales-query-key-factory
 *
 * 設計方針:
 * - 全キーは `handoffKeys.all` をプレフィックスに持つ
 * - `invalidateQueries({ queryKey: handoffKeys.all })` で全handoff関連キャッシュを一括無効化
 * - 個別無効化も可能（例: summary のみ、timeline のみ）
 */

import type { HandoffDayScope, HandoffTimeFilter } from './handoffTypes';

// ────────────────────────────────────────────────────────────
// Handoff Query Keys
// ────────────────────────────────────────────────────────────

export const handoffKeys = {
  /** 全 handoff 関連クエリの共通プレフィックス */
  all: ['handoff'] as const,

  // ── Timeline (一覧) ──

  /** タイムライン一覧の基底キー */
  timelines: () => [...handoffKeys.all, 'timeline'] as const,

  /** 特定条件のタイムライン一覧 */
  timeline: (scope: HandoffDayScope, timeFilter: HandoffTimeFilter = 'all') =>
    [...handoffKeys.timelines(), scope, timeFilter] as const,

  // ── Summary (サマリー / KPI) ──

  /** サマリーの基底キー */
  summaries: () => [...handoffKeys.all, 'summary'] as const,

  /** 特定日付スコープのサマリー */
  summary: (scope: HandoffDayScope) =>
    [...handoffKeys.summaries(), scope] as const,

  // ── Detail (個別詳細) ──

  /** 詳細の基底キー */
  details: () => [...handoffKeys.all, 'detail'] as const,

  /** 特定IDの詳細 */
  detail: (id: number) =>
    [...handoffKeys.details(), id] as const,

  // ── Comments (コメント) ──

  /** コメントの基底キー */
  comments: () => [...handoffKeys.all, 'comments'] as const,

  /** 特定申し送りのコメント一覧 */
  commentsByHandoff: (handoffId: number) =>
    [...handoffKeys.comments(), handoffId] as const,

  // ── Statistics (統計) ──

  /** 統計の基底キー */
  stats: () => [...handoffKeys.all, 'stats'] as const,

  /** 特定日付スコープの統計 */
  statsByScope: (scope: HandoffDayScope) =>
    [...handoffKeys.stats(), scope] as const,
} as const;

// ────────────────────────────────────────────────────────────
// 型エクスポート (IDE補完用)
// ────────────────────────────────────────────────────────────

/** Query Key の型 (invalidateQueries のフィルタに使用可能) */
type HandoffKeyFns = {
  [K in keyof typeof handoffKeys]: (typeof handoffKeys)[K] extends (...args: never[]) => infer R ? R : (typeof handoffKeys)[K];
};
export type HandoffQueryKey = HandoffKeyFns[keyof HandoffKeyFns];

/**
 * @fileoverview Adoption Metrics — 提案採用率の集計ロジック（pure function）
 * @description
 * Issue #11: Suggestion / Candidate Adoption Metrics
 *
 * acceptedSuggestions[] の accept / dismiss を集計し、
 * 運用定着を測る指標を返す。
 *
 * Phase 1 の分母は「操作済み提案」(accept + dismiss)。
 * 表示ログがない現段階では、操作されたもののみを計上する。
 *
 * 原則:
 * - pure function のみ（副作用なし）
 * - ゼロ除算安全
 * - ruleId prefix でグルーピング
 * - ISP 反映判定は既存のメタ印照合を再利用
 */

// contract:allow-interface — domain-specific aggregate types co-located with logic
import type { SuggestionAction } from './suggestionAction';
import { isAlreadyInImprovementIdeas } from './ispCandidateMapper';

// ─── 型定義 ──────────────────────────────────────────────

/** 集計期間 */
export type MetricsPeriod = {
  startDate: string;
  endDate: string;
};

/** ルール別集計 */
export type RuleMetrics = {
  /** ruleId prefix (e.g. 'highCoOccurrence', 'slotBias') */
  rulePrefix: string;
  /** 人が読めるラベル */
  label: string;
  /** accept 数 */
  acceptCount: number;
  /** dismiss 数 */
  dismissCount: number;
  /** accept率 (0-100, 小数1桁) */
  acceptRate: number;
};

/** 全体集計result */
export type AdoptionMetrics = {
  /** 集計期間 */
  period: MetricsPeriod;
  /** 操作済み提案数 (accept + dismiss) */
  actionedCount: number;
  /** accept 数 */
  acceptCount: number;
  /** dismiss 数 */
  dismissCount: number;
  /** 採用率: accept / (accept + dismiss), 0-100 */
  acceptRate: number;
  /** 却下率: dismiss / (accept + dismiss), 0-100 */
  dismissRate: number;
  /** ISP 候補反映数 */
  ispImportCount: number;
  /** ISP 候補反映率: ispImportCount / acceptCount, 0-100 */
  ispImportRate: number;
  /** ルール別集計（acceptRate 降順） */
  byRule: RuleMetrics[];
};

// ─── 定数 ────────────────────────────────────────────────

/** ruleId prefix → 表示ラベル */
const RULE_PREFIX_LABELS: Record<string, string> = {
  highCoOccurrence: '高併発率',
  slotBias: '時間帯偏り',
  tagDensityGap: 'タグ密度差',
  positiveSignal: 'ポジティブ兆候',
};

const DEFAULT_RULE_LABEL = 'その他';

// ─── ユーティリティ ──────────────────────────────────────

/**
 * ruleId からグルーピング用の prefix を抽出する。
 *
 * @example
 * extractRulePrefix('highCoOccurrence:panic') // → 'highCoOccurrence'
 * extractRulePrefix('slotBias')               // → 'slotBias'
 * extractRulePrefix('tagDensityGap')          // → 'tagDensityGap'
 */
export function extractRulePrefix(ruleId: string): string {
  return ruleId.split(':')[0];
}

/**
 * ruleId prefix から人が読めるラベルを返す。
 */
export function getRulePrefixLabel(prefix: string): string {
  return RULE_PREFIX_LABELS[prefix] ?? DEFAULT_RULE_LABEL;
}

/**
 * ゼロ除算安全な割合計算。小数1桁で返す。
 */
export function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// ─── ISP 反映数カウント ──────────────────────────────────

/**
 * accept 済みアクションのうち、improvementIdeas に反映済みの件数を返す。
 *
 * @param acceptedActions - accept のみの SuggestionAction[]
 * @param improvementIdeas - 対象ユーザーの improvementIdeas テキスト
 */
export function countISPImports(
  acceptedActions: SuggestionAction[],
  improvementIdeas: string,
): number {
  // 一意なメタ印で重複カウントを防止
  const seen = new Set<string>();
  let count = 0;

  for (const a of acceptedActions) {
    const key = `${a.ruleId}::${a.userId}`;
    if (seen.has(key)) continue;

    if (isAlreadyInImprovementIdeas(improvementIdeas, a.ruleId, a.userId)) {
      count++;
      seen.add(key);
    }
  }

  return count;
}

// ─── メイン集計関数 ──────────────────────────────────────

/**
 * acceptedSuggestions 配列から Adoption Metrics を計算する。
 *
 * @param allActions - 全アクション（accept + dismiss）
 * @param period - 集計期間
 * @param improvementIdeas - ISP反映判定用のテキスト（省略時は反映率0）
 */
export function computeAdoptionMetrics(
  allActions: SuggestionAction[],
  period: MetricsPeriod,
  improvementIdeas: string = '',
): AdoptionMetrics {
  const acceptActions = allActions.filter(a => a.action === 'accept');
  const dismissActions = allActions.filter(a => a.action === 'dismiss');

  const acceptCount = acceptActions.length;
  const dismissCount = dismissActions.length;
  const actionedCount = acceptCount + dismissCount;

  const acceptRate = safeRate(acceptCount, actionedCount);
  const dismissRate = safeRate(dismissCount, actionedCount);

  // ISP 反映数
  const ispImportCount = countISPImports(acceptActions, improvementIdeas);
  const ispImportRate = safeRate(ispImportCount, acceptCount);

  // ルール別集計
  const byRule = computeByRule(allActions);

  return {
    period,
    actionedCount,
    acceptCount,
    dismissCount,
    acceptRate,
    dismissRate,
    ispImportCount,
    ispImportRate,
    byRule,
  };
}

// ─── ルール別集計 ────────────────────────────────────────

function computeByRule(allActions: SuggestionAction[]): RuleMetrics[] {
  // prefix でグルーピング
  const groups = new Map<string, { accept: number; dismiss: number }>();

  for (const a of allActions) {
    const prefix = extractRulePrefix(a.ruleId);
    const current = groups.get(prefix) ?? { accept: 0, dismiss: 0 };

    if (a.action === 'accept') {
      current.accept++;
    } else if (a.action === 'dismiss') {
      current.dismiss++;
    }

    groups.set(prefix, current);
  }

  // RuleMetrics[] に変換し、acceptRate 降順で返す
  return Array.from(groups.entries())
    .map(([prefix, counts]): RuleMetrics => ({
      rulePrefix: prefix,
      label: getRulePrefixLabel(prefix),
      acceptCount: counts.accept,
      dismissCount: counts.dismiss,
      acceptRate: safeRate(counts.accept, counts.accept + counts.dismiss),
    }))
    .sort((a, b) => b.acceptRate - a.acceptRate);
}

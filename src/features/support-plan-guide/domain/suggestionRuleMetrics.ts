/**
 * suggestionRuleMetrics — ルール別の提案品質メトリクス（純粋関数）
 *
 * P3-F: 永続化された判断レコードと提案候補を突き合わせ、
 * どのデータソース／ルールの提案が効いているかを集計する。
 *
 * 設計:
 *  - GoalSuggestion.provenance[0] のプレフィックスを ruleKey として分類
 *  - SuggestionDecisionRecord の最新判断を suggestionId で結合
 *  - ルールごとの採用率・見送り率を算出
 */

import type { SuggestionDecisionRecord } from '../types';
import type { GoalSuggestion } from './suggestedGoals';
import { getLatestDecisionMap } from './suggestionDecisionHelpers';

// ────────────────────────────────────────────
// ルール分類
// ────────────────────────────────────────────

/**
 * ルールキー — 提案のデータソース分類。
 * provenance[0] のプレフィックスから判定する。
 */
export type RuleKey =
  | 'assessment'
  | 'iceberg'
  | 'monitoring'
  | 'form'
  | 'unknown';

/** RuleKey の日本語ラベル */
export const RULE_LABELS: Record<RuleKey, string> = {
  assessment: 'アセスメント',
  iceberg: 'Iceberg分析',
  monitoring: 'モニタリング',
  form: 'フォーム入力',
  unknown: 'その他',
};

/**
 * provenance[0] からルールキーを判定する。
 *
 * suggestedGoals.ts の生成ルールに対応:
 *  - "アセスメント: ..."  → assessment
 *  - "Iceberg: ..."       → iceberg
 *  - "モニタリング: ..."  → monitoring
 *  - "改善メモ"           → monitoring（モニタリング系）
 *  - "フォーム: ..."      → form
 */
export function classifyProvenance(provenance: string[]): RuleKey {
  if (provenance.length === 0) return 'unknown';
  const first = provenance[0];

  if (first.startsWith('アセスメント')) return 'assessment';
  if (first.startsWith('Iceberg')) return 'iceberg';
  if (first.startsWith('モニタリング') || first === '改善メモ') return 'monitoring';
  if (first.startsWith('フォーム')) return 'form';

  return 'unknown';
}

// ────────────────────────────────────────────
// メトリクス型
// ────────────────────────────────────────────

/** 1つのルールの評価メトリクス */
export type RuleMetrics = {
  /** ルールキー */
  ruleKey: RuleKey;
  /** このルールから生成された提案数 */
  generated: number;
  /** 判断済みの提案数 */
  decided: number;
  /** 採用された数 */
  accepted: number;
  /** 見送りされた数 */
  dismissed: number;
  /** メモ化された数（noted + deferred + promoted） */
  memoized: number;
  /** 昇格された数 */
  promoted: number;
  /** 未判断の数 */
  pending: number;
  /** 採用率: accepted / (accepted + dismissed)。分母0なら 0 */
  acceptanceRate: number;
  /** 有効率: (accepted + promoted) / decided。分母0なら 0 */
  effectivenessRate: number;
};

/** ルール別メトリクスの全体結果 */
export type SuggestionRuleMetricsResult = {
  /** ルールキーごとの集計 */
  byRule: Map<RuleKey, RuleMetrics>;
  /** ルールキー順のリスト（generated > 0 のみ、有効率降順） */
  ranked: RuleMetrics[];
  /** 最も採用率が高いルール（null = データなし） */
  bestRule: RuleKey | null;
  /** 最もノイズが多いルール（dismissed が最大、null = データなし） */
  noisyRule: RuleKey | null;
};

// ────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function emptyRuleMetrics(ruleKey: RuleKey): RuleMetrics {
  return {
    ruleKey,
    generated: 0,
    decided: 0,
    accepted: 0,
    dismissed: 0,
    memoized: 0,
    promoted: 0,
    pending: 0,
    acceptanceRate: 0,
    effectivenessRate: 0,
  };
}

// ────────────────────────────────────────────
// メイン集計関数
// ────────────────────────────────────────────

/**
 * 提案候補と判断レコードを突き合わせてルール別メトリクスを算出する。
 *
 * 1. 各 suggestion を provenance から ruleKey に分類
 * 2. 判断レコードの最新状態を id で結合
 * 3. ルールごとの採用率・有効率を算出
 * 4. ranked を有効率降順で返す
 */
export function computeSuggestionRuleMetrics(
  suggestions: GoalSuggestion[],
  decisions: SuggestionDecisionRecord[],
): SuggestionRuleMetricsResult {
  const latestDecisions = getLatestDecisionMap(decisions);
  const rulesMap = new Map<RuleKey, RuleMetrics>();

  // ── 1. suggestion を ruleKey でグルーピング ──
  for (const suggestion of suggestions) {
    const ruleKey = classifyProvenance(suggestion.provenance);

    if (!rulesMap.has(ruleKey)) {
      rulesMap.set(ruleKey, emptyRuleMetrics(ruleKey));
    }
    const rule = rulesMap.get(ruleKey)!;
    rule.generated++;

    // ── 2. 判断結合 ──
    const decision = latestDecisions.get(suggestion.id);
    if (decision) {
      rule.decided++;
      switch (decision.action) {
        case 'accepted':
          rule.accepted++;
          break;
        case 'dismissed':
          rule.dismissed++;
          break;
        case 'noted':
        case 'deferred':
          rule.memoized++;
          break;
        case 'promoted':
          rule.promoted++;
          rule.memoized++; // promoted はメモ化の成功的帰結
          break;
      }
    } else {
      rule.pending++;
    }
  }

  // ── 3. 率の算出 ──
  for (const rule of rulesMap.values()) {
    rule.acceptanceRate = safeRate(rule.accepted, rule.accepted + rule.dismissed);
    rule.effectivenessRate = safeRate(rule.accepted + rule.promoted, rule.decided);
  }

  // ── 4. ランキング（有効率降順 → 生成数降順） ──
  const ranked = [...rulesMap.values()]
    .filter((r) => r.generated > 0)
    .sort((a, b) => {
      if (b.effectivenessRate !== a.effectivenessRate) {
        return b.effectivenessRate - a.effectivenessRate;
      }
      return b.generated - a.generated;
    });

  // ── 5. best / noisy ──
  let bestRule: RuleKey | null = null;
  let noisyRule: RuleKey | null = null;

  if (ranked.length > 0) {
    // 判断が1件以上あるルールの中で最高採用率
    const decidedRules = ranked.filter((r) => r.decided > 0);
    if (decidedRules.length > 0) {
      bestRule = decidedRules.reduce((best, cur) =>
        cur.acceptanceRate > best.acceptanceRate ? cur : best,
      ).ruleKey;

      noisyRule = decidedRules.reduce((worst, cur) =>
        cur.dismissed > worst.dismissed ? cur : worst,
      ).ruleKey;
      // noisy は dismissed > 0 の場合のみ
      const noisyMetrics = rulesMap.get(noisyRule);
      if (!noisyMetrics || noisyMetrics.dismissed === 0) {
        noisyRule = null;
      }
    }
  }

  return {
    byRule: rulesMap,
    ranked,
    bestRule,
    noisyRule,
  };
}

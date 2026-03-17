/**
 * plannerInsights — Planner Assist 集約関数（純粋関数）
 *
 * P5-B: 既存 Layer 2-5 の出力を集約して、planner が最初に見るべき
 * 「次の行動」を返す。Analytics レイヤーの延長に位置する集約関数。
 *
 * 設計原則:
 *  - pure only（React 非依存）
 *  - 0件アクションは返さない
 *  - actions は severity desc → count desc 順
 *  - date が必要なら引数で now を受ける（将来拡張用）
 */

import type { GoalSuggestion } from './suggestedGoals';
import type { SuggestionDecisionRecord } from '../types';
import type { RegulatoryHudItem } from './regulatoryHud';
import { getLatestDecisionMap } from './suggestionDecisionHelpers';

// ────────────────────────────────────────────
// 出力型
// ────────────────────────────────────────────

export type PlannerInsightActionKey =
  | 'pendingSuggestions'
  | 'promotionCandidates'
  | 'missingGoals'
  | 'regulatoryIssues';

export type PlannerInsightSeverity = 'info' | 'warning' | 'danger';

export type PlannerInsightItem = {
  /** アクション種別 */
  key: PlannerInsightActionKey;
  /** 表示ラベル */
  label: string;
  /** 該当件数 */
  count: number;
  /** 深刻度 */
  severity: PlannerInsightSeverity;
  /** 遷移先タブ（SectionKey） */
  tab: string;
  /** 補足説明 */
  description?: string;
};

export type PlannerInsights = {
  actions: PlannerInsightItem[];
  summary: {
    totalOpenActions: number;
    /** SmartTab 採用率。判断データなしなら undefined */
    weeklyAcceptanceRate?: number;
  };
};

// ────────────────────────────────────────────
// 入力型
// ────────────────────────────────────────────

/** 目標の最小構造（GoalItem の必要部分のみ） */
export type PlannerGoalInput = {
  id: string;
  type: string;
  /** GoalItem.label に対応（表示テキスト） */
  label: string;
  domains: string[];
};

export type PlannerInsightsInput = {
  /** 生成された提案一覧 */
  suggestions: GoalSuggestion[];
  /** 判断レコード（append-only） */
  decisions: SuggestionDecisionRecord[];
  /** 現在の目標一覧 */
  goals: PlannerGoalInput[];
  /** 制度チェック HUD 項目 */
  regulatoryItems: RegulatoryHudItem[];
};

// ────────────────────────────────────────────
// severity 重み（ソート用）
// ────────────────────────────────────────────

const SEVERITY_ORDER: Record<PlannerInsightSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

// ────────────────────────────────────────────
// 内部ヘルパー
// ────────────────────────────────────────────

/**
 * 未判断の提案数を算出する。
 * 判断済み（getLatestDecisionMap にある）提案を除外。
 */
function countPendingSuggestions(
  suggestions: GoalSuggestion[],
  decisions: SuggestionDecisionRecord[],
): number {
  if (suggestions.length === 0) return 0;
  const latestMap = getLatestDecisionMap(decisions);
  let count = 0;
  for (const s of suggestions) {
    if (!latestMap.has(s.id)) {
      count++;
    }
  }
  return count;
}

/**
 * 昇格候補数を算出する。
 * memo source の最新判断が noted / deferred のもの。
 */
function countPromotionCandidates(
  decisions: SuggestionDecisionRecord[],
): number {
  const latestMap = getLatestDecisionMap(decisions);
  let count = 0;
  for (const record of latestMap.values()) {
    if (
      record.source === 'memo' &&
      (record.action === 'noted' || record.action === 'deferred')
    ) {
      count++;
    }
  }
  return count;
}

/**
 * 目標未設定かどうか (0件なら 1, それ以外は 0)
 */
function countMissingGoals(goals: PlannerGoalInput[]): number {
  return goals.length === 0 ? 1 : 0;
}

/**
 * warning / danger の制度要件項目数を返す。
 */
function countRegulatoryIssues(items: RegulatoryHudItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.signal === 'warning' || item.signal === 'danger') {
      count++;
    }
  }
  return count;
}

/**
 * SmartTab 採用率を算出する。
 * accepted / (accepted + dismissed)。判断なしなら undefined。
 */
function computeAcceptanceRate(
  decisions: SuggestionDecisionRecord[],
): number | undefined {
  const latestMap = getLatestDecisionMap(decisions);
  let accepted = 0;
  let dismissed = 0;

  for (const record of latestMap.values()) {
    if (record.source === 'smart') {
      if (record.action === 'accepted') accepted++;
      else if (record.action === 'dismissed') dismissed++;
    }
  }

  const denominator = accepted + dismissed;
  if (denominator === 0) return undefined;
  return accepted / denominator;
}

/**
 * アクション配列をソートする (severity desc → count desc)
 */
function sortActions(actions: PlannerInsightItem[]): PlannerInsightItem[] {
  return [...actions].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.count - a.count; // count 降順
  });
}

// ────────────────────────────────────────────
// メイン集約関数
// ────────────────────────────────────────────

/**
 * 既存 Layer 2-5 の出力を集約し、planner が次に取るべき行動を返す。
 *
 * 0件のアクションは除外され、結果は severity desc → count desc 順。
 *
 * @param input - 各レイヤーからの集約入力
 * @returns PlannerInsights - アクション一覧とサマリ
 */
export function computePlannerInsights(
  input: PlannerInsightsInput,
): PlannerInsights {
  const rawActions: PlannerInsightItem[] = [];

  // 1. 未判断提案
  const pendingCount = countPendingSuggestions(input.suggestions, input.decisions);
  if (pendingCount > 0) {
    rawActions.push({
      key: 'pendingSuggestions',
      label: '未判断の提案',
      count: pendingCount,
      severity: 'info',
      tab: 'smart',
      description: `${pendingCount}件の提案が判断待ちです`,
    });
  }

  // 2. 昇格候補
  const promoCount = countPromotionCandidates(input.decisions);
  if (promoCount > 0) {
    rawActions.push({
      key: 'promotionCandidates',
      label: '昇格候補メモ',
      count: promoCount,
      severity: 'info',
      tab: 'excellence',
      description: `${promoCount}件のメモが目標候補として検討可能です`,
    });
  }

  // 3. 未設定目標
  const missingCount = countMissingGoals(input.goals);
  if (missingCount > 0) {
    rawActions.push({
      key: 'missingGoals',
      label: '目標未設定',
      count: missingCount,
      severity: 'warning',
      tab: 'smart',
      description: '支援目標がまだ設定されていません',
    });
  }

  // 4. 制度要件漏れ
  const regulatoryCount = countRegulatoryIssues(input.regulatoryItems);
  if (regulatoryCount > 0) {
    rawActions.push({
      key: 'regulatoryIssues',
      label: '制度要件の警告',
      count: regulatoryCount,
      severity: 'danger',
      tab: 'compliance',
      description: `${regulatoryCount}件の制度要件に対応が必要です`,
    });
  }

  // ソートとサマリ
  const actions = sortActions(rawActions);
  const totalOpenActions = actions.reduce((sum, a) => sum + a.count, 0);
  const weeklyAcceptanceRate = computeAcceptanceRate(input.decisions);

  return {
    actions,
    summary: {
      totalOpenActions,
      ...(weeklyAcceptanceRate !== undefined ? { weeklyAcceptanceRate } : {}),
    },
  };
}

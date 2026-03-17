/**
 * usePlannerInsights — Planner Assist のデータ解決 hook (P5-A)
 *
 * computePlannerInsights() を呼ぶために必要なデータを
 * 既存 hook から集め、memoized で返す Thin Orchestrator。
 *
 * 責務:
 *  - buildSuggestedGoals で提案候補を生成
 *  - buildRegulatoryHudItems で制度 HUD 項目を生成
 *  - form.goals / currentDecisions と合わせて computePlannerInsights を呼ぶ
 *
 * 新ロジック: なし。既存 pure 関数の組み合わせのみ。
 */

import { useMemo } from 'react';
import type { SupportPlanBundle } from '@/domain/isp/schema';
import type { SupportPlanForm, SuggestionDecisionRecord } from '../types';
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import { computePlannerInsights, type PlannerInsights } from '../domain/plannerInsights';
import { buildSuggestedGoals } from '../domain/suggestedGoals';
import { toSuggestedGoalsInput } from '../domain/suggestedGoalsAdapter';
import { buildRegulatoryHudItems, type RegulatoryHudInput } from '../domain/regulatoryHud';

// ────────────────────────────────────────────
// Hook 入力
// ────────────────────────────────────────────

export type UsePlannerInsightsInput = {
  bundle: SupportPlanBundle | null;
  form: SupportPlanForm;
  goals: GoalItem[];
  decisions: SuggestionDecisionRecord[];
  /** 制度 HUD 構築用の追加入力（useRegulatorySummary と同じソースから） */
  regulatoryInput: RegulatoryHudInput | null;
};

// ────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────

export function usePlannerInsights(
  input: UsePlannerInsightsInput,
): PlannerInsights {
  const { bundle, form, goals, decisions, regulatoryInput } = input;

  return useMemo(() => {
    // 提案候補を生成（SmartTab と同じパス）
    const suggestions = bundle
      ? buildSuggestedGoals(toSuggestedGoalsInput(bundle, form))
      : [];

    // 制度 HUD 項目を生成
    const regulatoryItems = regulatoryInput
      ? buildRegulatoryHudItems(regulatoryInput)
      : [];

    return computePlannerInsights({
      suggestions,
      decisions,
      goals,
      regulatoryItems,
    });
  }, [bundle, form, goals, decisions, regulatoryInput]);
}

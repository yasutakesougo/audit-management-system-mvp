/**
 * useSuggestedGoals — 目標候補の生成 + 採用/見送り状態管理
 *
 * P3-B: UI 統合用 hook。
 *
 * 責務:
 *  - buildSuggestedGoals を呼び出して候補を生成
 *  - 各候補の decision 状態（pending / accepted / dismissed）を管理
 *  - accept 時に GoalItem への変換を提供
 *  - 採用率メトリクスを算出
 */

import { useMemo, useCallback, useState } from 'react';
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { SupportPlanBundle } from '@/domain/isp/schema';
import type { SupportPlanForm } from '../types';
import {
  buildSuggestedGoals,
  suggestionToGoalItem,
  type GoalSuggestion,
} from '../domain/suggestedGoals';
import { toSuggestedGoalsInput } from '../domain/suggestedGoalsAdapter';

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

export type SuggestedGoalDecision = 'pending' | 'accepted' | 'dismissed';

export type SuggestedGoalWithDecision = GoalSuggestion & {
  decision: SuggestedGoalDecision;
};

export type SuggestedGoalsMetrics = {
  total: number;
  pending: number;
  accepted: number;
  dismissed: number;
  acceptRate: number; // 0-1, NaN if total === 0
};

export type UseSuggestedGoalsReturn = {
  /** 全候補（decision 付き） */
  suggestions: SuggestedGoalWithDecision[];
  /** pending のみ */
  pendingSuggestions: SuggestedGoalWithDecision[];
  /** 候補を「採用」→ GoalItem を返す */
  accept: (id: string) => GoalItem | null;
  /** 候補を「見送り」 */
  dismiss: (id: string) => void;
  /** 候補を「保留に戻す」 */
  undoDecision: (id: string) => void;
  /** メトリクス */
  metrics: SuggestedGoalsMetrics;
  /** 候補があるか */
  hasSuggestions: boolean;
};

// ────────────────────────────────────────────
// Hook 実装
// ────────────────────────────────────────────

export function useSuggestedGoals(
  bundle: SupportPlanBundle | null,
  form: SupportPlanForm,
): UseSuggestedGoalsReturn {
  // decision 状態（id → decision）
  const [decisions, setDecisions] = useState<Record<string, SuggestedGoalDecision>>({});

  // 候補生成（bundle / form が変わるたびに再計算）
  const rawSuggestions = useMemo<GoalSuggestion[]>(() => {
    if (!bundle) return [];
    const input = toSuggestedGoalsInput(bundle, form);
    return buildSuggestedGoals(input);
  }, [bundle, form]);

  // decision を付与
  const suggestions = useMemo<SuggestedGoalWithDecision[]>(
    () =>
      rawSuggestions.map((s) => ({
        ...s,
        decision: decisions[s.id] ?? 'pending',
      })),
    [rawSuggestions, decisions],
  );

  const pendingSuggestions = useMemo(
    () => suggestions.filter((s) => s.decision === 'pending'),
    [suggestions],
  );

  // メトリクス
  const metrics = useMemo<SuggestedGoalsMetrics>(() => {
    const total = suggestions.length;
    const accepted = suggestions.filter((s) => s.decision === 'accepted').length;
    const dismissed = suggestions.filter((s) => s.decision === 'dismissed').length;
    const pending = suggestions.filter((s) => s.decision === 'pending').length;
    const decided = accepted + dismissed;
    return {
      total,
      pending,
      accepted,
      dismissed,
      acceptRate: decided > 0 ? accepted / decided : 0,
    };
  }, [suggestions]);

  // ── アクション ──

  const accept = useCallback(
    (id: string): GoalItem | null => {
      const suggestion = rawSuggestions.find((s) => s.id === id);
      if (!suggestion) return null;
      setDecisions((prev) => ({ ...prev, [id]: 'accepted' }));
      return suggestionToGoalItem(suggestion);
    },
    [rawSuggestions],
  );

  const dismiss = useCallback((id: string) => {
    setDecisions((prev) => ({ ...prev, [id]: 'dismissed' }));
  }, []);

  const undoDecision = useCallback((id: string) => {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return {
    suggestions,
    pendingSuggestions,
    accept,
    dismiss,
    undoDecision,
    metrics,
    hasSuggestions: rawSuggestions.length > 0,
  };
}

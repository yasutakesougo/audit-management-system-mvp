/**
 * useSuggestionMemo — 改善メモ向け提案候補の状態管理
 *
 * P3-C: ExcellenceTab（改善メモ）に配置する提案候補の管理 hook。
 *
 * 責務:
 *  - SmartTab の useSuggestedGoals とは独立して候補を生成
 *  - 各候補の memo 状態（pending / noted / deferred / promoted）を管理
 *  - noted: improvementIdeas テキストに追記済み
 *  - deferred: あとで検討（保留）
 *  - promoted: 目標に昇格（SmartTab へ移送）
 *
 * 設計原則:
 *  - SmartTab と改善メモは独立した判断の場
 *  - SmartTab: 「この候補を目標に採用するか」の yes/no
 *  - 改善メモ: 「この候補をどう活用するか」の作業台
 */

import { useMemo, useCallback, useState } from 'react';
import type { SupportPlanBundle } from '@/domain/isp/schema';
import type { SupportPlanForm } from '../types';
import {
  buildSuggestedGoals,
  type GoalSuggestion,
} from '../domain/suggestedGoals';
import { toSuggestedGoalsInput } from '../domain/suggestedGoalsAdapter';

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

/** 改善メモでの提案アクション状態 */
export type SuggestionMemoAction = 'pending' | 'noted' | 'deferred' | 'promoted';

/** 候補 + メモアクション状態 */
export type SuggestionWithMemoAction = GoalSuggestion & {
  memoAction: SuggestionMemoAction;
};

/** メトリクス */
export type SuggestionMemoMetrics = {
  total: number;
  pending: number;
  noted: number;
  deferred: number;
  promoted: number;
};

/** Hook の戻り値 */
export type UseSuggestionMemoReturn = {
  /** 全候補（memoAction 付き） */
  suggestions: SuggestionWithMemoAction[];
  /** pending のみ */
  pendingSuggestions: SuggestionWithMemoAction[];
  /** deferred のみ（あとで検討） */
  deferredSuggestions: SuggestionWithMemoAction[];
  /** 「メモに追記」 — improvementIdeas へテキストを追加する情報を返す */
  noteToMemo: (id: string) => string | null;
  /** 「あとで検討」 */
  defer: (id: string) => void;
  /** 「目標に昇格」— GoalSuggestion を返す */
  promote: (id: string) => GoalSuggestion | null;
  /** 「保留に戻す」 */
  undoAction: (id: string) => void;
  /** メトリクス */
  metrics: SuggestionMemoMetrics;
  /** 候補があるか */
  hasSuggestions: boolean;
};

// ────────────────────────────────────────────
// テキスト生成
// ────────────────────────────────────────────

/**
 * GoalSuggestion → 改善メモ追記テキスト
 *
 * フォーマット:
 * ```
 * 【提案】{title}
 * 根拠: {rationale}
 * 推奨支援: {supports}
 * 出典: {provenance}
 * ```
 */
export function formatSuggestionForMemo(suggestion: GoalSuggestion): string {
  const lines: string[] = [
    `【提案】${suggestion.title}`,
    `根拠: ${suggestion.rationale}`,
  ];
  if (suggestion.suggestedSupports.length > 0) {
    lines.push(`推奨支援: ${suggestion.suggestedSupports.join('、')}`);
  }
  if (suggestion.provenance.length > 0) {
    lines.push(`出典: ${suggestion.provenance.join('、')}`);
  }
  return lines.join('\n');
}

// ────────────────────────────────────────────
// Hook 実装
// ────────────────────────────────────────────

export function useSuggestionMemo(
  bundle: SupportPlanBundle | null,
  form: SupportPlanForm,
): UseSuggestionMemoReturn {
  // memo action 状態（id → action）
  const [actions, setActions] = useState<Record<string, SuggestionMemoAction>>({});

  // 候補生成（SmartTab と同じ builder を使うが、状態は独立）
  const rawSuggestions = useMemo<GoalSuggestion[]>(() => {
    if (!bundle) return [];
    const input = toSuggestedGoalsInput(bundle, form);
    return buildSuggestedGoals(input);
  }, [bundle, form]);

  // memoAction を付与
  const suggestions = useMemo<SuggestionWithMemoAction[]>(
    () =>
      rawSuggestions.map((s) => ({
        ...s,
        memoAction: actions[s.id] ?? 'pending',
      })),
    [rawSuggestions, actions],
  );

  const pendingSuggestions = useMemo(
    () => suggestions.filter((s) => s.memoAction === 'pending'),
    [suggestions],
  );

  const deferredSuggestions = useMemo(
    () => suggestions.filter((s) => s.memoAction === 'deferred'),
    [suggestions],
  );

  // メトリクス
  const metrics = useMemo<SuggestionMemoMetrics>(() => {
    const total = suggestions.length;
    const noted = suggestions.filter((s) => s.memoAction === 'noted').length;
    const deferred = suggestions.filter((s) => s.memoAction === 'deferred').length;
    const promoted = suggestions.filter((s) => s.memoAction === 'promoted').length;
    const pending = suggestions.filter((s) => s.memoAction === 'pending').length;
    return { total, pending, noted, deferred, promoted };
  }, [suggestions]);

  // ── アクション ──

  /** 「メモに追記」— テキストを生成して返し、状態を noted に */
  const noteToMemo = useCallback(
    (id: string): string | null => {
      const suggestion = rawSuggestions.find((s) => s.id === id);
      if (!suggestion) return null;
      setActions((prev) => ({ ...prev, [id]: 'noted' }));
      return formatSuggestionForMemo(suggestion);
    },
    [rawSuggestions],
  );

  /** 「あとで検討」 */
  const defer = useCallback((id: string) => {
    setActions((prev) => ({ ...prev, [id]: 'deferred' }));
  }, []);

  /** 「目標に昇格」— GoalSuggestion を返す */
  const promote = useCallback(
    (id: string): GoalSuggestion | null => {
      const suggestion = rawSuggestions.find((s) => s.id === id);
      if (!suggestion) return null;
      setActions((prev) => ({ ...prev, [id]: 'promoted' }));
      return suggestion;
    },
    [rawSuggestions],
  );

  /** 「保留に戻す」 */
  const undoAction = useCallback((id: string) => {
    setActions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return {
    suggestions,
    pendingSuggestions,
    deferredSuggestions,
    noteToMemo,
    defer,
    promote,
    undoAction,
    metrics,
    hasSuggestions: rawSuggestions.length > 0,
  };
}

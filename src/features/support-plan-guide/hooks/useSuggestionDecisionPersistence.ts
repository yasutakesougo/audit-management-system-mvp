/**
 * useSuggestionDecisionPersistence — 提案判断の永続化コーディネータ
 *
 * P3-D: SupportPlanGuidePage レベルで使用し、
 * SmartTab / ExcellenceTab（改善メモ）の判断をドラフトに永続化する。
 *
 * 責務:
 *  - activeDraft から suggestionDecisions を読み取り → 初期状態を提供
 *  - 判断変更時に draft の suggestionDecisions を更新 + persistToLocalStorage
 *  - undo 時に該当レコードを除去 + persistToLocalStorage
 *
 * このhookはPage層で一度だけ呼び出し、返り値をSmartTab/ExcellenceTabに渡す。
 */

import { useMemo, useCallback, useRef } from 'react';
import type { SupportPlanDraft, SuggestionDecisionAction, SuggestionDecisionSource } from '../types';
import {
  appendDecisionRecord,
  removeDecisionRecords,
  getDecisionsBySource,
} from '../domain/suggestionDecisionHelpers';
import {
  computeSuggestionDecisionMetrics,
  type SuggestionDecisionMetrics,
} from '../domain/suggestionDecisionMetrics';
import { persistToLocalStorage } from './draftPersistence';
import type { SuggestedGoalDecision } from './useSuggestedGoals';
import type { SuggestionMemoAction } from './useSuggestionMemo';

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

export type UseSuggestionDecisionPersistenceParams = {
  drafts: Record<string, SupportPlanDraft>;
  activeDraftId: string;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>>;
};

export type UseSuggestionDecisionPersistenceReturn = {
  /** SmartTab の useSuggestedGoals に渡す初期 decisions */
  smartInitialDecisions: Record<string, SuggestedGoalDecision>;
  /** ExcellenceTab の useSuggestionMemo に渡す初期 actions */
  memoInitialActions: Record<string, SuggestionMemoAction>;
  /** 判断変更時のコールバック（SmartTab / ExcellenceTab 両方で共通） */
  onDecisionChange: (id: string, action: SuggestionDecisionAction, source: SuggestionDecisionSource) => void;
  /** undo 時のコールバック */
  onDecisionUndo: (id: string, source: SuggestionDecisionSource) => void;
  /** P3-E: 提案判断メトリクス（横断集計） */
  suggestionMetrics: SuggestionDecisionMetrics;
  /** P3-F: 生の判断レコード（ルール別メトリクスの入力） */
  currentDecisions: import('../types').SuggestionDecisionRecord[];
};

// ────────────────────────────────────────────
// SmartTab 系の SuggestionDecisionAction → SuggestedGoalDecision 変換
// ────────────────────────────────────────────

function toGoalDecision(action: SuggestionDecisionAction): SuggestedGoalDecision | undefined {
  switch (action) {
    case 'accepted':
      return 'accepted';
    case 'dismissed':
      return 'dismissed';
    default:
      return undefined;
  }
}

function toMemoAction(action: SuggestionDecisionAction): SuggestionMemoAction | undefined {
  switch (action) {
    case 'noted':
    case 'deferred':
    case 'promoted':
      return action;
    default:
      return undefined;
  }
}

// ────────────────────────────────────────────
// Hook 実装
// ────────────────────────────────────────────

export function useSuggestionDecisionPersistence({
  drafts,
  activeDraftId,
  setDrafts,
}: UseSuggestionDecisionPersistenceParams): UseSuggestionDecisionPersistenceReturn {
  // 現在の active draft からの decisions 配列
  const currentDecisions = useMemo(
    () => drafts[activeDraftId]?.suggestionDecisions ?? [],
    [drafts, activeDraftId],
  );

  // SmartTab 用初期 decisions
  const smartInitialDecisions = useMemo(() => {
    const raw = getDecisionsBySource(currentDecisions, 'smart');
    const result: Record<string, SuggestedGoalDecision> = {};
    for (const [id, action] of Object.entries(raw)) {
      const mapped = toGoalDecision(action);
      if (mapped) result[id] = mapped;
    }
    return result;
  }, [currentDecisions]);

  // Memo 用初期 actions
  const memoInitialActions = useMemo(() => {
    const raw = getDecisionsBySource(currentDecisions, 'memo');
    const result: Record<string, SuggestionMemoAction> = {};
    for (const [id, action] of Object.entries(raw)) {
      const mapped = toMemoAction(action);
      if (mapped) result[id] = mapped;
    }
    return result;
  }, [currentDecisions]);

  // ── Stable ref for latest drafts/activeDraftId ──
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const activeIdRef = useRef(activeDraftId);
  activeIdRef.current = activeDraftId;

  // ── onDecisionChange ──
  const onDecisionChange = useCallback(
    (id: string, action: SuggestionDecisionAction, source: SuggestionDecisionSource) => {
      setDrafts((prev) => {
        const draftId = activeIdRef.current;
        const draft = prev[draftId];
        if (!draft) return prev;

        const existing = draft.suggestionDecisions ?? [];
        const updated = appendDecisionRecord(existing, id, source, action);
        const newDraft: SupportPlanDraft = {
          ...draft,
          suggestionDecisions: updated,
          updatedAt: new Date().toISOString(),
        };
        const next = { ...prev, [draftId]: newDraft };
        persistToLocalStorage(next, draftId);
        return next;
      });
    },
    [setDrafts],
  );

  // ── onDecisionUndo ──
  const onDecisionUndo = useCallback(
    (id: string, source: SuggestionDecisionSource) => {
      setDrafts((prev) => {
        const draftId = activeIdRef.current;
        const draft = prev[draftId];
        if (!draft) return prev;

        const existing = draft.suggestionDecisions ?? [];
        const updated = removeDecisionRecords(existing, id, source);
        const newDraft: SupportPlanDraft = {
          ...draft,
          suggestionDecisions: updated,
          updatedAt: new Date().toISOString(),
        };
        const next = { ...prev, [draftId]: newDraft };
        persistToLocalStorage(next, draftId);
        return next;
      });
    },
    [setDrafts],
  );

  // ── P3-E: メトリクス集計 ──
  const suggestionMetrics = useMemo(
    () => computeSuggestionDecisionMetrics(currentDecisions),
    [currentDecisions],
  );

  return {
    smartInitialDecisions,
    memoInitialActions,
    onDecisionChange,
    onDecisionUndo,
    suggestionMetrics,
    currentDecisions,
  };
}

/**
 * @fileoverview ISP 判断記録 React Hook
 * @description
 * ISP 見直し提案に対する判断の取得・保存を管理する。
 *
 * 責務:
 * - userId / monitoringPeriod 単位で判断レコードを取得
 * - 新規判断の保存
 * - 保存中・エラー状態の管理
 * - 保存後のリフレッシュ
 * - 現行判断ステータスとメモの解決
 *
 * 使い方:
 * ```ts
 * const { decisionStatuses, decisionNotes, handleDecision, isSaving, error } =
 *   useIspRecommendationDecisions(userId, monitoringPeriod, recommendations);
 * ```
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DecisionStatus, IspRecommendationDecision } from '../domain/ispRecommendationDecisionTypes';
import type { IspRecommendationSummary } from '../domain/ispRecommendationTypes';
import { createIspDecisionRepository } from '../data/createIspDecisionRepository';
import type { DecisionInput } from '../components/IspRecommendationCard';
import { createRecommendationSnapshot } from '../domain/ispRecommendationDecisionUtils';

// ────────────────────────────────────────────────────────

export interface MonitoringPeriod {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface UseIspRecommendationDecisionsResult {
  /** goalId → 判断ステータス */
  decisionStatuses: Map<string, DecisionStatus>;
  /** goalId → 判断メモ */
  decisionNotes: Map<string, string>;
  /** 判断操作ハンドラ（IspRecommendationCard.onDecision に渡す） */
  handleDecision: (input: DecisionInput) => Promise<void>;
  /** 保存中フラグ */
  isSaving: boolean;
  /** 最新エラー */
  error: Error | null;
  /** 判断レコード配列 */
  decisions: IspRecommendationDecision[];
}

// ────────────────────────────────────────────────────────

/**
 * ISP 判断記録 Hook
 *
 * @param userId 対象ユーザー ID
 * @param monitoringPeriod モニタリング期間
 * @param recommendations 現在の ISP 提案サマリー
 * @param decidedBy 判断者 (UPN)
 */
export function useIspRecommendationDecisions(
  userId: string,
  monitoringPeriod: MonitoringPeriod | undefined,
  recommendations: IspRecommendationSummary | null | undefined,
  decidedBy: string,
): UseIspRecommendationDecisionsResult {
  const [decisions, setDecisions] = useState<IspRecommendationDecision[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  // ─── リポジトリ取得 ─────────────────────────────────
  const repository = useMemo(() => createIspDecisionRepository(), []);

  // ─── 初回ロード ─────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!userId || !monitoringPeriod) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const records = await repository.list({
          userId,
          monitoringPeriod,
          signal: controller.signal,
        });
        if (mountedRef.current) {
          setDecisions(records);
          setError(null);
        }
      } catch (e) {
        if (mountedRef.current && !controller.signal.aborted) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      }
    })();

    return () => controller.abort();
  }, [userId, monitoringPeriod, repository]);

  // ─── ステータス / メモ 解決 ───────────────────────────
  const { decisionStatuses, decisionNotes } = useMemo(() => {
    const statuses = new Map<string, DecisionStatus>();
    const notes = new Map<string, string>();

    if (!recommendations) return { decisionStatuses: statuses, decisionNotes: notes };

    // 全目標を pending 初期化
    for (const rec of recommendations.recommendations) {
      if (rec.level !== 'pending') {
        statuses.set(rec.goalId, 'pending');
      }
    }

    // 判断を decidedAt 昇順で適用（最新が勝つ）
    const sorted = [...decisions].sort(
      (a, b) => a.decidedAt.localeCompare(b.decidedAt),
    );
    for (const d of sorted) {
      statuses.set(d.goalId, d.status);
      if (d.note) notes.set(d.goalId, d.note);
    }

    return { decisionStatuses: statuses, decisionNotes: notes };
  }, [recommendations, decisions]);

  // ─── 保存ハンドラ ───────────────────────────────────
  const handleDecision = useCallback(async (input: DecisionInput) => {
    if (!monitoringPeriod || !recommendations) return;

    const rec = recommendations.recommendations.find(r => r.goalId === input.goalId);
    if (!rec) return;

    setIsSaving(true);
    setError(null);

    try {
      const snapshot = createRecommendationSnapshot(rec);
      const saved = await repository.save({
        goalId: input.goalId,
        userId,
        status: input.status as DecisionStatus,
        decidedBy,
        decidedAt: new Date().toISOString(),
        note: input.note,
        monitoringPeriodFrom: monitoringPeriod.from,
        monitoringPeriodTo: monitoringPeriod.to,
        snapshot,
      });

      if (mountedRef.current) {
        setDecisions(prev => [saved, ...prev]);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [userId, monitoringPeriod, recommendations, decidedBy, repository]);

  return {
    decisionStatuses,
    decisionNotes,
    handleDecision,
    isSaving,
    error,
    decisions,
  };
}

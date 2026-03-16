/**
 * @fileoverview useOpsMetrics — Ops Dashboard 用の統合 hook
 * @description
 * 全メトリクスのデータ取得・計算を一箇所に集約する。
 * ページ側は useOpsMetrics() を呼ぶだけで 3 メトリクスを取得できる。
 *
 * Phase 1: Proposal → SuggestionAction adapter 接続済み
 * Phase 2: PDCA    → buildPdcaCycleRecords builder 接続済み
 * Phase 3: Knowledge → 外部 props スロット（将来接続用）
 *
 * @see docs/ops/ops-dashboard-observability-layer.md
 * @see docs/ops/pdca-cycle-record-definition.md
 */
import { useMemo, useState, useEffect } from 'react';

import { computeProposalMetrics } from '@/domain/metrics/proposalMetrics';
import type { ProposalMetricsResult, MetricsPeriod } from '@/domain/metrics/proposalMetrics';
import { computePdcaCycleMetrics } from '@/domain/metrics/pdcaCycleMetrics';
import type { PdcaCycleMetricsResult } from '@/domain/metrics/pdcaCycleMetrics';
import { computeKnowledgeMetrics } from '@/domain/metrics/knowledgeMetrics';
import type {
  KnowledgeMetricsResult,
  DecisionRecord,
  EvidenceLinkRecord,
  KnowledgePeriod,
} from '@/domain/metrics/knowledgeMetrics';
import { adaptSuggestionActions } from '@/domain/metrics/adapters/proposalDecisionAdapter';
import { buildPdcaCycleRecords } from '@/domain/metrics/adapters/pdcaCycleBuilder';
import type { CycleBuilderInput } from '@/domain/metrics/adapters/pdcaCycleBuilder';
import type { SuggestionAction } from '@/features/daily/domain/suggestionAction';

// ─── 型定義 ──────────────────────────────────────────────

export interface OpsMetricsData {
  /** ローディング完了したか */
  isReady: boolean;
  /** Proposal Metrics */
  proposalMetrics: ProposalMetricsResult | null;
  /** PDCA Cycle Metrics */
  pdcaMetrics: PdcaCycleMetricsResult | null;
  /** Knowledge Metrics */
  knowledgeMetrics: KnowledgeMetricsResult | null;
  /** schedule 未設定で除外された利用者数 */
  excludedUserCount: number;
}

/** 1 利用者分の PDCA 用データ */
export interface UserPdcaInput {
  userId: string;
  /** 支援開始日（null = schedule 未設定 → 除外） */
  supportStartDate: string | null;
  /** モニタリング周期（日数、デフォルト 90） */
  cycleDays?: number;
  /** モニタリング実施記録: { round → completedAt ISO } */
  monitoringCompletions?: Map<number, string>;
  /** 計画更新記録: { round → updatedAt ISO } */
  planUpdateDates?: Map<number, string>;
}

export interface UseOpsMetricsOptions {
  /** 集計期間（デフォルト: 直近 3 ヶ月） */
  period?: MetricsPeriod;
  /** 利用者ごとの PDCA 入力データ */
  userPdcaInputs?: UserPdcaInput[];
  /** Knowledge: 判断記録（将来: リポジトリから取得） */
  decisionRecords?: DecisionRecord[];
  /** Knowledge: Evidence Link（将来: リポジトリから取得） */
  evidenceLinks?: EvidenceLinkRecord[];
  /** Knowledge: 支援計画 ID 一覧 */
  planningSheetIds?: string[];
  /** Knowledge: 集計期間 */
  knowledgePeriod?: KnowledgePeriod;
  /** 現在日時 ISO 8601 */
  today?: string;
}

// ─── デフォルト値 ────────────────────────────────────────

function getDefaultPeriod(): MetricsPeriod {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function getDefaultKnowledgePeriod(): KnowledgePeriod {
  const period = getDefaultPeriod();
  return { ...period, months: 3 };
}

// ─── localStorage からの SuggestionAction 取得 ───────────

const SUGGESTION_STORAGE_KEY_PATTERN = /^daily-record-/;

/**
 * localStorage から全利用者の SuggestionAction を収集する。
 * daily-record-* キーに格納された UserRowData の acceptedSuggestions を読む。
 */
function collectSuggestionActions(): SuggestionAction[] {
  const allActions: SuggestionAction[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !SUGGESTION_STORAGE_KEY_PATTERN.test(key)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const data: unknown = JSON.parse(raw);
        if (data && typeof data === 'object') {
          // UserRowData 構造: rows が配列で、各 row に acceptedSuggestions がある
          const rows = (data as Record<string, unknown>).rows;
          if (Array.isArray(rows)) {
            for (const row of rows) {
              const suggestions = (row as Record<string, unknown>).acceptedSuggestions;
              if (Array.isArray(suggestions)) {
                allActions.push(...(suggestions as SuggestionAction[]));
              }
            }
          }
          // 直接 acceptedSuggestions がある場合
          const directSuggestions = (data as Record<string, unknown>).acceptedSuggestions;
          if (Array.isArray(directSuggestions)) {
            allActions.push(...(directSuggestions as SuggestionAction[]));
          }
        }
      } catch {
        // JSON parse error — skip
      }
    }
  } catch {
    // localStorage access error — return empty
  }

  return allActions;
}

// ─── Hook 本体 ───────────────────────────────────────────

/**
 * Ops Dashboard 用の統合データ取得 hook。
 *
 * Phase 1: Proposal → SuggestionAction から自動変換
 * Phase 2: PDCA    → userPdcaInputs + SuggestionAction から自動構築
 * Phase 3: Knowledge → 外部 props
 *
 * @example
 * ```tsx
 * const { isReady, proposalMetrics, pdcaMetrics, knowledgeMetrics } = useOpsMetrics({
 *   userPdcaInputs: [
 *     { userId: 'u1', supportStartDate: '2026-01-01' },
 *   ],
 * });
 * ```
 */
export function useOpsMetrics(options: UseOpsMetricsOptions = {}): OpsMetricsData {
  const {
    period = getDefaultPeriod(),
    userPdcaInputs = [],
    decisionRecords = [],
    evidenceLinks = [],
    planningSheetIds = [],
    knowledgePeriod = getDefaultKnowledgePeriod(),
    today = new Date().toISOString(),
  } = options;

  // Phase 1: SuggestionAction → ProposalDecisionRecord
  const [suggestionActions, setSuggestionActions] = useState<SuggestionAction[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const actions = collectSuggestionActions();
    setSuggestionActions(actions);
    setIsReady(true);
  }, []);

  const proposalRecords = useMemo(
    () => adaptSuggestionActions(suggestionActions),
    [suggestionActions],
  );

  // ── Proposal Metrics ──
  const proposalMetrics = useMemo(
    () => proposalRecords.length > 0
      ? computeProposalMetrics(proposalRecords, period)
      : null,
    [proposalRecords, period],
  );

  // ── Phase 2: PDCA Cycle Metrics ──
  // schedule 未設定の利用者を除外し、残りからサイクルを構築
  const { pdcaMetrics, excludedUserCount } = useMemo(() => {
    // supportStartDate が null の利用者を除外
    const validInputs = userPdcaInputs.filter(
      (input): input is UserPdcaInput & { supportStartDate: string } =>
        input.supportStartDate !== null,
    );
    const excluded = userPdcaInputs.length - validInputs.length;

    if (validInputs.length === 0) {
      return { pdcaMetrics: null as PdcaCycleMetricsResult | null, excludedUserCount: excluded };
    }

    // userId ごとに SuggestionAction を分類
    const actionsByUser = new Map<string, SuggestionAction[]>();
    for (const action of suggestionActions) {
      const existing = actionsByUser.get(action.userId) ?? [];
      existing.push(action);
      actionsByUser.set(action.userId, existing);
    }

    // 各利用者の CycleBuilderInput に SuggestionAction を注入
    const cycleRecords = validInputs.flatMap(input => {
      const builderInput: CycleBuilderInput = {
        userId: input.userId,
        supportStartDate: input.supportStartDate,
        cycleDays: input.cycleDays,
        suggestionActions: actionsByUser.get(input.userId) ?? [],
        monitoringCompletions: input.monitoringCompletions,
        planUpdateDates: input.planUpdateDates,
        today,
      };
      return buildPdcaCycleRecords(builderInput);
    });

    const metrics = cycleRecords.length > 0
      ? computePdcaCycleMetrics(cycleRecords, today)
      : null;

    return { pdcaMetrics: metrics, excludedUserCount: excluded };
  }, [userPdcaInputs, suggestionActions, today]);

  // ── Knowledge Metrics ──
  const knowledgeMetrics = useMemo(
    () => decisionRecords.length > 0 || evidenceLinks.length > 0
      ? computeKnowledgeMetrics(decisionRecords, evidenceLinks, planningSheetIds, knowledgePeriod)
      : null,
    [decisionRecords, evidenceLinks, planningSheetIds, knowledgePeriod],
  );

  return {
    isReady,
    proposalMetrics,
    pdcaMetrics,
    knowledgeMetrics,
    excludedUserCount,
  };
}

/**
 * @fileoverview useOpsMetrics — Ops Dashboard 用の統合 hook
 * @description
 * 全メトリクスのデータ取得・計算を一箇所に集約する。
 * ページ側は useOpsMetrics() を呼ぶだけで 3 メトリクスを取得できる。
 *
 * Phase 1: SuggestionAction → ProposalDecisionRecord アダプター接続
 * Phase 2+: PDCA / Knowledge のリアルデータ接続（TODO）
 *
 * @see docs/ops/ops-dashboard-observability-layer.md
 */
import { useMemo, useState, useEffect } from 'react';

import { computeProposalMetrics } from '@/domain/metrics/proposalMetrics';
import type { ProposalMetricsResult, MetricsPeriod } from '@/domain/metrics/proposalMetrics';
import { computePdcaCycleMetrics } from '@/domain/metrics/pdcaCycleMetrics';
import type { PdcaCycleMetricsResult, PdcaCycleRecord } from '@/domain/metrics/pdcaCycleMetrics';
import { computeKnowledgeMetrics } from '@/domain/metrics/knowledgeMetrics';
import type {
  KnowledgeMetricsResult,
  DecisionRecord,
  EvidenceLinkRecord,
  KnowledgePeriod,
} from '@/domain/metrics/knowledgeMetrics';
import { adaptSuggestionActions } from '@/domain/metrics/adapters/proposalDecisionAdapter';
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
}

export interface UseOpsMetricsOptions {
  /** 集計期間（デフォルト: 直近 3 ヶ月） */
  period?: MetricsPeriod;
  /** PDCA サイクルデータ（将来: リポジトリから取得） */
  cycleRecords?: PdcaCycleRecord[];
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
 * Phase 1: Proposal は SuggestionAction から自動変換
 * Phase 2: PDCA / Knowledge は外部から props で渡す
 *
 * @example
 * ```tsx
 * const { isReady, proposalMetrics, pdcaMetrics, knowledgeMetrics } = useOpsMetrics();
 * ```
 */
export function useOpsMetrics(options: UseOpsMetricsOptions = {}): OpsMetricsData {
  const {
    period = getDefaultPeriod(),
    cycleRecords = [],
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

  // Proposal Metrics
  const proposalMetrics = useMemo(
    () => proposalRecords.length > 0
      ? computeProposalMetrics(proposalRecords, period)
      : null,
    [proposalRecords, period],
  );

  // PDCA Cycle Metrics
  const pdcaMetrics = useMemo(
    () => cycleRecords.length > 0
      ? computePdcaCycleMetrics(cycleRecords, today)
      : null,
    [cycleRecords, today],
  );

  // Knowledge Metrics
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
  };
}

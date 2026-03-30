/**
 * @fileoverview Escalation 評価 Hook
 */
import { useMemo } from 'react';
import type { ExceptionItem } from '../domain/exceptionLogic';
import type { ExceptionCenterSummary } from '../domain/exceptionCenterSummary';
import { evaluateEscalation } from '../domain/escalationLogic';
import type { EscalationDecision } from '../domain/escalationTypes';

export function useEscalationEvaluation(items: ExceptionItem[], summary: ExceptionCenterSummary) {
  const evaluations = useMemo(() => {
    const now = new Date();
    
    return items.map(item => {
      const cluster = summary.groups.find(g => g.userId === item.targetUserId);
      const clusterCount = cluster?.items.length ?? 1;

      // エスカレーション判定の計算
      const decision = evaluateEscalation({
        item,
        now,
        clusterCount,
        // suppressionState は現状フロントエンドで保持していないため undefined
        // 実装時は LocalStorage やサーバーサイドでの管理と同期する
      });

      return {
        item,
        decision
      };
    });
  }, [items, summary]);

  const activeEscalations = useMemo(() => 
    evaluations.filter(e => e.decision.level !== 'none' && !e.decision.isSuppressed),
  [evaluations]);

  return {
    evaluations,
    activeEscalations, // 実際に通知が必要なリスト
    emergencyCount: activeEscalations.filter(e => e.decision.level === 'emergency').length,
    warningCount: activeEscalations.filter(e => e.decision.level === 'warning').length
  };
}

export type EscalatedException = {
  item: ExceptionItem;
  decision: EscalationDecision;
}

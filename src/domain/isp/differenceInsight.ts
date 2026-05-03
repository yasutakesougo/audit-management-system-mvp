import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';
import type { SupportPlanningSheet, IcebergSummary, DifferenceInsight, DifferenceChange } from './schema';

/**
 * Iceberg スナップショットから主要な行動と要因を要約する。
 */
export function summarizeIcebergSnapshot(snapshot: IcebergSnapshot | null): IcebergSummary | null {
  if (!snapshot) return null;

  // 1. 主要対象行動: behavior ノードのうち、最も新しいものを選択
  const behaviors = snapshot.nodes
    .filter(n => n.type === 'behavior')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  
  const primaryBehavior = behaviors[0]?.label ?? '—';

  // 2. 主要な要因: 信頼度(confidence)の高いリンクを優先的に選択
  const confidencePriority: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };
  const sortedLinks = [...snapshot.links].sort((a, b) => 
    (confidencePriority[b.confidence] || 0) - (confidencePriority[a.confidence] || 0)
  );
  
  const priorityLink = sortedLinks[0];
  let primaryFactor = '—';
  if (priorityLink) {
    const sourceNode = snapshot.nodes.find(n => n.id === priorityLink.sourceNodeId);
    if (sourceNode) {
      primaryFactor = sourceNode.label;
    }
  }

  return {
    sessionId: snapshot.sessionId,
    updatedAt: snapshot.updatedAt,
    primaryBehavior,
    primaryFactor,
  };
}

/**
 * Iceberg の要約と現在の支援計画シートを比較し、未反映のインサイトを算出する。
 */
export function calculateDifferenceInsight(
  summary: IcebergSummary | null,
  sheet: SupportPlanningSheet | null
): DifferenceInsight | null {
  if (!summary || !sheet) return null;

  const changes: DifferenceChange[] = [];

  // 1. 行動の差分 (レベル: high)
  // 計画のアセスメントに含まれるターゲット行動と比較
  const currentBehaviors = sheet.assessment?.targetBehaviors.map(b => b.name) || [];
  if (summary.primaryBehavior !== '—' && !currentBehaviors.includes(summary.primaryBehavior)) {
    changes.push({
      label: '行動',
      value: `追加: ${summary.primaryBehavior}`,
      level: 'high'
    });
  }

  // 2. 要因の差分 (レベル: medium)
  // 計画のアセスメントに含まれる仮説の「機能/要因」と比較
  const currentHypotheses = sheet.assessment?.hypotheses.map(h => h.function) || [];
  if (summary.primaryFactor !== '—' && !currentHypotheses.includes(summary.primaryFactor)) {
    changes.push({
      label: '要因',
      value: `要検討: ${summary.primaryFactor}`,
      level: 'medium'
    });
  }

  if (changes.length === 0) return null;

  return {
    changes,
    sourceSessionId: summary.sessionId,
  };
}

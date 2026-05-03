import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';
import type { SupportPlanningSheet, IcebergSummary, DifferenceInsight, DifferenceChange, ReflectPreview, ReflectPreviewChange } from './schema';

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

/**
 * 差分インサイトから反映プレビューを生成する (Pure Builder)。
 */
export function buildReflectPreview(
  insight: DifferenceInsight,
  summary: IcebergSummary,
  _sheet: SupportPlanningSheet
): ReflectPreview {
  const changes: ReflectPreviewChange[] = [];

  insight.changes.forEach(change => {
    if (change.level === 'high' && change.label === '行動') {
      changes.push({
        type: 'behavior',
        label: '対象行動の追加',
        before: '(未登録)',
        after: summary.primaryBehavior,
      });
    }
    if (change.level === 'medium' && change.label === '要因') {
      changes.push({
        type: 'factor',
        label: '背景要因の追加',
        before: '(未登録)',
        after: summary.primaryFactor,
      });
    }
  });

  return {
    changes,
    sourceSessionId: insight.sourceSessionId,
  };
}

/**
 * 差分インサイトを支援計画シートに反映した新しいオブジェクトを生成する (Pure Builder)。
 */
export function applyReflectPatch(
  insight: DifferenceInsight,
  summary: IcebergSummary,
  sheet: SupportPlanningSheet
): SupportPlanningSheet {
  const updatedSheet = { ...sheet };
  const updatedAssessment = { 
    ...sheet.assessment,
    targetBehaviors: [...(sheet.assessment?.targetBehaviors || [])],
    hypotheses: [...(sheet.assessment?.hypotheses || [])],
  };

  insight.changes.forEach(change => {
    if (change.level === 'high' && change.label === '行動') {
      const exists = updatedAssessment.targetBehaviors.some(b => b.name === summary.primaryBehavior);
      if (!exists && summary.primaryBehavior !== '—') {
        updatedAssessment.targetBehaviors.push({
          name: summary.primaryBehavior,
          operationalDefinition: '(氷山分析より反映)',
          frequency: '',
          intensity: '',
          duration: ''
        });
      }
    }
    if (change.level === 'medium' && change.label === '要因') {
      const exists = updatedAssessment.hypotheses.some(h => h.function === summary.primaryFactor);
      if (!exists && summary.primaryFactor !== '—') {
        updatedAssessment.hypotheses.push({
          function: summary.primaryFactor,
          evidence: '(氷山分析より反映)',
          confidence: 'medium'
        });
      }
    }
  });

  updatedSheet.assessment = updatedAssessment;
  return updatedSheet;
}

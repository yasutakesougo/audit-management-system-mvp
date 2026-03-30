/**
 * Planning → Daily Bridge Mapper (Pure Logic)
 * 
 * L2 (支援計画) の内容を、L0 (日次記録) の現場が今日実行・確認可能な
 * 「ガイダンス (DailyGuidanceBundle)」へ変換する純粋関数。
 */

import type { SupportPlanningSheet } from './schema/ispPlanningSheetSchema';
import { toLocalDateISO } from '@/utils/getNow';
import type { 
  DailyGuidanceBundle, 
  DailyDeploymentItem
} from './dailyBridge';

/**
 * 支援計画シートを現場向けの一日のガイダンスに変換する。
 */
export function mapPlanningToDailyBridge(
  sheet: SupportPlanningSheet,
  targetDate: string = toLocalDateISO()
): DailyGuidanceBundle {
  const items: DailyDeploymentItem[] = [];
  
  const provenance = {
    planningSheetId: sheet.id,
    sourceSection: 'planningData',
    effectiveDate: sheet.appliedFrom || sheet.createdAt
  };

  // 1. 実施手順 (Procedure Steps) の抽出
  if (sheet.planning?.procedureSteps) {
    sheet.planning.procedureSteps.forEach((step) => {
      items.push({
        id: `deploy-step-${sheet.id}-${step.order}`,
        type: 'procedure',
        title: `手順 ${step.order}: ${step.timing || '実施時'}`,
        content: step.instruction,
        provenance: { ...provenance, sourceSection: 'planning.procedureSteps' },
        priority: 0.8,
        goalSummary: sheet.title
      });
    });
  }

  // 2. 注意点 (Crisis / Risk) の抽出
  if (sheet.planning?.crisisThresholds) {
    const crisis = sheet.planning.crisisThresholds;
    if (crisis.escalationLevel) {
      items.push({
        id: `deploy-caution-${sheet.id}-crisis`,
        type: 'caution',
        title: `緊急対応指標: ${crisis.escalationLevel}`,
        content: crisis.deescalationSteps.join('\n'),
        provenance: { ...provenance, sourceSection: 'planning.crisisThresholds' },
        priority: 1.0,
        goalSummary: '医療・安全のリスク'
      });
    }
  }

  // 3. 環境調整 (Environmental Adjustments)
  if (sheet.environmentalAdjustments) {
    items.push({
      id: `deploy-env-${sheet.id}`,
      type: 'environmental',
      title: '環境の調整・準備',
      content: sheet.environmentalAdjustments,
      provenance: { ...provenance, sourceSection: 'environmentalAdjustments' },
      priority: 0.6
    });
  }

  // 4. 重点観察ポイント (Focus points for Monitoring)
  if (sheet.interpretationHypothesis) {
    items.push({
      id: `deploy-focus-${sheet.id}`,
      type: 'focus',
      title: '今日の観察の重点',
      content: `背景仮説: ${sheet.interpretationHypothesis.slice(0, 100)}...`,
      provenance: { ...provenance, sourceSection: 'interpretationHypothesis' },
      priority: 0.7,
      goalSummary: '再評価・モニタリング用'
    });
  }

  return {
    userId: sheet.userId,
    targetDate,
    items,
    summary: {
      cautionCount: items.filter(i => i.type === 'caution').length,
      procedureCount: items.filter(i => i.type === 'procedure').length,
      focusPointCount: items.filter(i => i.type === 'focus').length,
      latestUpdateAt: sheet.updatedAt
    }
  };
}

/**
 * 現場向けの短い要約を作成する
 */
export function summarizePlanningForDaily(sheet: SupportPlanningSheet): string {
  const parts = [];
  if (sheet.supportPolicy) parts.push(`方針: ${sheet.supportPolicy.slice(0, 50)}`);
  if (sheet.planning?.procedureSteps?.length) {
    parts.push(`手順: ${sheet.planning.procedureSteps[0].instruction.slice(0, 30)}... 他${sheet.planning.procedureSteps.length - 1}件`);
  }
  return parts.join(' / ');
}

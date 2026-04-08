import type { PlanningSheetStatus, PlanningSheetListItem, SupportPlanningSheet } from '@/domain/isp/schema';
import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';
import type { PlanningSheetListViewModel } from '../types';
import type { IUserMaster } from '@/features/users/types';

function getStatusColor(status: PlanningSheetStatus): 'default' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'draft': return 'default';
    case 'review': return 'info';
    case 'active': return 'success';
    case 'revision_pending': return 'warning';
    case 'archived': return 'default';
    default: return 'default';
  }
}

export interface MapperInput {
  userId: string | null;
  sheets: PlanningSheetListItem[];
  isLoading: boolean;
  error: string | null;
  allUsers: IUserMaster[];
  latestIcebergSnapshot: IcebergSnapshot | null;
  currentSheetDetails: SupportPlanningSheet | null;
}

/**
 * PlanningSheetListPage の ViewModel を構築する純粋関数。
 */
export function mapToPlanningSheetListViewModel(input: MapperInput): PlanningSheetListViewModel {
  const {
    userId,
    sheets,
    isLoading,
    error,
    allUsers,
    latestIcebergSnapshot,
    currentSheetDetails,
  } = input;

  const currentCount = sheets.filter(s => s.isCurrent).length;
  const totalCount = sheets.length;

  const mappedSheets = sheets.map(sheet => ({
    ...sheet,
    statusColor: getStatusColor(sheet.status),
  }));

  const selectedUser = allUsers.find(u => u.UserID === userId);
  const isIcebergTarget = !!selectedUser?.IsHighIntensitySupportTarget;
  const isIcebergEnabled = true; // フィーチャーフラグ相当

  // Iceberg 要約の抽出 (標準化された選定ルールに基づき抽出)
  let icebergSummary: PlanningSheetListViewModel['icebergSummary'] | undefined;
  if (latestIcebergSnapshot) {
    // 1. 主要対象行動: behavior ノードのうち、最も新しいものを選択
    const behaviors = latestIcebergSnapshot.nodes
      .filter(n => n.type === 'behavior')
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    
    const primaryBehavior = behaviors[0]?.label ?? '—';

    // 2. 主要な要因: 信頼度(confidence)の高いリンクを優先的に選択
    const confidencePriority = { 'high': 3, 'medium': 2, 'low': 1 };
    const sortedLinks = [...latestIcebergSnapshot.links].sort((a, b) => 
      (confidencePriority[b.confidence] || 0) - (confidencePriority[a.confidence] || 0)
    );
    
    const priorityLink = sortedLinks[0];
    let primaryFactor = '—';
    if (priorityLink) {
      const sourceNode = latestIcebergSnapshot.nodes.find(n => n.id === priorityLink.sourceNodeId);
      if (sourceNode) {
        primaryFactor = sourceNode.label;
      }
    }

    icebergSummary = {
      sessionId: latestIcebergSnapshot.sessionId,
      updatedAt: latestIcebergSnapshot.updatedAt,
      primaryBehavior,
      primaryFactor,
    };
  }

  // --- Difference Insight (差分分析) ---
  let differenceInsight: PlanningSheetListViewModel['differenceInsight'] | undefined;
  if (icebergSummary && currentSheetDetails) {
    const changes: NonNullable<PlanningSheetListViewModel['differenceInsight']>['changes'] = [];

    // 1. 行動の差分 (レベル: 高)
    const currentBehaviors = currentSheetDetails.assessment?.targetBehaviors.map(b => b.name) || [];
    if (!currentBehaviors.includes(icebergSummary.primaryBehavior) && icebergSummary.primaryBehavior !== '—') {
      changes.push({
        label: '行動',
        value: `追加: ${icebergSummary.primaryBehavior}`,
        level: 'high'
      });
    }

    // 2. 要因の差分 (レベル: 中)
    const currentHypotheses = currentSheetDetails.assessment?.hypotheses.map(h => h.function) || [];
    if (!currentHypotheses.includes(icebergSummary.primaryFactor) && icebergSummary.primaryFactor !== '—') {
      changes.push({
        label: '要因',
        value: `要検討: ${icebergSummary.primaryFactor}`,
        level: 'medium'
      });
    }

    if (changes.length > 0) {
      differenceInsight = {
        changes,
        sourceSessionId: icebergSummary.sessionId,
      };
    }
  }

  return {
    userId,
    sheets: mappedSheets,
    isLoading,
    error,
    allUsers,
    isIcebergTarget,
    isIcebergEnabled,
    icebergSummary,
    differenceInsight,
    currentCount,
    totalCount,
  };
}

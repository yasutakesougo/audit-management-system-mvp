import type { PlanningSheetStatus, PlanningSheetListItem, SupportPlanningSheet } from '@/domain/isp/schema';
import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';
import type { PlanningSheetListViewModel } from '../types';
import type { IUserMaster } from '@/features/users/types';
import { summarizeIcebergSnapshot, calculateDifferenceInsight } from '@/domain/isp/differenceInsight';

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

  // Iceberg 要約と差分インサイトの算出 (ドメインロジックへ委譲)
  const icebergSummary = summarizeIcebergSnapshot(latestIcebergSnapshot) || undefined;
  const differenceInsight = calculateDifferenceInsight(icebergSummary || null, currentSheetDetails) || undefined;

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

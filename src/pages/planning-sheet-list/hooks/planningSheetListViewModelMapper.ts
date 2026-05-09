import type { PlanningSheetStatus, PlanningSheetListItem, SupportPlanningSheet } from '@/domain/isp/schema';
import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';
import type { PlanningSheetListViewModel } from '../types';
import type { IUserMaster } from '@/features/users/types';
import { summarizeIcebergSnapshot, calculateDifferenceInsight } from '@/domain/isp/differenceInsight';
import { resolveSupportStartDateDetailed } from '@/features/planning-sheet/monitoringSchedule';
import type { MonitoringOriginStatus } from '../types';

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

  const mappedSheets = sheets.map(sheet => {
    const user = allUsers.find(u => u.UserID === sheet.userId);
    const serviceStartDate = user?.ServiceStartDate;

    const resolved = resolveSupportStartDateDetailed(
      sheet.supportStartDate,
      serviceStartDate,
      sheet.appliedFrom
    );

    let monitoringOriginStatus: MonitoringOriginStatus = 'unset';
    let monitoringOriginLabel = '未設定';
    let monitoringOriginHelper = '90日モニタリングの起点となる支援開始日が未設定です。利用者マスタまたは支援計画シートで設定してください';
    let monitoringOriginColor: 'success' | 'warning' | 'error' | 'default' = 'error';

    if (resolved.date) {
      const parsed = new Date(resolved.date);
      if (isNaN(parsed.getTime())) {
        monitoringOriginStatus = 'invalid';
        monitoringOriginLabel = '不正';
        monitoringOriginHelper = '支援開始日または計画適用日の日付形式を確認してください';
        monitoringOriginColor = 'error';
      } else {
        if (resolved.source === 'planning' || resolved.source === 'master') {
          monitoringOriginStatus = 'official';
          monitoringOriginLabel = '確定';
          monitoringOriginHelper = '支援開始日を起点に90日モニタリングを管理しています';
          monitoringOriginColor = 'success';
        } else if (resolved.source === 'fallback') {
          monitoringOriginStatus = 'provisional';
          monitoringOriginLabel = '暫定';
          monitoringOriginHelper = '正式な支援開始日が未設定のため、計画適用日から暫定計算しています';
          monitoringOriginColor = 'warning';
        }
      }
    }

    return {
      ...sheet,
      statusColor: getStatusColor(sheet.status),
      monitoringOriginStatus,
      monitoringOriginLabel,
      monitoringOriginHelper,
      monitoringOriginColor,
    };
  });

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

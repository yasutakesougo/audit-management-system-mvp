import type { PlanningSheetListItem } from '@/domain/isp/schema';
import type { IUserMaster } from '@/features/users/types';

export interface PlanningSheetListViewModel {
  userId: string | null;
  sheets: (PlanningSheetListItem & { statusColor: 'default' | 'info' | 'success' | 'warning' })[];
  isLoading: boolean;
  error: string | null;
  allUsers: IUserMaster[];
  
  // Iceberg 連携用
  isIcebergTarget: boolean;
  isIcebergEnabled: boolean;
  icebergSummary?: {
    sessionId: string;
    updatedAt: string;
    primaryBehavior: string;
    primaryFactor: string;
  };
  differenceInsight?: {
    changes: Array<{
      label: string;
      value: string;
      level: 'high' | 'medium' | 'low';
    }>;
    sourceSessionId: string;
  };
  
  // 統計
  currentCount: number;
  totalCount: number;
}

export interface PlanningSheetListActionHandlers {
  onUserSelect: (code: string) => void;
  onNavigateToSheet: (id: string) => void;
  onNewSheet: (userId: string | null) => void;
  onOpenIceberg: (userId: string) => void;
  onCreateFromIceberg: (userId: string) => void;
  onReviseFromIceberg: (userId: string, currentSheetId: string) => void;
  onBackToIsp: () => void;
}

export interface PlanningSheetListViewProps {
  viewModel: PlanningSheetListViewModel;
  handlers: PlanningSheetListActionHandlers;
}

import type { PlanningSheetListItem } from '@/domain/isp/schema';
import type { IUserMaster } from '@/features/users/types';

export interface PlanningSheetListViewModel {
  userId: string | null;
  sheets: (PlanningSheetListItem & { statusColor: 'default' | 'info' | 'success' | 'warning' })[];
  isLoading: boolean;
  error: string | null;
  allUsers: IUserMaster[];
  
  // 統計
  currentCount: number;
  totalCount: number;
}

export interface PlanningSheetListActionHandlers {
  onUserSelect: (code: string) => void;
  onNavigateToSheet: (id: string) => void;
  onNewSheet: (userId: string | null) => void;
  onBackToIsp: () => void;
}

export interface PlanningSheetListViewProps {
  viewModel: PlanningSheetListViewModel;
  handlers: PlanningSheetListActionHandlers;
}

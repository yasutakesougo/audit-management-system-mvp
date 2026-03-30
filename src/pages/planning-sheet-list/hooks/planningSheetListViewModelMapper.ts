import type { PlanningSheetStatus, PlanningSheetListItem } from '@/domain/isp/schema';
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
  } = input;

  const currentCount = sheets.filter(s => s.isCurrent).length;
  const totalCount = sheets.length;

  const mappedSheets = sheets.map(sheet => ({
    ...sheet,
    statusColor: getStatusColor(sheet.status),
  }));

  return {
    userId,
    sheets: mappedSheets,
    isLoading,
    error,
    allUsers,
    currentCount,
    totalCount,
  };
}

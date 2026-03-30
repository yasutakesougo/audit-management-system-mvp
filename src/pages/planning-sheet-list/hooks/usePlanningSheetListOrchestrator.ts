import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { useUsers } from '@/features/users/useUsers';
import type { PlanningSheetListItem } from '@/domain/isp/schema';

import { type PlanningSheetListViewModel, type PlanningSheetListActionHandlers } from '../types';
import { mapToPlanningSheetListViewModel } from './planningSheetListViewModelMapper';

/**
 * PlanningSheetListPage のオーケストレーター hook。
 */
export function usePlanningSheetListOrchestrator(): {
  viewModel: PlanningSheetListViewModel | null;
  handlers: PlanningSheetListActionHandlers;
} {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const repo = usePlanningSheetRepositories();
  const { data: allUsers } = useUsers();

  // 1. データフェッチ管理
  const [sheets, setSheets] = useState<PlanningSheetListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSheets = useCallback(async () => {
    if (!userId || !repo) {
      setSheets([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const items = await repo.listCurrentByUser(userId);
      setSheets(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [userId, repo]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  // 2. ハンドラの定義
  const handlers: PlanningSheetListActionHandlers = {
    onUserSelect: (code) => navigate(`/planning-sheet-list?userId=${code}`),
    onNavigateToSheet: (id) => navigate(`/support-planning-sheet/${id}`),
    onNewSheet: (uid) => navigate(uid ? `/support-planning-sheet/new?userId=${uid}` : '/support-planning-sheet/new'),
    onBackToIsp: () => navigate('/support-plan-guide'),
  };

  // 3. ViewModel の構築
  const viewModel = useMemo(() => mapToPlanningSheetListViewModel({
    userId,
    sheets,
    isLoading,
    error,
    allUsers: allUsers ?? [],
  }), [userId, sheets, isLoading, error, allUsers]);

  return { viewModel, handlers };
}

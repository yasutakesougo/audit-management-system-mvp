import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { useUsers } from '@/features/users/useUsers';
import { useIcebergRepository } from '@/features/ibd/analysis/iceberg/SharePointIcebergRepository';
import type { PlanningSheetListItem, SupportPlanningSheet } from '@/domain/isp/schema';
import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';

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
  const icebergRepo = useIcebergRepository();
  const { data: allUsers } = useUsers();

  // 1. データフェッチ管理
  const [sheets, setSheets] = useState<PlanningSheetListItem[]>([]);
  const [currentSheetDetails, setCurrentSheetDetails] = useState<SupportPlanningSheet | null>(null);
  const [latestIcebergSnapshot, setLatestIcebergSnapshot] = useState<IcebergSnapshot | null>(null);
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

  const fetchIcebergSummary = useCallback(async () => {
    if (!userId || !icebergRepo) {
      setLatestIcebergSnapshot(null);
      return;
    }
    try {
      const latest = await icebergRepo.getLatestByUser(userId);
      setLatestIcebergSnapshot(latest ?? null);
    } catch (err) {
      console.error('Failed to fetch iceberg summary:', err);
    }
  }, [userId, icebergRepo]);

  useEffect(() => {
    fetchSheets();
    fetchIcebergSummary();
  }, [fetchSheets, fetchIcebergSummary]);

  // 現行シートの詳細をフェッチ
  useEffect(() => {
    const current = sheets.find(s => s.isCurrent);
    if (current && repo) {
      repo.getById(current.id).then(setCurrentSheetDetails).catch(console.error);
    } else {
      setCurrentSheetDetails(null);
    }
  }, [sheets, repo]);

  // 2. ViewModel の構築
  const viewModel = useMemo(() => mapToPlanningSheetListViewModel({
    userId,
    sheets,
    isLoading,
    error,
    allUsers: allUsers ?? [],
    latestIcebergSnapshot,
    currentSheetDetails,
  }), [userId, sheets, isLoading, error, allUsers, latestIcebergSnapshot, currentSheetDetails]);

  // 3. ハンドラの定義
  const handlers: PlanningSheetListActionHandlers = {
    onUserSelect: (code) => navigate(`/planning-sheet-list?userId=${code}`),
    onNavigateToSheet: (id) => navigate(`/support-planning-sheet/${id}`),
    onNewSheet: (uid) => navigate(uid ? `/support-planning-sheet/new?userId=${uid}` : '/support-planning-sheet/new'),
    onOpenIceberg: (uid) => navigate(`/analysis/iceberg?userId=${uid}`),
    onCreateFromIceberg: (uid) => navigate(`/support-planning-sheet/new?userId=${uid}&source=iceberg`),
    onReviseFromIceberg: (uid, sid) => {
      const diffSummary = viewModel.differenceInsight?.changes
        .map(c => `【${c.label}】${c.value}`)
        .join(' / ');
      const diffQuery = diffSummary ? `&diffSummary=${encodeURIComponent(diffSummary)}` : '';
      navigate(`/support-planning-sheet/new?userId=${uid}&source=iceberg&baseSheetId=${sid}${diffQuery}`);
    },
    onBackToIsp: () => navigate('/support-plan-guide'),
  };

  return { viewModel, handlers };
}

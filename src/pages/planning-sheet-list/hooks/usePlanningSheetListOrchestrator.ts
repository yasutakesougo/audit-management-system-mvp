import { useEffect, useMemo, useState } from 'react';
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => setRefreshTrigger(v => v + 1);

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      if (!userId || !repo) {
        setSheets([]);
        setLatestIcebergSnapshot(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Parallel fetch
        const [items, iceberg] = await Promise.all([
          repo.listByUser(userId),
          icebergRepo ? icebergRepo.getLatestByUser(userId) : Promise.resolve(null),
        ]);

        if (isCancelled) return;

        setSheets(items);
        setLatestIcebergSnapshot(iceberg ?? null);
      } catch (err) {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [userId, repo, icebergRepo, refreshTrigger]);

  // 現行シートの詳細をフェッチ
  useEffect(() => {
    let isCancelled = false;
    const current = sheets.find(s => s.isCurrent);
    if (current && repo) {
      repo.getById(current.id)
        .then(details => {
          if (!isCancelled) setCurrentSheetDetails(details);
        })
        .catch(err => {
          if (!isCancelled) console.error(err);
        });
    } else {
      setCurrentSheetDetails(null);
    }
    return () => {
      isCancelled = true;
    };
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
    onDeleteSheet: async (id) => {
      if (!window.confirm('この支援計画シートを削除してもよろしいですか？\n削除したデータは元に戻せません。')) {
        return;
      }
      try {
        setIsLoading(true);
        await repo.deleteItem(id);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    onBackToIsp: () => navigate('/support-plan-guide'),
  };

  return { viewModel, handlers };
}

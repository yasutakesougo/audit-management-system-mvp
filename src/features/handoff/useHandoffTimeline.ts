/**
 * 申し送りタイムライン管理フック
 *
 * v1.0: localStorage mock実装
 * v1.1: 時間帯フィルタ対応（Step 7B）
 * v2.0: SharePoint API対応（Phase 8A）
 * v2.1: 監査ログ自動記録（ステータス変更・新規作成）
 * v3.0: Ports & Adapters 化 — Factory 経由でインフラ層にアクセス
 *
 * @see domain/HandoffRepository.ts — Port
 * @see infra/handoffRepositoryFactory.ts — Factory + Adapter
 * @see hooks/useHandoffData.ts — Factory-aware Hook
 */

import { useAuth } from '@/auth/useAuth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
    HandoffDayScope,
    HandoffRecord,
    HandoffTimeFilter,
    NewHandoffInput,
} from './handoffTypes';
import { useHandoffData } from './hooks/useHandoffData';

type HandoffTimelineState = {
  todayHandoffs: HandoffRecord[];
  loading: boolean;
  error: string | null;
};

/**
 * 申し送りタイムライン管理フック（v3.0: Ports & Adapters 対応）
 *
 * @param timeFilter 時間帯フィルタ（全て/朝〜午前/午後〜夕方）
 * @param dayScope 日付スコープ（今日/昨日/週）
 * @returns 申し送りデータと操作関数（フィルタ適用済み）
 */
export function useHandoffTimeline(
  timeFilter: HandoffTimeFilter = 'all',
  dayScope: HandoffDayScope = 'today'
) {
  // ── Port 経由でインフラにアクセス（UI にインフラ用語が漏れない） ──
  const { repo, auditRepo } = useHandoffData();
  const { account } = useAuth();

  const [state, setState] = useState<HandoffTimelineState>({
    todayHandoffs: [],
    loading: true,
    error: null,
  });

  /**
   * 指定日の申し送りデータを読み込み
   * Adapter 内部で localStorage/SharePoint を判別
   */
  const loadToday = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const list = await repo.getRecords(dayScope, timeFilter);
      setState({
        todayHandoffs: list,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        todayHandoffs: [],
        loading: false,
        error: 'データの読み込みに失敗しました',
      });
      console.error('[handoff] Load failed:', error);
    }
  }, [repo, dayScope, timeFilter]);

  /**
   * 新規申し送りを作成
   */
  const createHandoff = useCallback(
    async (input: NewHandoffInput) => {
      try {
        const newRecord = await repo.createRecord(input);

        // 楽観的更新: UIに即座反映
        setState(prev => ({
          ...prev,
          todayHandoffs: [newRecord, ...prev.todayHandoffs],
        }));

        // 監査ログ記録（fire-and-forget）
        const changedBy = account?.name ?? account?.username ?? newRecord.createdByName;
        const changedByAccount = account?.username ?? 'unknown';
        auditRepo.recordCreation(
          newRecord.id,
          changedBy,
          changedByAccount,
        ).catch(e => {
          console.warn('[handoff-audit] 新規作成の監査ログ記録に失敗:', e);
        });

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[handoff] Created:', {
            id: newRecord.id,
            userDisplayName: newRecord.userDisplayName,
            category: newRecord.category,
            severity: newRecord.severity,
          });
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: '申し送りの作成に失敗しました',
        }));
        console.error('[handoff] Create failed:', error);
        throw new Error('申し送りの作成に失敗しました');
      }
    },
    [repo, auditRepo, account],
  );

  /**
   * 申し送りの状態を更新（楽観的更新 + ロールバック）
   */
  const updateHandoffStatus = useCallback(
    async (id: number, newStatus: HandoffRecord['status'], carryOverDate?: string) => {
      const targetRecord = state.todayHandoffs.find(item => item.id === id);
      const oldStatus = targetRecord?.status;

      // 楽観的更新
      const previousState = state.todayHandoffs;
      setState(prev => ({
        ...prev,
        todayHandoffs: prev.todayHandoffs.map(item =>
          item.id === id
            ? { ...item, status: newStatus, ...(carryOverDate ? { carryOverDate } : {}) }
            : item,
        ),
      }));

      try {
        await repo.updateStatus(id, newStatus, dayScope, carryOverDate);

        // 監査ログ記録（fire-and-forget）
        const changedBy = account?.name ?? account?.username ?? 'システム';
        const changedByAccount = account?.username ?? 'unknown';
        auditRepo.recordStatusChange(
          id,
          oldStatus ?? '不明',
          newStatus,
          changedBy,
          changedByAccount,
        ).catch(e => {
          console.warn('[handoff-audit] ステータス変更の監査ログ記録に失敗:', e);
        });

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[handoff] Status updated:', { id, oldStatus, newStatus });
        }
      } catch (error) {
        // ロールバック
        setState(prev => ({
          ...prev,
          todayHandoffs: previousState,
          error: '状態更新に失敗しました',
        }));
        console.error('[handoff] Status update failed:', error);
        throw new Error('状態更新に失敗しました');
      }
    },
    [repo, auditRepo, dayScope, state.todayHandoffs, account],
  );

  // 初回ロード
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // 時間帯フィルタ適用（localStorage 側は Adapter 内部で適用済みなので、ここではスルー）
  // SharePoint Adapter も API レベルでフィルタ済み
  const filteredHandoffs = useMemo(() => {
    return state.todayHandoffs;
  }, [state.todayHandoffs]);

  return {
    // フィルタ適用済みデータ
    todayHandoffs: filteredHandoffs,
    // 全件データ（フィルタ無視）
    allHandoffs: state.todayHandoffs,
    loading: state.loading,
    error: state.error,

    // 操作（全件に対して実行）
    createHandoff,
    updateHandoffStatus,
    reload: loadToday,
  };
}

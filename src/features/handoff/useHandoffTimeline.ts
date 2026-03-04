/**
 * 申し送りタイムライン管理フック
 *
 * v1.0: localStorage mock実装
 * v1.1: 時間帯フィルタ対応（Step 7B）
 * v2.0: SharePoint API対応（Phase 8A）
 * v2.1: 監査ログ自動記録（ステータス変更・新規作成）
 * v3.0: Phase 9 — TanStack Query キャッシュ無効化連携
 *       作成・更新成功時に handoffKeys を invalidate し、
 *       ダッシュボード KPI をリアルタイム同期する。
 */

import { useAuth } from '@/auth/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateTitleFromMessage } from './generateTitleFromMessage';
import { useHandoffApi } from './handoffApi';
import { useHandoffAuditApi } from './handoffAuditApi';
import { handoffConfig } from './handoffConfig';
import { HANDOFF_TIME_FILTER_PRESETS } from './handoffConstants';
import { handoffKeys } from './handoffQueryKeys';
import {
    generateId,
    getDateKeyForScope,
    getRecentDateKeys,
    getTodayKey,
    loadStorage,
    saveStorage,
} from './handoffStorageUtils';
import type {
    HandoffDayScope,
    HandoffRecord,
    HandoffTimeFilter,
    NewHandoffInput,
} from './handoffTypes';

type HandoffTimelineState = {
  todayHandoffs: HandoffRecord[];
  loading: boolean;
  error: string | null;
};

/**
 * 申し送りタイムライン管理フック（Step 7C: dayScope対応）
 *
 * @param timeFilter 時間帯フィルタ（全て/朝〜午前/午後〜夕方）
 * @param dayScope 日付スコープ（今日/昨日）
 * @returns 申し送りデータと操作関数（フィルタ適用済み）
 */
export function useHandoffTimeline(
  timeFilter: HandoffTimeFilter = 'all',
  dayScope: HandoffDayScope = 'today'
) {
  const handoffApi = useHandoffApi(); // フックでAPIインスタンスを取得
  const auditApi = useHandoffAuditApi(); // 監査ログAPIインスタンス
  const { account } = useAuth(); // 操作者情報
  const queryClient = useQueryClient(); // Phase 9: キャッシュ無効化用

  const [state, setState] = useState<HandoffTimelineState>({
    todayHandoffs: [],
    loading: true,
    error: null,
  });

  const dateKey = getDateKeyForScope(dayScope);

  /**
   * 指定日の申し送りデータを読み込み（Phase 8A: 2モード対応）
   */
  const loadToday = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let list: HandoffRecord[];

      if (handoffConfig.storage === 'sharepoint') {
        // SharePoint API モード
        list = await handoffApi.getHandoffRecords(dayScope, timeFilter);
      } else {
        // localStorage モード（開発用）
        const store = loadStorage();
        const sourceLists = dayScope === 'week'
          ? getRecentDateKeys(7).map(key => store[key] ?? [])
          : [store[dateKey ?? getTodayKey()] ?? []];

        list = sourceLists
          .flat()
          .slice()
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      }

      setState({
        todayHandoffs: list,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        todayHandoffs: [],
        loading: false,
        error: handoffConfig.storage === 'sharepoint'
          ? 'SharePoint からのデータ取得に失敗しました'
          : 'ローカルデータの読み込みに失敗しました',
      });
      console.error('[handoff] Load failed:', error);
    }
  }, [dateKey, dayScope, timeFilter]);

  /**
   * 新規申し送りを作成（Phase 8A: 2モード対応）
   */
  const createHandoff = useCallback(
    async (input: NewHandoffInput) => {
      const now = new Date();

      let newRecord: HandoffRecord;

      if (handoffConfig.storage === 'sharepoint') {
        // SharePoint API モード
        try {
          newRecord = await handoffApi.createHandoffRecord(input);

          // 楽観的更新: UIに即座反映
          setState(prev => ({
            ...prev,
            todayHandoffs: [newRecord, ...prev.todayHandoffs],
          }));
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: '申し送りの作成に失敗しました',
          }));
          console.error('[handoff] SharePoint create failed:', error);
          throw new Error('申し送りの作成に失敗しました');
        }
      } else {
        // localStorage モード（開発用）
        const id = generateId();

        newRecord = {
          id,
          title: input.title || generateTitleFromMessage(input.message),
          message: input.message,
          userCode: input.userCode,
          userDisplayName: input.userDisplayName,
          category: input.category,
          severity: input.severity,
          status: '未対応', // 新規作成時は常に未対応
          timeBand: input.timeBand,
          meetingSessionKey: input.meetingSessionKey,
          createdAt: now.toISOString(),
          createdByName: 'システム利用者', // TODO: 実際のユーザー情報を設定
          isDraft: false,
        };

        // 楽観的更新: まずUIに即座反映
        setState(prev => ({
          ...prev,
          todayHandoffs: [newRecord, ...prev.todayHandoffs],
        }));

        try {
          // localStorage に永続化（常に今日の日付で保存）
          const todayKey = getTodayKey(); // 新規作成は常に今日
          const store = loadStorage();
          const existing = store[todayKey] ?? [];
          store[todayKey] = [newRecord, ...existing];
          saveStorage(store);
        } catch (e) {
          // エラー時は楽観的更新を取り消し
          setState(prev => ({
            ...prev,
            todayHandoffs: prev.todayHandoffs.filter(item => item.id !== id),
            error: '申し送りの保存に失敗しました',
          }));

          console.error('[handoff] Save failed:', e);
          throw new Error('申し送りの保存に失敗しました');
        }
      }

      // 監査ログ記録（fire-and-forget: UXをブロックしない）
      const changedBy = account?.name ?? account?.username ?? newRecord.createdByName;
      const changedByAccount = account?.username ?? 'unknown';
      auditApi.recordCreation(
        newRecord.id,
        changedBy,
        changedByAccount,
      ).catch(e => {
        console.warn('[handoff-audit] 新規作成の監査ログ記録に失敗:', e);
      });

      console.log('[handoff] Created:', {
        id: newRecord.id,
        userDisplayName: newRecord.userDisplayName,
        category: newRecord.category,
        severity: newRecord.severity,
      });

      // Phase 9: 全 handoff キャッシュを無効化
      // → useHandoffSummary (KPI) + useHandoffTimeline が再取得
      // → CommandBar がフラッシュアニメーション付きで更新
      void queryClient.invalidateQueries({ queryKey: handoffKeys.all });
    },
    [auditApi, account, queryClient], // auditApi, account, queryClient 依存
  );

  /**
   * 申し送りの状態を更新（Phase 8A: 2モード対応 + v3: carryOverDate対応）
   * v2.1: 成功時に監査ログを自動記録
   */
  const updateHandoffStatus = useCallback(
    async (id: number, newStatus: HandoffRecord['status'], carryOverDate?: string) => {
      // 変更前のステータスを記録（監査ログ用）
      const targetRecord = state.todayHandoffs.find(item => item.id === id);
      const oldStatus = targetRecord?.status;

      // 楽観的更新
      const previousState = state.todayHandoffs;
      setState(prev => ({
        ...prev,
        todayHandoffs: prev.todayHandoffs.map(item =>
          item.id === id ? { ...item, status: newStatus, ...(carryOverDate ? { carryOverDate } : {}) } : item
        ),
      }));

      try {
        if (handoffConfig.storage === 'sharepoint') {
          // SharePoint API モード (v3: carryOverDate も渡す)
          await handoffApi.updateHandoffRecord(id.toString(), {
            status: newStatus,
            ...(carryOverDate ? { carryOverDate } : {}),
          });
        } else {
          // localStorage モード（開発用）
          const store = loadStorage();
          if (dayScope === 'week') {
            let storeUpdated = false;
            for (const key of Object.keys(store)) {
              const bucket = store[key];
              if (!Array.isArray(bucket)) continue;
              let bucketUpdated = false;
              const nextBucket = bucket.map(item => {
                if (item.id !== id) {
                  return item;
                }
                bucketUpdated = bucketUpdated || item.status !== newStatus;
                return { ...item, status: newStatus };
              });
              if (bucketUpdated) {
                store[key] = nextBucket;
                storeUpdated = true;
              }
            }
            if (storeUpdated) {
              saveStorage(store);
            }
          } else if (dateKey) {
            const existing = store[dateKey] ?? [];
            const updated = existing.map(item =>
              item.id === id ? { ...item, status: newStatus } : item
            );
            store[dateKey] = updated;
            saveStorage(store);
          }
        }

        // 監査ログ記録（fire-and-forget: UXをブロックしない）
        const changedBy = account?.name ?? account?.username ?? 'システム';
        const changedByAccount = account?.username ?? 'unknown';
        auditApi.recordStatusChange(
          id,
          oldStatus ?? '不明',
          newStatus,
          changedBy,
          changedByAccount,
        ).catch(e => {
          console.warn('[handoff-audit] ステータス変更の監査ログ記録に失敗:', e);
        });

        console.log('[handoff] Status updated:', { id, oldStatus, newStatus });

        // Phase 9: 全 handoff キャッシュを無効化
        void queryClient.invalidateQueries({ queryKey: handoffKeys.all });
      } catch (error) {
        // エラー時は楽観的更新を取り消し
        setState(prev => ({
          ...prev,
          todayHandoffs: previousState,
          error: handoffConfig.storage === 'sharepoint'
            ? 'SharePoint での状態更新に失敗しました'
            : '状態更新に失敗しました',
        }));
        console.error('[handoff] Status update failed:', error);
        throw new Error('状態更新に失敗しました');
      }
    },
    [dateKey, state.todayHandoffs, auditApi, account, queryClient],
  );

  // 初回ロード
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // 時間帯フィルタ適用
  const filteredHandoffs = useMemo(() => {
    if (timeFilter === 'all') return state.todayHandoffs;

    const allowedTimeBands = HANDOFF_TIME_FILTER_PRESETS[timeFilter];
    return state.todayHandoffs.filter(handoff =>
      allowedTimeBands.includes(handoff.timeBand)
    );
  }, [state.todayHandoffs, timeFilter]);

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

/**
 * 申し送りタイムライン管理フック
 *
 * v1.0: localStorage mock実装
 * v1.1: 時間帯フィルタ対応（Step 7B）
 * v2.0: SharePoint API対応（Phase 8A）
 * v2.1: 監査ログ自動記録（ステータス変更・新規作成）
 * v3.0: Ports & Adapters 化 — Factory 経由でインフラ層にアクセス
 * v3.1: 硬化 Phase 1 — Stale Closure / Race 対策
 *       - 関数型更新 (prev => ...) ベースに統一
 *       - ロールバック用 snapshot を functional update 内で取得
 *       - 同一 handoff ID への並行リクエストを排他制御 (inflightIds)
 *
 * @see domain/HandoffRepository.ts — Port
 * @see infra/handoffRepositoryFactory.ts — Factory + Adapter
 * @see hooks/useHandoffData.ts — Factory-aware Hook
 * @see domain/handoffActions.ts — Action 判定 Pure Functions
 */

import { useAuth } from '@/auth/useAuth';
import { auditLog } from '@/lib/debugLogger';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    classifyAuditPersistError,
    logAuditPersistFailed,
    logHandoffCreated,
    logStatusChanged,
} from './actions/handoffActions.logger';
import { toErrorMessage } from './handoffLoggerUtils';
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
 * 申し送りタイムライン管理フック（v3.1: Stale Closure / Race 対策済み）
 *
 * v3.1 変更点:
 * - updateHandoffStatus を関数型更新ベースに統一（stale closure 防止）
 * - ロールバック用 snapshot を functional update 内で取得
 * - 同一 handoff ID への並行リクエストを排他制御（inflightIds）
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

  // ── A-1: 連打ガード — 同一 ID への並行リクエストを排他制御 ──
  const inflightIdsRef = useRef<Set<number>>(new Set());

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
      auditLog.error('handoff', 'timeline.load_failed', { error: toErrorMessage(error) });
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
        // changedBy = 表示名（UI用）, changedByAccount = UPN（監査証跡用）
        const displayName = account?.name ?? account?.username ?? 'unknown';
        const accountId = account?.username ?? 'unknown';
        auditRepo.recordCreation(
          newRecord.id,
          displayName,
          accountId,
        ).catch(e => {
          logAuditPersistFailed({
            handoffId: newRecord.id,
            action: 'creation',
            errorClass: classifyAuditPersistError(e),
            message: e instanceof Error ? e.message : String(e),
          });
        });

        logHandoffCreated({
          id: newRecord.id,
          category: newRecord.category,
          severity: newRecord.severity,
          changedByAccount: accountId,
          source: 'useHandoffTimeline',
        });
      } catch {
        setState(prev => ({
          ...prev,
          error: '申し送りの作成に失敗しました',
        }));
        throw new Error('申し送りの作成に失敗しました');
      }
    },
    [repo, auditRepo, account],
  );

  /**
   * 申し送りの状態を更新（楽観的更新 + ロールバック）
   *
   * v3.1: Stale closure / Race condition 対策
   * - 関数型更新 (prev => ...) で常に最新 state を起点に計算
   * - ロールバック用 snapshot を楽観更新時に取得（クロージャ依存を排除）
   * - inflightIds で同一 ID への並行リクエストを排他制御
   */
  const updateHandoffStatus = useCallback(
    async (id: number, newStatus: HandoffRecord['status'], carryOverDate?: string) => {
      // ── 連打ガード: 同一 ID が処理中なら早期 return ──
      if (inflightIdsRef.current.has(id)) {
        auditLog.warn('handoff', 'timeline.concurrent_update_blocked', { id, newStatus });
        return;
      }
      inflightIdsRef.current.add(id);

      // ── 楽観更新と snapshot 取得を同一の関数型更新内で行う ──
      // これにより stale closure で古い state を参照するリスクをゼロにする
      let snapshotBeforeUpdate: HandoffRecord[] = [];
      let oldStatus: string = '不明';

      setState(prev => {
        // snapshot: 楽観更新前の状態を保存（ロールバック用）
        snapshotBeforeUpdate = prev.todayHandoffs;
        // oldStatus: 変更前ステータスを取得（監査ログ用）
        const target = prev.todayHandoffs.find(item => item.id === id);
        oldStatus = target?.status ?? '不明';

        return {
          ...prev,
          todayHandoffs: prev.todayHandoffs.map(item =>
            item.id === id
              ? { ...item, status: newStatus, ...(carryOverDate ? { carryOverDate } : {}) }
              : item,
          ),
        };
      });

      try {
        await repo.updateStatus(id, newStatus, dayScope, carryOverDate);

        // 監査ログ記録（fire-and-forget）
        // changedBy = 表示名（UI用）, changedByAccount = UPN（監査証跡用）
        const displayName = account?.name ?? account?.username ?? 'unknown';
        const accountId = account?.username ?? 'unknown';
        auditRepo.recordStatusChange(
          id,
          oldStatus,
          newStatus,
          displayName,
          accountId,
        ).catch(e => {
          logAuditPersistFailed({
            handoffId: id,
            action: 'status_change',
            errorClass: classifyAuditPersistError(e),
            message: e instanceof Error ? e.message : String(e),
          });
        });

        logStatusChanged({
          id,
          oldStatus,
          newStatus,
          meetingMode: 'unknown',
          changedByAccount: accountId,
          source: 'useHandoffTimeline',
        });
      } catch {
        // ── ロールバック: 楽観更新を snapshot で巻き戻す ──
        setState(prev => ({
          ...prev,
          todayHandoffs: snapshotBeforeUpdate,
          error: '状態更新に失敗しました',
        }));
        throw new Error('状態更新に失敗しました');
      } finally {
        // ── 排他制御解除 ──
        inflightIdsRef.current.delete(id);
      }
    },
    [repo, auditRepo, dayScope, account],
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

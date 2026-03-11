/**
 * handoffApi.ts — SharePoint API wrapper for the handoff feature.
 *
 * Refactored in NR23: Internal infrastructure classes extracted to dedicated files.
 * - HandoffCache + OptimisticUpdateManager → handoffApiCache.ts
 * - CarryOverDateStore                     → handoffStorageUtils.ts
 *
 * Public API is unchanged:
 *   useHandoffApi, createHandoffApi, CarryOverDateStore (re-exported)
 *
 * Phase 8B: キャッシュ戦略とエラーハンドリング強化
 * v3: CarryOverDateStore によるローカル補完対応
 */
import { auditLog } from '@/lib/debugLogger';
import { buildHandoffSelectFields } from '@/sharepoint/fields';
import { useMemo } from 'react';
import type { UseSP } from '../../lib/spClient';
import { useSP } from '../../lib/spClient';
import { generateTitleFromMessage } from './generateTitleFromMessage';
import { HandoffCache, OptimisticUpdateManager } from './handoffApiCache';
import { handoffConfig } from './handoffConfig';
import { toErrorMessage } from './handoffLoggerUtils';
import {
    fromSpHandoffItem,
    toSpHandoffCreatePayload,
    toSpHandoffUpdatePayload,
} from './handoffMappers';
import { isTerminalStatus } from './handoffStateMachine';
import { CarryOverDateStore } from './handoffStorageUtils';
import type {
    HandoffDayScope,
    HandoffRecord,
    HandoffTimeFilter,
    NewHandoffInput,
    SpHandoffItem,
} from './handoffTypes';

// Re-export CarryOverDateStore for backward compatibility.
// External code that imports from './handoffApi' continues to work unchanged.
export { CarryOverDateStore };

/**
 * SharePoint API ラッパークラス（最適化版）
 * 申し送りタイムライン機能の SharePoint データ操作を担当
 * Phase 8B: キャッシュ戦略、楽観的更新、エラーハンドリング強化
 * v3: CarryOverDateStore によるローカル補完対応
 */
class HandoffApi {
  private cache = new HandoffCache();
  private optimisticManager = new OptimisticUpdateManager();
  private sp: UseSP;

  constructor(sp: UseSP) {
    this.sp = sp;
  }

  /**
   * エラーリトライ機能付きの SP クライアント呼び出し
   */
  private async callWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 500
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // リトライ不可能なエラーは即座に throw
        if (error instanceof Error && error.message.includes('404')) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw lastError!;
  }

  /**
   * 指定条件で申し送り記録を取得（最適化版）
   * Phase 8B: キャッシュ戦略と ETag 活用
   */
  async getHandoffRecords(
    dayScope: HandoffDayScope = 'today',
    timeFilter: HandoffTimeFilter = 'all'
  ): Promise<HandoffRecord[]> {
    const cacheKey = `handoff:${dayScope}:${timeFilter}`;

    // キャッシュから取得を試行
    const cached = this.cache.get<HandoffRecord[]>(cacheKey);
    if (cached) {
      return this.optimisticManager.applyPendingUpdates(cached);
    }

    return this.callWithRetry(async () => {
      let filterQuery = '';
      const now = new Date();

      // 日付フィルタリング
      if (dayScope === 'today') {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        filterQuery = `CreatedAt ge '${startOfDay.toISOString()}' and CreatedAt le '${endOfDay.toISOString()}'`;
      } else if (dayScope === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(yesterday);
        startOfYesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        filterQuery = `CreatedAt ge '${startOfYesterday.toISOString()}' and CreatedAt le '${endOfYesterday.toISOString()}'`;
      } else if (dayScope === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        filterQuery = `CreatedAt ge '${weekAgo.toISOString()}'`;
      }

      // 時間帯フィルタリングを追加
      if (timeFilter !== 'all' && filterQuery) {
        filterQuery += ` and TimeBand eq '${timeFilter}'`;
      } else if (timeFilter !== 'all') {
        filterQuery = `TimeBand eq '${timeFilter}'`;
      }

      // 🔥 動的フィールド取得：テナント差分に完全対応
      const existingFields = await this.sp.getListFieldInternalNames(handoffConfig.listTitle);
      const selectArray = buildHandoffSelectFields(Array.from(existingFields));
      const selectFields = selectArray.join(',');
      let query = `?$select=${selectFields}&$orderby=CreatedAt desc`;

      if (filterQuery) {
        query += `&$filter=${filterQuery}`;
      }

      const response = await this.sp.spFetch(`lists/getbytitle('${handoffConfig.listTitle}')/items${query}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch handoffs: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const items: SpHandoffItem[] = data.value || [];

      const records = items.map(fromSpHandoffItem);

      // v3: CarryOverDateStore からのローカル補完マージ
      const mergedRecords = records.map(record => {
        if (!record.carryOverDate) {
          const localDate = CarryOverDateStore.get(record.id);
          if (localDate) {
            return { ...record, carryOverDate: localDate };
          }
        }
        return record;
      });

      // キャッシュに保存（ETag も保存）
      const etag = response.headers?.get('etag') ?? undefined;
      this.cache.set(cacheKey, mergedRecords, etag);

      return this.optimisticManager.applyPendingUpdates(mergedRecords);
    });
  }

  /**
   * 新しい申し送り記録を作成（楽観的更新版）
   * Phase 8B: 楽観的更新で即座に UI 反映
   */
  async createHandoffRecord(input: NewHandoffInput): Promise<HandoffRecord> {
    const title = generateTitleFromMessage(input.message);

    this.invalidateRelatedCaches();

    try {
      const payload = toSpHandoffCreatePayload({ ...input, title });
      const response = await this.callWithRetry(async () => {
        const res = await this.sp.spFetch(
          `lists/getbytitle('${handoffConfig.listTitle}')/items`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json;odata=verbose' },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          throw new Error(`Failed to create handoff: ${res.status} ${res.statusText}`);
        }
        return { data: await res.json() };
      });

      const actualRecord = fromSpHandoffItem(response.data);
      this.invalidateRelatedCaches();
      return actualRecord;
    } catch (error) {
      this.invalidateRelatedCaches();
      auditLog.error('handoff', 'api.create_failed', { error: toErrorMessage(error) });
      throw new Error('申し送り記録の作成に失敗しました');
    }
  }

  /**
   * 申し送り記録を更新（楽観的更新版 + v3: carryOverDate 対応）
   */
  async updateHandoffRecord(
    id: string,
    updates: Partial<Pick<HandoffRecord, 'status' | 'severity' | 'category' | 'message' | 'title' | 'carryOverDate'>>
  ): Promise<HandoffRecord> {
    // v3: CarryOverDateStore の更新（SP 更新より先にローカルを書く）
    if (updates.status === '明日へ持越' && updates.carryOverDate) {
      CarryOverDateStore.set(id, updates.carryOverDate);
    } else if (updates.status && isTerminalStatus(updates.status)) {
      CarryOverDateStore.clear(id);
    }

    this.optimisticManager.setPendingUpdate(id, updates);

    try {
      const payload = toSpHandoffUpdatePayload(updates);

      await this.callWithRetry(async () => {
        const res = await this.sp.spFetch(
          `lists/getbytitle('${handoffConfig.listTitle}')/items(${id})`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json;odata=verbose',
              'If-Match': '*',
            },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          throw new Error(`Failed to update handoff: ${res.status} ${res.statusText}`);
        }
        return res;
      });

      // 更新後のデータを取得
      const existingFields = await this.sp.getListFieldInternalNames(handoffConfig.listTitle);
      const selectArray = buildHandoffSelectFields(Array.from(existingFields));
      const selectFields = selectArray.join(',');
      const response = await this.sp.spFetch(
        `lists/getbytitle('${handoffConfig.listTitle}')/items(${id})?$select=${selectFields}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch updated handoff: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const updatedRecord = fromSpHandoffItem(data);

      // v3: ローカル補完マージ
      if (!updatedRecord.carryOverDate) {
        const localDate = CarryOverDateStore.get(id);
        if (localDate) {
          updatedRecord.carryOverDate = localDate;
        }
      }

      this.optimisticManager.clearPendingUpdate(id);
      this.invalidateRelatedCaches();
      return updatedRecord;
    } catch (error) {
      this.optimisticManager.clearPendingUpdate(id);
      auditLog.error('handoff', 'api.update_failed', { error: toErrorMessage(error) });
      throw new Error('申し送り記録の更新に失敗しました');
    }
  }

  /**
   * 申し送り記録を削除
   */
  async deleteHandoffRecord(id: string): Promise<void> {
    try {
      const response = await this.sp.spFetch(
        `lists/getbytitle('${handoffConfig.listTitle}')/items(${id})`,
        {
          method: 'DELETE',
          headers: { 'If-Match': '*' },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete handoff: ${response.status} ${response.statusText}`);
      }

      this.invalidateRelatedCaches();
    } catch (error) {
      auditLog.error('handoff', 'api.delete_failed', { error: toErrorMessage(error) });
      throw new Error('申し送り記録の削除に失敗しました');
    }
  }

  /**
   * ユーザー別の申し送り記録を取得
   */
  async getUserHandoffRecords(
    userCode: string,
    dayScope: HandoffDayScope = 'today',
    timeFilter: HandoffTimeFilter = 'all'
  ): Promise<HandoffRecord[]> {
    try {
      let filterQuery = `UserCode eq '${userCode}'`;
      const now = new Date();

      if (dayScope === 'today') {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        filterQuery += ` and CreatedAt ge '${startOfDay.toISOString()}' and CreatedAt le '${endOfDay.toISOString()}'`;
      } else if (dayScope === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(yesterday);
        startOfYesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        filterQuery += ` and CreatedAt ge '${startOfYesterday.toISOString()}' and CreatedAt le '${endOfYesterday.toISOString()}'`;
      }

      if (timeFilter !== 'all') {
        filterQuery += ` and TimeBand eq '${timeFilter}'`;
      }

      const existingFields = await this.sp.getListFieldInternalNames(handoffConfig.listTitle);
      const selectArray = buildHandoffSelectFields(Array.from(existingFields));
      const selectFields = selectArray.join(',');
      const query = `?$select=${selectFields}&$filter=${filterQuery}&$orderby=CreatedAt desc`;

      const response = await this.sp.spFetch(`lists/getbytitle('${handoffConfig.listTitle}')/items${query}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch important handoffs: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const items: SpHandoffItem[] = data.value || [];
      return items.map(fromSpHandoffItem);
    } catch (error) {
      auditLog.error('handoff', 'api.get_user_records_failed', { error: toErrorMessage(error) });
      throw new Error('ユーザー別申し送り記録の取得に失敗しました');
    }
  }

  /**
   * 会議セッション用の申し送り記録を取得
   */
  async getMeetingHandoffRecords(meetingSessionKey: string): Promise<HandoffRecord[]> {
    try {
      const filterQuery = `MeetingSessionKey eq '${meetingSessionKey}'`;
      const existingFields = await this.sp.getListFieldInternalNames(handoffConfig.listTitle);
      const selectArray = buildHandoffSelectFields(Array.from(existingFields));
      const selectFields = selectArray.join(',');
      const query = `?$select=${selectFields}&$filter=${filterQuery}&$orderby=CreatedAt desc`;

      const response = await this.sp.spFetch(`lists/getbytitle('${handoffConfig.listTitle}')/items${query}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch meeting handoffs: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const items: SpHandoffItem[] = data.value || [];
      return items.map(fromSpHandoffItem);
    } catch (error) {
      auditLog.error('handoff', 'api.get_meeting_records_failed', { error: toErrorMessage(error) });
      throw new Error('会議用申し送り記録の取得に失敗しました');
    }
  }

  /**
   * 申し送り統計データを取得
   */
  async getHandoffSummaryStats(dayScope: HandoffDayScope = 'today'): Promise<{
    totalCount: number;
    categoryStats: Record<string, number>;
    severityStats: Record<string, number>;
    statusStats: Record<string, number>;
    timeBandStats: Record<string, number>;
  }> {
    try {
      const records = await this.getHandoffRecords(dayScope, 'all');

      const categoryStats: Record<string, number> = {};
      const severityStats: Record<string, number> = {};
      const statusStats: Record<string, number> = {};
      const timeBandStats: Record<string, number> = {};

      records.forEach(record => {
        categoryStats[record.category] = (categoryStats[record.category] || 0) + 1;
        severityStats[record.severity] = (severityStats[record.severity] || 0) + 1;
        statusStats[record.status] = (statusStats[record.status] || 0) + 1;
        timeBandStats[record.timeBand] = (timeBandStats[record.timeBand] || 0) + 1;
      });

      return { totalCount: records.length, categoryStats, severityStats, statusStats, timeBandStats };
    } catch (error) {
      auditLog.error('handoff', 'api.get_stats_failed', { error: toErrorMessage(error) });
      throw new Error('申し送り統計の取得に失敗しました');
    }
  }

  /** 関連キャッシュの無効化 */
  private invalidateRelatedCaches(): void {
    this.cache.invalidateByPrefix('handoff:');
  }
}

// ────────────────────────────────────────────────────────────
// Public exports
// ────────────────────────────────────────────────────────────

/** HandoffApi 用の React フック */
export const useHandoffApi = () => {
  const sp = useSP();
  return useMemo(() => new HandoffApi(sp), [sp]);
};

/** 後方互換性のため（テストはこのファクトリ経由でインスタンスを生成） */
export const createHandoffApi = (sp: UseSP) => new HandoffApi(sp);

import { useMemo } from 'react';
import type { UseSP } from '../../lib/spClient';
import { useSP } from '../../lib/spClient';
import { generateTitleFromMessage } from './generateTitleFromMessage';
import { handoffConfig } from './handoffConfig';
import {
    HANDOFF_TIMELINE_COLUMNS,
    HandoffDayScope,
    HandoffRecord,
    HandoffTimeFilter,
    NewHandoffInput,
    SpHandoffItem,
    fromSpHandoffItem,
    toSpHandoffCreatePayload,
    toSpHandoffUpdatePayload,
} from './handoffTypes';

/**
 * Phase 8B: パフォーマンス最適化
 * キャッシュ戦略とエラーハンドリング強化
 */

// TTLキャッシュ (15秒)
const CACHE_TTL_MS = 15_000;
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  etag?: string;
};

class HandoffCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > CACHE_TTL_MS;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, etag?: string): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
    });
    this.cleanup();
  }

  getETag(key: string): string | null {
    const entry = this.cache.get(key);
    return entry?.etag || null;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // 容量制限（LRU風）
  private cleanup(): void {
    if (this.cache.size > 100) {
      const oldEntries = Array.from(this.cache.entries())
        .filter(([, entry]) => this.isExpired(entry))
        .slice(0, 20);
      oldEntries.forEach(([key]) => this.cache.delete(key));
    }
  }
}

// 楽観的更新の状態管理
class OptimisticUpdateManager {
  private pendingUpdates = new Map<string, Partial<HandoffRecord>>();

  setPendingUpdate(id: string, update: Partial<HandoffRecord>): void {
    this.pendingUpdates.set(id, update);
  }

  getPendingUpdate(id: string): Partial<HandoffRecord> | null {
    return this.pendingUpdates.get(id) || null;
  }

  clearPendingUpdate(id: string): void {
    this.pendingUpdates.delete(id);
  }

  applyPendingUpdates(records: HandoffRecord[]): HandoffRecord[] {
    return records.map(record => {
      const pending = this.getPendingUpdate(String(record.id));
      return pending ? { ...record, ...pending } : record;
    });
  }
}

/**
 * SharePoint API ラッパークラス（最適化版）
 * 申し送りタイムライン機能のSharePointデータ操作を担当
 * Phase 8B: キャッシュ戦略、楽観的更新、エラーハンドリング強化
 */
class HandoffApi {
  private cache = new HandoffCache();
  private optimisticManager = new OptimisticUpdateManager();
  private sp: UseSP;

  constructor(sp: UseSP) {
    this.sp = sp;
  }

  /**
   * エラーリトライ機能付きのSPクライアント呼び出し
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
   * Phase 8B: キャッシュ戦略とETag活用
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

      const selectFields = Object.keys(HANDOFF_TIMELINE_COLUMNS).join(',');
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

      // キャッシュに保存（ETagも保存）
      const etag = response.headers?.get('etag') ?? undefined;
      this.cache.set(cacheKey, records, etag);

      return this.optimisticManager.applyPendingUpdates(records);
    });
  }

  /**
   * 新しい申し送り記録を作成（楽観的更新版）
   * Phase 8B: 楽観的更新で即座にUI反映
   */
  async createHandoffRecord(input: NewHandoffInput): Promise<HandoffRecord> {
    // タイトル自動生成
    const title = generateTitleFromMessage(input.message);

    // 即座にキャッシュを無効化（楽観的更新）
    this.invalidateRelatedCaches();

    // バックグラウンドで実際のAPI呼び出し
    try {
      const payload = toSpHandoffCreatePayload({ ...input, title });
      const response = await this.callWithRetry(async () => {
        const res = await this.sp.spFetch(
          `lists/getbytitle('${handoffConfig.listTitle}')/items`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json;odata=verbose',
            },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          throw new Error(`Failed to create handoff: ${res.status} ${res.statusText}`);
        }
        return { data: await res.json() };
      });

      const actualRecord = fromSpHandoffItem(response.data);

      // 実際のレコードでキャッシュを更新
      this.invalidateRelatedCaches();

      return actualRecord;
    } catch (error) {
      // エラー時は楽観的更新をロールバック
      this.invalidateRelatedCaches();
      console.error('申し送り記録作成エラー:', error);
      throw new Error('申し送り記録の作成に失敗しました');
    }
  }

  /**
   * 申し送り記録を更新（楽観的更新版）
   */
  async updateHandoffRecord(
    id: string,
    updates: Partial<Pick<HandoffRecord, 'status' | 'severity' | 'category' | 'message' | 'title'>>
  ): Promise<HandoffRecord> {
    // 楽観的更新を設定
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
      const selectFields = Object.keys(HANDOFF_TIMELINE_COLUMNS).join(',');
      const response = await this.sp.spFetch(
        `lists/getbytitle('${handoffConfig.listTitle}')/items(${id})?$select=${selectFields}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch updated handoff: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const updatedRecord = fromSpHandoffItem(data);

      // 楽観的更新をクリア
      this.optimisticManager.clearPendingUpdate(id);
      this.invalidateRelatedCaches();

      return updatedRecord;
    } catch (error) {
      // エラー時は楽観的更新をロールバック
      this.optimisticManager.clearPendingUpdate(id);
      console.error('申し送り記録更新エラー:', error);
      throw new Error('申し送り記録の更新に失敗しました');
    }
  }

  /**
   * 関連キャッシュの無効化
   */
  private invalidateRelatedCaches(): void {
    this.cache.invalidateByPrefix('handoff:');
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
          headers: {
            'If-Match': '*'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete handoff: ${response.status} ${response.statusText}`);
      }

      this.invalidateRelatedCaches();
    } catch (error) {
      console.error('申し送り記録削除エラー:', error);
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

      // 日付フィルタリング追加
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

      // 時間帯フィルタリング追加
      if (timeFilter !== 'all') {
        filterQuery += ` and TimeBand eq '${timeFilter}'`;
      }

      const selectFields = Object.keys(HANDOFF_TIMELINE_COLUMNS).join(',');
      const query = `?$select=${selectFields}&$filter=${filterQuery}&$orderby=CreatedAt desc`;

      const response = await this.sp.spFetch(`lists/getbytitle('${handoffConfig.listTitle}')/items${query}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch important handoffs: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const items: SpHandoffItem[] = data.value || [];

      return items.map(fromSpHandoffItem);
    } catch (error) {
      console.error('ユーザー別申し送り記録取得エラー:', error);
      throw new Error('ユーザー別申し送り記録の取得に失敗しました');
    }
  }

  /**
   * 会議セッション用の申し送り記録を取得
   */
  async getMeetingHandoffRecords(
    meetingSessionKey: string
  ): Promise<HandoffRecord[]> {
    try {
      const filterQuery = `MeetingSessionKey eq '${meetingSessionKey}'`;
      const selectFields = Object.keys(HANDOFF_TIMELINE_COLUMNS).join(',');
      const query = `?$select=${selectFields}&$filter=${filterQuery}&$orderby=CreatedAt desc`;

      const response = await this.sp.spFetch(`lists/getbytitle('${handoffConfig.listTitle}')/items${query}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch meeting handoffs: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const items: SpHandoffItem[] = data.value || [];

      return items.map(fromSpHandoffItem);
    } catch (error) {
      console.error('会議用申し送り記録取得エラー:', error);
      throw new Error('会議用申し送り記録の取得に失敗しました');
    }
  }

  /**
   * 申し送り統計データを取得
   */
  async getHandoffSummaryStats(
    dayScope: HandoffDayScope = 'today'
  ): Promise<{
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

      return {
        totalCount: records.length,
        categoryStats,
        severityStats,
        statusStats,
        timeBandStats,
      };
    } catch (error) {
      console.error('申し送り統計取得エラー:', error);
      throw new Error('申し送り統計の取得に失敗しました');
    }
  }
}

// HandoffApi用のフック
export const useHandoffApi = () => {
  const sp = useSP();
  return useMemo(() => new HandoffApi(sp), [sp]);
};

// 後方互換性のため
export const createHandoffApi = (sp: UseSP) => new HandoffApi(sp);
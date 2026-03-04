/**
 * handoffRepositoryFactory — Factory + Adapters
 *
 * 環境に応じた HandoffRepository / HandoffAuditRepository の生成。
 *
 * Adapter 一覧:
 * - localStorage: 開発用（デフォルト）
 * - sharepoint:   本番用（handoffConfig.storage === 'sharepoint'）
 *
 * ADR 準拠:
 * - Plain Object Adapter (ADR-1: class の this 問題回避)
 * - シングルトンキャッシュなし (ADR-2: React レンダサイクルとの整合)
 * - 環境検出は handoffConfig.storage のまま利用
 */

import type { HandoffAuditRepository, HandoffRepository } from '../domain/HandoffRepository';
import type { HandoffDayScope, HandoffRecord, HandoffStatus, HandoffTimeFilter, NewHandoffInput } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Adapter 依存の型（Hook 呼び出し時に注入）
// ────────────────────────────────────────────────────────────

/**
 * SharePoint API フック群のインターフェース
 * useHandoffApi() / useHandoffAuditApi() の戻り値を抽象化
 */
export type HandoffApiHooks = {
  handoffApi: {
    getHandoffRecords: (dayScope: HandoffDayScope, timeFilter: HandoffTimeFilter) => Promise<HandoffRecord[]>;
    createHandoffRecord: (input: NewHandoffInput) => Promise<HandoffRecord>;
    updateHandoffRecord: (id: string, updates: { status: HandoffStatus; carryOverDate?: string }) => Promise<unknown>;
  };
  auditApi: {
    recordStatusChange: (id: number, oldStatus: string, newStatus: string, changedBy: string, changedByAccount: string) => Promise<unknown>;
    recordCreation: (id: number, createdBy: string, createdByAccount: string) => Promise<unknown>;
  };
};

// ────────────────────────────────────────────────────────────
// localStorage Adapter
// ────────────────────────────────────────────────────────────

import { generateTitleFromMessage } from '../generateTitleFromMessage';
import { HANDOFF_TIME_FILTER_PRESETS } from '../handoffConstants';
import {
    generateId,
    getDateKeyForScope,
    getRecentDateKeys,
    getTodayKey,
    loadStorage,
    saveStorage,
} from '../handoffStorageUtils';

function createLocalStorageHandoffAdapter(): HandoffRepository {
  return {
    async getRecords(dayScope, timeFilter) {
      const store = loadStorage();
      const sourceLists = dayScope === 'week'
        ? getRecentDateKeys(7).map(key => store[key] ?? [])
        : [store[getDateKeyForScope(dayScope) ?? getTodayKey()] ?? []];

      let list = sourceLists
        .flat()
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      // 時間帯フィルタ適用
      if (timeFilter !== 'all') {
        const allowed = HANDOFF_TIME_FILTER_PRESETS[timeFilter];
        list = list.filter(h => allowed.includes(h.timeBand));
      }

      return list;
    },

    async createRecord(input) {
      const id = generateId();
      const newRecord: HandoffRecord = {
        id,
        title: input.title || generateTitleFromMessage(input.message),
        message: input.message,
        userCode: input.userCode,
        userDisplayName: input.userDisplayName,
        category: input.category,
        severity: input.severity,
        status: '未対応',
        timeBand: input.timeBand,
        meetingSessionKey: input.meetingSessionKey,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceUrl: input.sourceUrl,
        sourceKey: input.sourceKey,
        sourceLabel: input.sourceLabel,
        createdAt: new Date().toISOString(),
        createdByName: 'システム利用者',
        isDraft: false,
      };

      const todayKey = getTodayKey();
      const store = loadStorage();
      const existing = store[todayKey] ?? [];
      store[todayKey] = [newRecord, ...existing];
      saveStorage(store);

      return newRecord;
    },

    async updateStatus(id, newStatus, dayScope, carryOverDate) {
      const store = loadStorage();
      const dateKey = getDateKeyForScope(dayScope);

      if (dayScope === 'week') {
        for (const key of Object.keys(store)) {
          const bucket = store[key];
          if (!Array.isArray(bucket)) continue;
          let bucketUpdated = false;
          const nextBucket = bucket.map(item => {
            if (item.id !== id) return item;
            bucketUpdated = true;
            return {
              ...item,
              status: newStatus,
              ...(carryOverDate ? { carryOverDate } : {}),
            };
          });
          if (bucketUpdated) {
            store[key] = nextBucket;
          }
        }
      } else if (dateKey) {
        const existing = store[dateKey] ?? [];
        store[dateKey] = existing.map(item =>
          item.id === id
            ? { ...item, status: newStatus, ...(carryOverDate ? { carryOverDate } : {}) }
            : item,
        );
      }
      saveStorage(store);
    },
  };
}

// ────────────────────────────────────────────────────────────
// SharePoint Adapter
// ────────────────────────────────────────────────────────────

function createSharePointHandoffAdapter(hooks: HandoffApiHooks): HandoffRepository {
  return {
    async getRecords(dayScope, timeFilter) {
      return hooks.handoffApi.getHandoffRecords(dayScope, timeFilter);
    },

    async createRecord(input) {
      return hooks.handoffApi.createHandoffRecord(input);
    },

    async updateStatus(id, newStatus, _dayScope, carryOverDate) {
      await hooks.handoffApi.updateHandoffRecord(id.toString(), {
        status: newStatus,
        ...(carryOverDate ? { carryOverDate } : {}),
      });
    },
  };
}

// ────────────────────────────────────────────────────────────
// Audit Adapter（共通: SP API ラッパー）
// ────────────────────────────────────────────────────────────

function createHandoffAuditAdapter(hooks: HandoffApiHooks): HandoffAuditRepository {
  return {
    async recordStatusChange(handoffId, oldStatus, newStatus, changedBy, changedByAccount) {
      await hooks.auditApi.recordStatusChange(handoffId, oldStatus, newStatus, changedBy, changedByAccount);
    },
    async recordCreation(handoffId, createdBy, createdByAccount) {
      await hooks.auditApi.recordCreation(handoffId, createdBy, createdByAccount);
    },
  };
}

// ────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────

import { handoffConfig } from '../handoffConfig';

export type HandoffRepositoryKind = 'local' | 'sharepoint';

function resolveKind(): HandoffRepositoryKind {
  return handoffConfig.storage === 'sharepoint' ? 'sharepoint' : 'local';
}

/**
 * HandoffRepository を生成する Factory 関数
 *
 * @param hooks - SharePoint 使用時に必要な API フック群
 *                localStorage モードではダミーを渡して OK
 */
export function createHandoffRepository(hooks: HandoffApiHooks): HandoffRepository {
  const kind = resolveKind();
  switch (kind) {
    case 'sharepoint':
      return createSharePointHandoffAdapter(hooks);
    case 'local':
    default:
      return createLocalStorageHandoffAdapter();
  }
}

/**
 * HandoffAuditRepository を生成する Factory 関数
 */
export function createHandoffAuditRepository(hooks: HandoffApiHooks): HandoffAuditRepository {
  return createHandoffAuditAdapter(hooks);
}

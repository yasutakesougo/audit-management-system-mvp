/**
 * handoffRepositoryFactory — Factory + Adapters
 *
 * 環境に応じた HandoffRepository / HandoffAuditRepository の生成。
 */

import { useMemo } from 'react';
import type { HandoffAuditRepository, HandoffRepository } from '../domain/HandoffRepository';
import type { HandoffDayScope, HandoffRecord, HandoffStatus, HandoffTimeFilter, NewHandoffInput } from '../handoffTypes';
import { useHandoffApi } from '../handoffApi';
import { useHandoffAuditApi } from '../handoffAuditApi';

// ────────────────────────────────────────────────────────────
// Adapter 依存の型
// ────────────────────────────────────────────────────────────

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
    async getRecords(dayScope: HandoffDayScope, timeFilter: HandoffTimeFilter) {
      const store = loadStorage();
      const sourceLists = dayScope === 'week'
        ? getRecentDateKeys(7).map(key => store[key] ?? [])
        : [store[getDateKeyForScope(dayScope) ?? getTodayKey()] ?? []];

      let list = sourceLists
        .flat()
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      if (timeFilter !== 'all') {
        const allowed = HANDOFF_TIME_FILTER_PRESETS[timeFilter];
        list = list.filter(h => allowed.includes(h.timeBand));
      }

      return list;
    },

    async createRecord(input: NewHandoffInput) {
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

    async updateStatus(id: string | number, newStatus: HandoffStatus, dayScope: HandoffDayScope, carryOverDate?: string) {
      const store = loadStorage();
      const dateKey = getDateKeyForScope(dayScope);
      const targetId = typeof id === 'string' ? parseInt(id, 10) : id;

      if (dayScope === 'week') {
        for (const key of Object.keys(store)) {
          const bucket = store[key];
          if (!Array.isArray(bucket)) continue;
          let bucketUpdated = false;
          const nextBucket = bucket.map(item => {
            if (item.id !== targetId) return item;
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
          item.id === targetId
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
    async getRecords(dayScope: HandoffDayScope, timeFilter: HandoffTimeFilter) {
      return hooks.handoffApi.getHandoffRecords(dayScope, timeFilter);
    },

    async createRecord(input: NewHandoffInput) {
      return hooks.handoffApi.createHandoffRecord(input);
    },

    async updateStatus(id: string | number, newStatus: HandoffStatus, _dayScope: HandoffDayScope, carryOverDate?: string) {
      await hooks.handoffApi.updateHandoffRecord(id.toString(), {
        status: newStatus,
        ...(carryOverDate ? { carryOverDate } : {}),
      });
    },
  };
}

// ────────────────────────────────────────────────────────────
// Audit Adapter
// ────────────────────────────────────────────────────────────

function createHandoffAuditAdapter(hooks: HandoffApiHooks): HandoffAuditRepository {
  return {
    async recordStatusChange(handoffId: number, oldStatus: string, newStatus: string, changedBy: string, changedByAccount: string) {
      await hooks.auditApi.recordStatusChange(handoffId, oldStatus, newStatus, changedBy, changedByAccount);
    },
    async recordCreation(handoffId: number, createdBy: string, createdByAccount: string) {
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

export function createHandoffAuditRepository(hooks: HandoffApiHooks): HandoffAuditRepository {
  return createHandoffAuditAdapter(hooks);
}

/**
 * React Hook: HandoffRepositories を取得する
 */
export function useHandoffRepository(): {
  repo: HandoffRepository;
  auditRepo: HandoffAuditRepository;
} {
  const handoffApi = useHandoffApi();
  const auditApi = useHandoffAuditApi();

  const hooks: HandoffApiHooks = useMemo(
    () => ({ handoffApi, auditApi }),
    [handoffApi, auditApi],
  );

  return useMemo(() => ({
    repo: createHandoffRepository(hooks),
    auditRepo: createHandoffAuditRepository(hooks),
  }), [hooks]);
}

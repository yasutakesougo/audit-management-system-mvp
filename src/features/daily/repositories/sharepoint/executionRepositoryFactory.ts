/**
 * executionRepositoryFactory — Factory for ExecutionRecordRepository.
 *
 * Mirrors the Procedure / DailyRecord factory pattern:
 *   domain/ExecutionRecordRepository.ts          → Port (interface)
 *   infra/executionRepositoryFactory.ts           → this file (Factory)
 *   stores/executionStore.ts                      → current Adapter (Zustand + localStorage)
 *
 * Currently there is only one adapter (localStorage-backed via ExecutionStore).
 * When a SharePoint or REST API adapter is created, add a new `kind` entry.
 *
 * @see ProcedureRepositoryFactory for the reference pattern.
 */
import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    shouldSkipLogin,
    readBool,
    readOptionalEnv,
} from '@/lib/env';
import type { ExecutionRecordRepository } from '../../domain/legacy/ExecutionRecordRepository';
import type { ExecutionRecord } from '../../domain/legacy/executionRecordTypes';
import { SharePointExecutionRecordRepository } from './SharePointExecutionRecordRepository';
import type { SpFetchFn } from '@/lib/sp/spLists';
import {
  normalizeExecutionDate,
  normalizeExecutionUserId,
  normalizeScheduleItemId,
} from '@/features/daily/utils/normalizeExecutionLookup';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type ExecutionRepositoryKind = 'local' | 'sharepoint';

// ────────────────────────────────────────────────────────────
// Environment detection
// ────────────────────────────────────────────────────────────

const shouldUseLocalRepository = (): boolean => {
  const providerParam =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('provider') : undefined;
  const providerEnv = readOptionalEnv('VITE_DATA_PROVIDER');
  const providerHint = (providerParam ?? providerEnv ?? '').trim().toLowerCase();

  if (readBool('VITE_FORCE_SHAREPOINT', false)) {
    return false;
  }

  const { isDev } = getAppConfig();
  const isTest = isTestMode();
  const isE2E = readBool('VITE_E2E', false) || readBool('VITE_E2E_MSAL_MOCK', false);
  const isKioskRuntime =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/kiosk');

  // Kiosk must rely on SharePoint so history and cross-device consistency work.
  // Keep tests isolated by allowing local mode only while running test runtime.
  if (isKioskRuntime && !isTest) {
    const isMock = isDemoModeEnabled() || isForceDemoEnabled() || shouldSkipLogin() || isDev;
    // E2E local/memory runs intentionally validate kiosk UI behavior without SharePoint dependency.
    if ((providerHint === 'local' || providerHint === 'memory') && (isE2E || isMock)) {
      return true;
    }
    if (providerHint === 'local' || providerHint === 'memory' || shouldSkipLogin()) {
      console.warn(
        '[ExecutionRepositoryFactory] local/memory hint detected in kiosk runtime; forcing SharePoint adapter.',
      );
    }
    return false;
  }

  if (providerHint === 'sharepoint') {
    return false;
  }
  if (providerHint === 'local' || providerHint === 'memory') {
    return true;
  }

  return (
    isDev ||
    isTest ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin()
    // false // Removed force local fallback
  );
};

const resolveKind = (forced?: ExecutionRepositoryKind): ExecutionRepositoryKind =>
  forced ?? (shouldUseLocalRepository() ? 'local' : 'sharepoint');

// ────────────────────────────────────────────────────────────
// Store hooks type (injected from React layer)
// ────────────────────────────────────────────────────────────

export type ExecutionStoreHooks = {
  getRecords: (date: string, userId: string) => ExecutionRecord[];
  getRecord: (date: string, userId: string, scheduleItemId: string) => ExecutionRecord | undefined;
  upsertRecord: (record: ExecutionRecord) => void;
  getCompletionRate: (
    date: string,
    userId: string,
    totalSlots: number,
  ) => { completed: number; triggered: number; rate: number };
  getRecordsInRange: (userId: string, from: string, to: string) => ExecutionRecord[];
};

// ────────────────────────────────────────────────────────────
// Adapters
//
// Uses plain objects so methods work correctly when destructured:
// `const { getRecord } = useExecutionData()`.
// Class methods lose `this` binding in that scenario.
// ────────────────────────────────────────────────────────────

function createLocalStorageExecutionAdapter(
  store: ExecutionStoreHooks,
): ExecutionRecordRepository {
  return {
    getRecords: async (date: string, userId: string) =>
      store.getRecords(normalizeExecutionDate(date), normalizeExecutionUserId(userId)),
    getRecord: async (date: string, userId: string, scheduleItemId: string) =>
      store.getRecord(
        normalizeExecutionDate(date),
        normalizeExecutionUserId(userId),
        normalizeScheduleItemId(scheduleItemId),
      ),
    upsertRecord: async (record: ExecutionRecord) =>
      store.upsertRecord({
        ...record,
        date: normalizeExecutionDate(record.date),
        userId: normalizeExecutionUserId(record.userId),
        scheduleItemId: normalizeScheduleItemId(record.scheduleItemId),
      }),
    getCompletionRate: async (date: string, userId: string, totalSlots: number) =>
      store.getCompletionRate(date, userId, totalSlots),
    getHistoricalRecords: async () => [], // Historical records not supported in local store
    getRecordsInRange: async (userId: string, from: string, to: string) =>
      store.getRecordsInRange(userId, from, to),
  };
}

function createSharePointExecutionAdapter(
  repository: SharePointExecutionRecordRepository,
): ExecutionRecordRepository {
  return {
    getRecords: async (date: string, userId: string) =>
      repository.getRecords(date, userId),
    getRecord: async (date: string, userId: string, scheduleItemId: string) =>
      repository.getRecord(date, userId, scheduleItemId),
    upsertRecord: async (record: ExecutionRecord) =>
      repository.upsertRecord(record),
    getCompletionRate: async (date: string, userId: string, totalSlots: number) =>
      repository.getCompletionRate(date, userId, totalSlots),
    getHistoricalRecords: async (userId: string, scheduleItemId: string, limit?: number) =>
      repository.getHistoricalRecords(userId, scheduleItemId, limit),
    getRecordsInRange: async (userId: string, from: string, to: string) =>
      repository.getRecordsInRange(userId, from, to),
  };
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Get ExecutionRecordRepository instance.
 *
 * For 'local' kind: always creates a fresh adapter wrapping the provided
 * storeHooks. Caching is not used because store hooks contain React closures
 * that change on each render. Memoization is handled by `useMemo` in the
 * calling hook (`useExecutionData`).
 *
 * For future standalone adapters (SharePoint/API): caching will be added
 * since those don't depend on React state.
 *
 * @param storeHooks - Imperative store API (from `useExecutionStore()`).
 *   Required for the 'local' kind.
 */
export const getExecutionRepository = (
  storeHooks?: ExecutionStoreHooks,
  spFetch?: SpFetchFn,
  getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>,
): ExecutionRecordRepository => {

  const kind = resolveKind();

  switch (kind) {
    case 'local': {
      if (!storeHooks) {
        throw new Error(
          '[ExecutionRepositoryFactory] storeHooks is required for local repository.',
        );
      }
      return createLocalStorageExecutionAdapter(storeHooks);
    }
    case 'sharepoint': {
      if (!spFetch) {
        throw new Error(
          '[ExecutionRepositoryFactory] spFetch is required for sharepoint repository.',
        );
      }
      const repository = new SharePointExecutionRecordRepository({
        spFetch,
        getListFieldInternalNames,
        store: storeHooks,
      });
      return createSharePointExecutionAdapter(repository);
    }

    default: {
      const _exhaustive: never = kind;
      throw new Error(`[ExecutionRepositoryFactory] Unknown kind: ${_exhaustive}`);
    }
  }
};

/**
 * Get current repository kind.
 */
export const getCurrentExecutionRepositoryKind = (): ExecutionRepositoryKind =>
  resolveKind();

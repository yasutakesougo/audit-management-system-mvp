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
} from '@/lib/env';
import type { ExecutionRecordRepository } from '../domain/ExecutionRecordRepository';
import type { ExecutionRecord } from '../domain/executionRecordTypes';
import { SharePointExecutionRecordRepository } from '../repositories/sharepoint/SharePointExecutionRecordRepository';

/** Local definition of SharePoint fetch signature to avoid restricted imports in infra layer */
type SpFetchFn = (path: string, init?: RequestInit) => Promise<Response>;



// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type ExecutionRepositoryKind = 'local' | 'sharepoint';

// ────────────────────────────────────────────────────────────
// Environment detection
// ────────────────────────────────────────────────────────────

const shouldUseLocalRepository = (): boolean => {
  const { isDev } = getAppConfig();
  return (
    isDev ||
    isTestMode() ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin()
    // false
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
};

// ────────────────────────────────────────────────────────────
// LocalStorage Adapter (wraps ExecutionStore)
//
// Uses a plain object (not a class) so that methods work correctly
// when destructured: `const { getRecord } = useExecutionData()`.
// Class methods lose `this` binding in that scenario.
// ────────────────────────────────────────────────────────────

function createLocalStorageExecutionAdapter(
  store: ExecutionStoreHooks,
): ExecutionRecordRepository {
  return {
    getRecords: async (date: string, userId: string) =>
      store.getRecords(date, userId),
    getRecord: async (date: string, userId: string, scheduleItemId: string) =>
      store.getRecord(date, userId, scheduleItemId),
    upsertRecord: async (record: ExecutionRecord) =>
      store.upsertRecord(record),
    getCompletionRate: async (date: string, userId: string, totalSlots: number) =>
      store.getCompletionRate(date, userId, totalSlots),
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
      return new SharePointExecutionRecordRepository({
        spFetch,
      });
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

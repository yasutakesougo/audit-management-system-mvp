/**
 * procedureRepositoryFactory — Factory for ProcedureRepository.
 *
 * Mirrors the DailyRecord / Behavior factory pattern:
 *   domain/ProcedureRepository.ts  → Port (interface)
 *   infra/procedureRepositoryFactory.ts → this file (Factory)
 *   stores/procedureStore.ts → current Adapter (Zustand + localStorage)
 *
 * Currently there is only one adapter (localStorage-backed via ProcedureStore).
 * When a SharePoint or REST API adapter is created, add a new `kind` entry
 * and the Factory will select the correct one based on environment.
 *
 * @see DailyRecord's repositoryFactory.ts for the reference pattern.
 */
import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    shouldSkipLogin,
} from '@/lib/env';
import type { ProcedureRepository, ProcedureStep } from '../../domain/legacy/ProcedureRepository';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type ProcedureRepositoryKind = 'local' | 'sharepoint';

// ────────────────────────────────────────────────────────────
// Environment detection
// ────────────────────────────────────────────────────────────

/**
 * Determine if localStorage-backed repository should be used.
 *
 * This mirrors `shouldUseDemoRepository` from the DailyRecord factory.
 * Once a SharePoint/API adapter exists, non-demo environments will
 * return false and fall through to the remote adapter.
 */
const shouldUseLocalRepository = (): boolean => {
  const { isDev } = getAppConfig();
  return (
    isDev ||
    isTestMode() ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin() ||
    true // fallback: localStorage is the only adapter for now
  );
};

const resolveKind = (forced?: ProcedureRepositoryKind): ProcedureRepositoryKind =>
  forced ?? (shouldUseLocalRepository() ? 'local' : 'sharepoint');

// ────────────────────────────────────────────────────────────
// LocalStorage Adapter (wraps ProcedureStore)
//
// Uses a plain object (not a class) so that methods work correctly
// when destructured: `const { getByUser } = useProcedureData()`.
// Class methods lose `this` binding in that scenario.
// ────────────────────────────────────────────────────────────

export type ProcedureStoreHooks = {
  getByUser: (userId: string) => ProcedureStep[];
  save: (userId: string, steps: ProcedureStep[]) => void;
  hasUserData: (userId: string) => boolean;
  registeredUserIds: () => string[];
};

function createLocalStorageProcedureAdapter(
  store: ProcedureStoreHooks,
): ProcedureRepository {
  return {
    getByUser: (userId: string) => store.getByUser(userId),
    save: (userId: string, steps: ProcedureStep[]) => store.save(userId, steps),
    hasUserData: (userId: string) => store.hasUserData(userId),
    registeredUserIds: () => store.registeredUserIds(),
  };
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Get ProcedureRepository instance.
 *
 * For 'local' kind: always creates a fresh adapter wrapping the provided
 * storeHooks. Caching is not used because store hooks contain React closures
 * that change on each render. Memoization is handled by `useMemo` in the
 * calling hook (`useProcedureData`).
 *
 * For future standalone adapters (SharePoint/API): caching will be added
 * since those don't depend on React state.
 *
 * @param storeHooks - Imperative store API (from `useProcedureStore()`).
 *   Required for the 'local' kind.
 */
export const getProcedureRepository = (
  storeHooks?: ProcedureStoreHooks,
): ProcedureRepository => {
  const kind = resolveKind();

  switch (kind) {
    case 'local': {
      if (!storeHooks) {
        throw new Error(
          '[ProcedureRepositoryFactory] storeHooks is required for local repository.',
        );
      }
      return createLocalStorageProcedureAdapter(storeHooks);
    }
    case 'sharepoint':
      // Future: return new SharePointProcedureRepository(options);
      throw new Error(
        '[ProcedureRepositoryFactory] SharePoint adapter not yet implemented.',
      );
    default: {
      const _exhaustive: never = kind;
      throw new Error(`[ProcedureRepositoryFactory] Unknown kind: ${_exhaustive}`);
    }
  }
};

/**
 * Get current repository kind.
 */
export const getCurrentProcedureRepositoryKind = (): ProcedureRepositoryKind =>
  resolveKind();

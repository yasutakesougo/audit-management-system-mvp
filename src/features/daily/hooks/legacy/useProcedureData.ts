/**
 * useProcedureData — Factory-aware procedure data hook.
 *
 * Wires the React-managed ProcedureStore into the procedureRepositoryFactory
 * to produce a `ProcedureRepository` that:
 *   1. Follows the Port interface defined in `domain/ProcedureRepository.ts`
 *   2. Is selected by the Factory based on environment (local / sharepoint / api)
 *   3. Keeps reactive updates via the underlying Zustand store
 *
 * Pattern is identical to `useDailyRecordRepository()`:
 *   Hook → Factory → Adapter (selected by environment)
 *
 * @see domain/ProcedureRepository.ts   — Port (interface)
 * @see infra/procedureRepositoryFactory — Factory
 * @see stores/procedureStore            — current Adapter (Zustand + localStorage)
 */
import { useMemo } from 'react';
import type { ProcedureRepository } from '../../domain/legacy/ProcedureRepository';
import { getProcedureRepository } from '../../repositories/sharepoint/procedureRepositoryFactory';
import { useProcedureStore } from '../legacy-stores/procedureStore';

export function useProcedureData(): ProcedureRepository {
  const storeHooks = useProcedureStore();

  return useMemo(
    () => getProcedureRepository(storeHooks),
    [storeHooks],
  );
}

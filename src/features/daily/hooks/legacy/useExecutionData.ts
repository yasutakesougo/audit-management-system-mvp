/**
 * useExecutionData — Factory-aware execution record hook.
 *
 * Wires the React-managed ExecutionStore into executionRepositoryFactory
 * to produce an `ExecutionRecordRepository` that:
 *   1. Follows the Port interface defined in `domain/ExecutionRecordRepository.ts`
 *   2. Is selected by the Factory based on environment (local / sharepoint / api)
 *   3. Keeps reactive updates via the underlying Zustand store
 *
 * Drop-in replacement for direct `useExecutionStore()` usage in pages/hooks.
 *
 * @see domain/ExecutionRecordRepository.ts    — Port (interface)
 * @see infra/executionRepositoryFactory       — Factory
 * @see stores/executionStore                  — current Adapter (Zustand + localStorage)
 */
import { useMemo } from 'react';
import type { ExecutionRecordRepository } from '../../domain/legacy/ExecutionRecordRepository';
import { getExecutionRepository } from '../../repositories/sharepoint/executionRepositoryFactory';
import { useExecutionStore } from '../legacy-stores/executionStore';
import { useSP } from '@/lib/spClient';

export function useExecutionData(): ExecutionRecordRepository {
  const storeHooks = useExecutionStore();
  const { spFetch } = useSP();

  return useMemo(
    () => getExecutionRepository(storeHooks, spFetch),
    [storeHooks, spFetch],
  );
}


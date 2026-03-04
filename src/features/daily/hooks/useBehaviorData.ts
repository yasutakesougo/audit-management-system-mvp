/**
 * useBehaviorData — Factory-aware behavior data hook.
 *
 * Wraps `useBehaviorStore` (which already uses `getBehaviorRepository()` internally)
 * and exposes a `BehaviorRepository`-conformant `repo` alongside reactive state.
 *
 * This replaces direct usage of `useInMemoryBehaviorRepository()` from `inMemoryFactory.ts`,
 * ensuring callers are decoupled from the concrete adapter (InMemory vs SharePoint vs REST API).
 *
 * @see useBehaviorStore — underlying store (already Factory-aware)
 * @see getBehaviorRepository — Factory that selects the correct adapter
 */
import { useMemo } from 'react';
import type { BehaviorRecord, BehaviorRepository } from '../infra/repositoryTypes';
import { useBehaviorStore } from '../stores/behaviorStore';

export function useBehaviorData() {
  const { data, fetchByUser, add, error, clearError } = useBehaviorStore();

  const repo = useMemo<BehaviorRepository>(() => ({
    fetchByUser,
    add: async (record: Omit<BehaviorRecord, 'id'>) => add(record),
  }), [add, fetchByUser]);

  return { repo, data, error, clearError } as const;
}

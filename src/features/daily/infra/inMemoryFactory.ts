import { useMemo } from 'react';
import { useProcedureStore } from '../stores/procedureStore';
import { useBehaviorStore } from '../stores/behaviorStore';
import type { BehaviorRecord, BehaviorRepository, ProcedureRepository, ProcedureStep } from './repositoryTypes';

export function useInMemoryProcedureRepository(): ProcedureRepository {
  const { getByUser, save } = useProcedureStore();

  return useMemo(() => ({
    getByUser: (userId: string) => getByUser(userId) as ProcedureStep[],
    save: (userId: string, steps: ProcedureStep[]) => save(userId, steps as ProcedureStep[]),
  }), [getByUser, save]);
}

export function useInMemoryBehaviorRepository() {
  const { data, fetchByUser, add, error, clearError } = useBehaviorStore();
  const repo = useMemo<BehaviorRepository>(() => ({
    fetchByUser,
    add: async (record: Omit<BehaviorRecord, 'id'>) => add(record),
  }), [add, fetchByUser]);

  return { repo, data, error, clearError } as const;
}

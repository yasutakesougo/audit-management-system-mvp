import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreatePdcaInput, DeletePdcaInput, UpdatePdcaInput } from '../domain/pdcaRepository';
import { getPdcaRepository } from '../repositoryFactory';
import { icebergPdcaQueryKeys } from './useIcebergPdcaList';

const listKey = (userId?: string | null, planningSheetId?: string | null) =>
  icebergPdcaQueryKeys.list(userId ?? undefined, planningSheetId ?? undefined);

export const useCreatePdca = (userId?: string | null, planningSheetId?: string | null) => {
  const qc = useQueryClient();
  const repo = getPdcaRepository();

  return useMutation({
    mutationFn: (input: CreatePdcaInput) => repo.create(input),
    onSuccess: async (_, variables) => {
      const effectivePlanningSheetId = variables.planningSheetId ?? planningSheetId;
      await qc.invalidateQueries({ queryKey: listKey(variables.userId, effectivePlanningSheetId) });
      // also invalidate current user scope if hook was instantiated with a user
      if (userId && userId !== variables.userId) {
        await qc.invalidateQueries({ queryKey: listKey(userId, planningSheetId) });
      }
    },
  });
};

export const useUpdatePdca = (userId?: string | null, planningSheetId?: string | null) => {
  const qc = useQueryClient();
  const repo = getPdcaRepository();

  return useMutation({
    mutationFn: (input: UpdatePdcaInput) => repo.update(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: listKey(userId, planningSheetId) });
    },
  });
};

export const useDeletePdca = (userId?: string | null, planningSheetId?: string | null) => {
  const qc = useQueryClient();
  const repo = getPdcaRepository();

  return useMutation({
    mutationFn: (input: DeletePdcaInput) => repo.delete(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: listKey(userId, planningSheetId) });
    },
  });
};

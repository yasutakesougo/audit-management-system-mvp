import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getPdcaRepository } from '../repositoryFactory';
import type { CreatePdcaInput, UpdatePdcaInput } from '../domain/pdcaRepository';
import { icebergPdcaQueryKeys } from './useIcebergPdcaList';

const listKey = (userId?: string | null) => icebergPdcaQueryKeys.list(userId ?? undefined);

export const useCreatePdca = (userId?: string | null) => {
  const qc = useQueryClient();
  const repo = getPdcaRepository();

  return useMutation({
    mutationFn: (input: CreatePdcaInput) => repo.create(input),
    onSuccess: async (_, variables) => {
      await qc.invalidateQueries({ queryKey: listKey(variables.userId) });
      // also invalidate current user scope if hook was instantiated with a user
      if (userId && userId !== variables.userId) {
        await qc.invalidateQueries({ queryKey: listKey(userId) });
      }
    },
  });
};

export const useUpdatePdca = (userId?: string | null) => {
  const qc = useQueryClient();
  const repo = getPdcaRepository();

  return useMutation({
    mutationFn: (input: UpdatePdcaInput) => repo.update(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: listKey(userId) });
    },
  });
};

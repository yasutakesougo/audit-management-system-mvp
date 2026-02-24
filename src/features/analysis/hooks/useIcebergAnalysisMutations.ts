import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { SaveIcebergAnalysisInput } from '../domain/icebergAnalysisRepository';
import { getIcebergAnalysisRepository } from '../repositoryFactory';

import { icebergAnalysisQueryKeys } from './useIcebergAnalysisList';

export const useIcebergAnalysisSave = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveIcebergAnalysisInput) =>
      getIcebergAnalysisRepository().save(input),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: icebergAnalysisQueryKeys.list(variables.userId),
      });
    },
  });
};

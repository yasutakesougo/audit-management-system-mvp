import { useQuery } from '@tanstack/react-query';

import type { IcebergAnalysisRecord } from '../domain/icebergAnalysisRecord';
import { getIcebergAnalysisRepository } from '../repositoryFactory';

type Status = 'idle' | 'loading' | 'success' | 'error';

type Params = {
  userId?: string | null;
};

type Result = {
  data: IcebergAnalysisRecord[];
  isLoading: boolean;
  error: unknown | null;
  status: Status;
};

export const icebergAnalysisQueryKeys = {
  list: (userId: string | null | undefined) =>
    ['icebergAnalysis', 'list', userId ?? 'none'] as const,
};

export const useIcebergAnalysisListQuery = (userId: string | null | undefined) =>
  useQuery({
    queryKey: icebergAnalysisQueryKeys.list(userId),
    enabled: Boolean(userId),
    queryFn: () => getIcebergAnalysisRepository().list({ userId: userId ?? undefined }),
    staleTime: 30_000,
  });

export const useIcebergAnalysisList = (params?: Params): Result => {
  const userId = params?.userId ?? null;

  if (!userId) {
    return { data: [], isLoading: false, error: null, status: 'idle' };
  }

  const query = useIcebergAnalysisListQuery(userId);

  const status: Status =
    query.status === 'pending'
      ? 'loading'
      : query.status === 'error'
        ? 'error'
        : 'success';

  return {
    data: query.data ?? [],
    isLoading: status === 'loading',
    error: query.error ?? null,
    status,
  };
};

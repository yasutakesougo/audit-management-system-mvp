import { useQuery } from '@tanstack/react-query';

import type { IcebergPdcaItem } from '../domain/pdca';
import { getPdcaRepository } from '../repositoryFactory';

type Status = 'idle' | 'loading' | 'success' | 'error';

type Params = {
  userId?: string | null;
  planningSheetId?: string | null;
};

type Result = {
  data: IcebergPdcaItem[];
  isLoading: boolean;
  error: unknown | null;
  status: Status;
};

export const icebergPdcaQueryKeys = {
  list: (
    userId: string | null | undefined,
    planningSheetId?: string | null | undefined,
  ) => ['icebergPdca', 'list', userId ?? 'none', planningSheetId ?? 'all'] as const,
};

export const useIcebergPdcaListQuery = (
  userId: string | null | undefined,
  planningSheetId?: string | null | undefined,
) =>
  useQuery({
    queryKey: icebergPdcaQueryKeys.list(userId, planningSheetId),
    enabled: Boolean(userId),
    queryFn: () => getPdcaRepository().list({
      userId: userId ?? undefined,
      planningSheetId: planningSheetId ?? undefined,
    }),
    staleTime: 30_000,
  });

export const useIcebergPdcaList = (params?: Params): Result => {
  const userId = params?.userId ?? null;
  const planningSheetId = params?.planningSheetId ?? null;

  if (!userId) {
    return { data: [], isLoading: false, error: null, status: 'idle' };
  }

  const query = useIcebergPdcaListQuery(userId, planningSheetId);

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

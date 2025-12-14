import { useMemo } from 'react';

import { mockPdcaItems } from '../mockPdcaItems';

type Result<T> = {
  data: T;
  isLoading: boolean;
  error: unknown | null;
  status: 'idle' | 'loading' | 'success' | 'error';
};

type Params = {
  userId?: string | null;
};

export const useIcebergPdcaList = (params?: Params): Result<typeof mockPdcaItems> => {
  const data = useMemo(() => {
    const userId = params?.userId ?? undefined;
    if (!userId) return [];
    return mockPdcaItems.filter((item) => item.userId === userId);
  }, [params?.userId]);

  return { data, isLoading: false, error: null, status: 'success' };
};

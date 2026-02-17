import { useEffect, useMemo } from 'react';

import { useOrgStore, type OrgOption } from '@/features/org/store';

export const useOrgOptions = (): OrgOption[] => {
  const { items, loading, loadedOnce, refresh } = useOrgStore();

  useEffect(() => {
    if (!loadedOnce && !loading) {
      refresh().catch((error) => {
        console.warn('[org] refresh failed', error);
      });
    }
  }, [loadedOnce, loading, refresh]);

  return useMemo(() => items, [items]);
};

export type { OrgOption } from '@/features/org/store';

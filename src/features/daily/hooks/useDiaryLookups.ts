import { useCallback, useEffect, useState } from 'react';
import { useSP } from '@/lib/spClient';
import { readOptionalEnv } from '@/lib/env';

export type LookupOption = { id: number; title: string };

type SpClientLike = {
  spFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

type RawListItem = {
  Id?: number;
  Title?: string;
};

async function fetchList(sp: SpClientLike, listTitle: string, select = 'Id,Title'): Promise<RawListItem[]> {
  const encodedSelect = encodeURIComponent(select);
  const res = await sp.spFetch(`/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?$select=${encodedSelect}&$top=5000`);
  if (!res.ok) {
    throw new Error(`${listTitle} fetch failed: ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  const results = (json?.d?.results ?? json?.value ?? []) as RawListItem[];
  return results.filter((item): item is RawListItem => typeof item === 'object' && item !== null);
}

const resolveListName = (candidate: string | undefined, fallback: string) => {
  const trimmed = candidate?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export function useDiaryLookups() {
  const sp = useSP();
  const [users, setUsers] = useState<LookupOption[]>([]);
  const [goals, setGoals] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
  const usersList = resolveListName(readOptionalEnv('VITE_SP_LIST_USERS'), 'Users');
  const goalsList = resolveListName(readOptionalEnv('VITE_SP_LIST_PLAN_GOAL'), 'PlanGoal');
      const [userItems, goalItems] = await Promise.all([
        fetchList(sp, usersList),
        fetchList(sp, goalsList),
      ]);
      setUsers(
        userItems
          .map((item) => ({ id: Number(item.Id), title: item.Title ?? '' }))
          .filter((item) => Number.isFinite(item.id) && item.title.length > 0)
      );
      setGoals(
        goalItems
          .map((item) => ({ id: Number(item.Id), title: item.Title ?? '' }))
          .filter((item) => Number.isFinite(item.id) && item.title.length > 0)
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [sp]);

  useEffect(() => {
    void load();
  }, [load]);

  return { users, goals, loading, error, reload: load } as const;
}

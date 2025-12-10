import { readOptionalEnv } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { useCallback, useEffect, useState } from 'react';

export type LookupOption = { id: number; title: string };

type SpClientLike = {
  spFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

type RawListItem = {
  Id?: number;
  Title?: string;
  [key: string]: unknown;
};

/**
 * Type guard to validate SharePoint list item structure.
 */
function isValidListItem(item: unknown): item is RawListItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    (item as RawListItem).Id !== undefined &&
    typeof (item as RawListItem).Title === 'string'
  );
}

/**
 * Escape a list title for SharePoint getbytitle API.
 * SharePoint requires single quotes to be escaped as double quotes,
 * not URL-encoded. This prevents list matching failures.
 */
function escapeListTitle(title: string): string {
  return title.replace(/'/g, "''");
}

async function fetchList(sp: SpClientLike, listTitle: string, select = 'Id,Title'): Promise<RawListItem[]> {
  const encodedSelect = encodeURIComponent(select);
  const escapedTitle = escapeListTitle(listTitle);
  const res = await sp.spFetch(`/_api/web/lists/getbytitle('${escapedTitle}')/items?$select=${encodedSelect}&$top=5000`);
  if (!res.ok) {
    throw new Error(`${listTitle} fetch failed: ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  const results = (json?.d?.results ?? json?.value ?? []) as unknown[];
  return results.filter(isValidListItem);
}

const resolveListName = (candidate: string | undefined, fallback: string) => {
  const trimmed = candidate?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

/**
 * Get the configured users list name or fallback to default.
 */
const getUsersListName = () => resolveListName(readOptionalEnv('VITE_SP_LIST_USERS'), 'Users');

/**
 * Get the configured goals list name or fallback to default.
 */
const getGoalsListName = () => resolveListName(readOptionalEnv('VITE_SP_LIST_PLAN_GOAL'), 'PlanGoal');

export function useDiaryLookups() {
  const sp = useSP();
  const [users, setUsers] = useState<LookupOption[]>([]);
  const [goals, setGoals] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!sp?.spFetch) {
      setError(new Error('SharePoint client not initialized'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const usersList = getUsersListName();
      const goalsList = getGoalsListName();
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

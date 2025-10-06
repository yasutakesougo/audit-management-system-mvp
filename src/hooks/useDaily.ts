/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { useSP } from '@/lib/spClient';
import type { DailyUpsert, SpDailyItem } from '@/types';
import { toDailyItem } from '@/types';

export type DailyWithEtag = {
  item: SpDailyItem;
  etag: string | null;
};

const sanitizeEnvValue = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const DEFAULT_DAILY_LIST_TITLE = sanitizeEnvValue((import.meta as any)?.env?.VITE_SP_LIST_DAILY) || 'SupportRecord_Daily';

export function useDaily() {
  const sp = useSP();

  const createDaily = useCallback(async (input: DailyUpsert): Promise<SpDailyItem> => {
    const payload = toDailyItem(input);
    const created = await sp.createItem(DEFAULT_DAILY_LIST_TITLE, payload);
    return created as SpDailyItem;
  }, [sp]);

  const updateDaily = useCallback(async (id: number, input: DailyUpsert, opts?: { etag?: string | null }): Promise<SpDailyItem & { __etag?: string | null }> => {
    const payload = toDailyItem(input);
    await sp.updateItem(DEFAULT_DAILY_LIST_TITLE, id, payload, { ifMatch: opts?.etag ?? '*' });
  const { item, etag } = await sp.getItemByIdWithEtag<SpDailyItem>(DEFAULT_DAILY_LIST_TITLE, id);
    return Object.assign(item as SpDailyItem, { __etag: etag ?? null });
  }, [sp]);

  const getDailyById = useCallback(async (id: number): Promise<SpDailyItem & { __etag?: string | null }> => {
  const { item, etag } = await sp.getItemByIdWithEtag<SpDailyItem>(DEFAULT_DAILY_LIST_TITLE, id);
    return Object.assign(item as SpDailyItem, { __etag: etag ?? null });
  }, [sp]);

  const getDailyWithEtag = useCallback(async (id: number): Promise<DailyWithEtag> => {
  const { item, etag } = await sp.getItemByIdWithEtag<SpDailyItem>(DEFAULT_DAILY_LIST_TITLE, id);
    return { item, etag };
  }, [sp]);

  return {
    createDaily,
    updateDaily,
    getDailyById,
    getDailyWithEtag,
  };
}

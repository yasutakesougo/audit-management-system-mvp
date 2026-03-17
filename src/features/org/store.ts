import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';

import { shouldSkipSharePoint } from '@/lib/sharepoint/skipSharePoint';
import { useSP } from '@/lib/spClient';

import {
    ORG_MASTER_FIELDS,
    ORG_MASTER_LIST_TITLE,
    ORG_MASTER_SELECT_FIELDS,
    SpOrgRowSchema,
    type OrgMasterRecord,
} from './data/orgRowSchema';

// ============================================================================
// Types
// ============================================================================

export type OrgOption = {
  id: string;
  label: string;
  orgType?: string;
  audience?: string[];
  notes?: string;
};

type OrgStoreState = {
  items: OrgOption[];
  loading: boolean;
  error: string | null;
  loadedOnce: boolean;
  refresh: () => Promise<void>;
};

/**
 * Options for useOrgStore. Allows callers to control skip-SharePoint
 * behavior externally instead of the hook evaluating it directly.
 *
 * When `skipSharePoint` is omitted, the hook falls back to
 * `shouldSkipSharePoint()` for backward compatibility.
 */
export type UseOrgStoreOptions = {
  skipSharePoint?: boolean;
};

const FALLBACK_ORG_OPTIONS: OrgOption[] = [
  { id: 'org-all', label: '事業所全体', notes: '全職員向けイベント・共有事項' },
  { id: 'org-meeting-room-a', label: '会議室A', notes: '定例会議・委員会に利用' },
  { id: 'org-meeting-room-b', label: '会議室B', notes: '面談や個別支援会議に利用' },
  { id: 'org-community', label: '地域連携 / 外部訪問', notes: '外部団体との合同イベントや訪問' },
];

const buildOrgOptions = (records: OrgMasterRecord[]): OrgOption[] =>
  records.map((record) => ({
    id: String(record.id),
    label: record.label,
    orgType: record.orgType,
    audience: record.audience,
    notes: record.notes,
  }));

const sortRecords = (records: OrgMasterRecord[]): OrgMasterRecord[] =>
  [...records].sort((a, b) => {
    const sortA = a.sortOrder ?? 9999;
    const sortB = b.sortOrder ?? 9999;
    if (sortA !== sortB) {
      return sortA - sortB;
    }
    return a.label.localeCompare(b.label, 'ja');
  });

// ============================================================================
// Zustand Store for module-level cache/dedupe state
// ============================================================================

interface OrgCacheState {
  orgLoadPromise: Promise<void> | null;
  orgCachedOptions: OrgOption[] | null;
}

const useOrgCacheStore = create<OrgCacheState>()(() => ({
  orgLoadPromise: null,
  orgCachedOptions: null,
}));

// ============================================================================
// React Hook
// ============================================================================

export function useOrgStore(options?: UseOrgStoreOptions): OrgStoreState {
  const skip = options?.skipSharePoint ?? shouldSkipSharePoint();
  const sp = useSP();
  const spRef = useRef(sp);

  // Keep ref updated to latest sp client (for refresh after auth state change)
  useEffect(() => {
    spRef.current = sp;
  }, [sp]);

  // Use Zustand for items/loading/error/loadedOnce state
  const [items, setItems] = useOrgLocalState();
  const [loading, setLoading] = useOrgLocalLoadingState();
  const [error, setError] = useOrgLocalErrorState();
  const [loadedOnce, setLoadedOnce] = useOrgLocalLoadedState();

  const loadOrgOptions = useCallback(async (signal?: AbortSignal) => {
    const cacheState = useOrgCacheStore.getState();

    // Guard -1: Skip SharePoint (demo / baseUrl empty / skip-login / automation)
    if (skip) {
      console.debug('[useOrgStore] Guard -1: skipSharePoint=true, using fallback');
      useOrgCacheStore.setState({ orgCachedOptions: null }); // Clear cache
      setItems(FALLBACK_ORG_OPTIONS);
      setLoadedOnce(true);
      setLoading(false);
      return;
    }

    // Guard 0: Module cache hit (only for SP mode)
    if (cacheState.orgCachedOptions) {
      console.debug('[useOrgStore] Guard 0: cache hit, restoring from module cache');
      setItems(cacheState.orgCachedOptions);
      setLoadedOnce(true);
      setLoading(false);
      return;
    }

    // Guard 1: Already loaded - avoid redundant fetch (synchronous check)
    if (loadedOnce) {
      console.debug('[useOrgStore] Guard 1: already loaded, skipping');
      return;
    }

    // Guard 2: In-flight dedupe (StrictMode protection)
    if (cacheState.orgLoadPromise) {
      console.debug('[useOrgStore] Guard 2: in-flight promise found, reusing');
      return cacheState.orgLoadPromise;
    }

    if (signal?.aborted) {
      return;
    }

    console.debug('[useOrgStore] Guard 3: creating new load promise (SharePoint fetch)');
    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchRows = async () => {
          try {
            return await spRef.current.listItems<Record<string, unknown>>(ORG_MASTER_LIST_TITLE, {
              select: Array.from(ORG_MASTER_SELECT_FIELDS),
              orderby: `${ORG_MASTER_FIELDS.title} asc`,
              top: 500,
              signal,
            });
          } catch (err) {
            const status = (err as { status?: number }).status;
            if (status === 400) {
              return await spRef.current.listItems<Record<string, unknown>>(ORG_MASTER_LIST_TITLE, {
                orderby: `${ORG_MASTER_FIELDS.title} asc`,
                top: 500,
                signal,
              });
            }
            throw err;
          }
        };

        const rows = await fetchRows();
        if (signal?.aborted) {
          return;
        }

        const normalizedRows = Array.isArray(rows) ? rows : (rows as { value?: unknown[] })?.value ?? [];
        const parsedRows = SpOrgRowSchema.array().safeParse(normalizedRows);
        if (!parsedRows.success) {
          console.warn('[Org_Master] parse failed, fallback used', parsedRows.error.flatten());
          setError('Org master schema mismatch');
          setItems(FALLBACK_ORG_OPTIONS);
          setLoadedOnce(true);
          return;
        }

        const activeRecords = parsedRows.data.filter((record) => record.isActive);

        const sortedRecords = sortRecords(activeRecords);
        const nextItems = sortedRecords.length ? buildOrgOptions(sortedRecords) : FALLBACK_ORG_OPTIONS;

        // Cache successful result at module scope
        useOrgCacheStore.setState({ orgCachedOptions: nextItems });

        setItems(nextItems);
        setLoadedOnce(true);
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        const message = err instanceof Error ? err.message : '事業所マスターの取得に失敗しました';
        console.warn('[useOrgStore] failed to load org options', err);
        setError(message);
        setItems(FALLBACK_ORG_OPTIONS);
        setLoadedOnce(true);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
        // Clear in-flight cache on completion (both success and failure)
        useOrgCacheStore.setState({ orgLoadPromise: null });
      }
    })();

    useOrgCacheStore.setState({ orgLoadPromise: promise });
    return promise;
  }, []); // No dependencies: IS_DEMO is module-level constant, sp via spRef

  const refresh = useCallback(async () => {
    await loadOrgOptions();
  }, [loadOrgOptions]);

  useEffect(() => {
    // Guard: only load if not already loaded
    if (loadedOnce) {
      return;
    }

    const controller = new AbortController();
    void loadOrgOptions(controller.signal);
    return () => controller.abort();
  }, [loadedOnce, loadOrgOptions]);

  return { items, loading, error, loadedOnce, refresh };
}

// ============================================================================
// Internal state hooks — thin wrappers using React useState
// (org/store uses React local state for items/loading/error/loadedOnce;
//  only the cross-render dedupe vars are moved to Zustand)
// ============================================================================

import { useState } from 'react';

function useOrgLocalState(): [OrgOption[], (v: OrgOption[]) => void] {
  return useState<OrgOption[]>([]);
}

function useOrgLocalLoadingState(): [boolean, (v: boolean) => void] {
  return useState<boolean>(true);
}

function useOrgLocalErrorState(): [string | null, (v: string | null) => void] {
  return useState<string | null>(null);
}

function useOrgLocalLoadedState(): [boolean, (v: boolean) => void] {
  return useState<boolean>(false);
}

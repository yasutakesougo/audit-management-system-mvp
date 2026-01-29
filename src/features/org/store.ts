import { useCallback, useEffect, useRef, useState } from 'react';

import { IS_SKIP_SHAREPOINT } from '@/lib/env';
import { useSP } from '@/lib/spClient';

import {
    ORG_MASTER_FIELDS,
    ORG_MASTER_LIST_TITLE,
    ORG_MASTER_SELECT_FIELDS,
    SpOrgRowSchema,
    type OrgMasterRecord,
} from './data/orgRowSchema';

// ============================================================================
// In-flight dedupe: Prevent multiple simultaneous Org_Master fetches
// (solves React 18 StrictMode double-invocation in dev)
// ============================================================================
let orgLoadPromise: Promise<void> | null = null;

// ============================================================================
// Module-scope cache: Session-wide cache to prevent refetch on remount
// (survives React state reset, route transitions, and HMR)
// ============================================================================
let orgCachedOptions: OrgOption[] | null = null;

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

export function useOrgStore(): OrgStoreState {
  const sp = useSP();
  const spRef = useRef(sp);
  
  // Keep ref updated to latest sp client (for refresh after auth state change)
  useEffect(() => {
    spRef.current = sp;
  }, [sp]);

  const [items, setItems] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState<boolean>(false);

  const loadOrgOptions = useCallback(async (signal?: AbortSignal) => {
    // Guard -1: Skip SharePoint (demo / baseUrl empty / skip-login / automation)
    // ✅ Master guard: prevents ALL SharePoint operations in non-SP scenarios
    // ✅ Promise is never created if SharePoint should be skipped
    if (IS_SKIP_SHAREPOINT) {
      console.info('[useOrgStore] Guard -1: skip SharePoint, using fallback');
      orgCachedOptions = null; // Clear cache
      setItems(FALLBACK_ORG_OPTIONS);
      setLoadedOnce(true);
      setLoading(false); // ← CRITICAL: complete state transition
      return; // ← EXIT POINT: SHAREPOINT SKIPPED - PROMISE NEVER CREATED
    }

    // Guard 0: Module cache hit (only for SP mode)
    if (orgCachedOptions) {
      console.debug('[useOrgStore] Guard 0: cache hit, restoring from module cache');
      setItems(orgCachedOptions);
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
    // If already fetching, return the same promise instead of fetching again
    if (orgLoadPromise) {
      console.debug('[useOrgStore] Guard 2: in-flight promise found, reusing');
      return orgLoadPromise;
    }

    if (signal?.aborted) {
      return;
    }

    console.debug('[useOrgStore] Guard 3: creating new load promise (SharePoint fetch)');
    // Guard 3: Promise先取り確保（await前に確保して、同時呼び出しを同じPromiseに吸収）
    // ✅ sharePointDisabled NEVER true here — Guard -1 already handled all demo mode cases
    orgLoadPromise = (async () => {
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
        orgCachedOptions = nextItems;
        
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
        // This allows retry on next call if needed
        orgLoadPromise = null;
      }
    })();

    return orgLoadPromise;
  }, []); // No dependencies: IS_DEMO is module-level constant, sp via spRef

  const refresh = useCallback(async () => {
    await loadOrgOptions();
  }, [loadOrgOptions]);

  useEffect(() => {
    // Guard: only load if not already loaded
    // This prevents infinite effect cycles even if loadOrgOptions reference changes
    if (loadedOnce) {
      return;
    }

    const controller = new AbortController();
    void loadOrgOptions(controller.signal);
    return () => controller.abort();
  }, [loadedOnce, loadOrgOptions]);

  return { items, loading, error, loadedOnce, refresh };
}

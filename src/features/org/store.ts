import { useCallback, useEffect, useMemo, useState } from 'react';

import { isDemoModeEnabled, skipSharePoint } from '@/lib/env';
import { useSP } from '@/lib/spClient';

import {
    ORG_MASTER_FIELDS,
    ORG_MASTER_LIST_TITLE,
    ORG_MASTER_SELECT_FIELDS,
    SpOrgRowSchema,
    type OrgMasterRecord,
} from './data/orgRowSchema';

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
  const [items, setItems] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState<boolean>(false);
  const sharePointDisabled = useMemo(() => isDemoModeEnabled() || skipSharePoint(), []);

  const loadOrgOptions = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (sharePointDisabled) {
        setItems(FALLBACK_ORG_OPTIONS);
        setLoadedOnce(true);
        return;
      }

      const fetchRows = async () => {
        try {
          return await sp.listItems<Record<string, unknown>>(ORG_MASTER_LIST_TITLE, {
            select: Array.from(ORG_MASTER_SELECT_FIELDS),
            orderby: `${ORG_MASTER_FIELDS.title} asc`,
            top: 500,
            signal,
          });
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 400) {
            return await sp.listItems<Record<string, unknown>>(ORG_MASTER_LIST_TITLE, {
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
    }
  }, [sharePointDisabled, sp]);

  const refresh = useCallback(async () => {
    await loadOrgOptions();
  }, [loadOrgOptions]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrgOptions(controller.signal);
    return () => controller.abort();
  }, [loadOrgOptions]);

  return { items, loading, error, loadedOnce, refresh };
}

/**
 * DailyPage — Thin Orchestrator
 *
 * Composes:
 *   - dailyPageConstants: types, filter options, status config, utilities
 *   - DailyPageCardView: card-mode rendering
 *   - DailyPageTableView: table-mode rendering
 *
 * 639 → ~280 lines (composition + filter state)
 */

import { useDensity, useDisplayMode } from '@/app/LayoutContext';
import { PageHeader } from '@/components/PageHeader';
import { useUsersStore } from '@/features/users/store';
import { useFiltersSync } from '@/hooks/useFiltersSync';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useDaily } from '@/stores/useDaily';
import { useStaff } from '@/stores/useStaff';
import FilterToolbar, { type StatusOption } from '@/ui/filters/FilterToolbar';
import { buildSearchParams as buildSearchParamsUtil, normalizeFilters as normalizeFiltersUtil } from '@/utils/filters';
import { formatCount } from '@/utils/formatCount';
import { toLocalDateISO } from '@/utils/getNow';
import { normalizeRange } from '@/utils/range';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { japaneseNameCollator } from '@/lib/i18n/japaneseCollator';

import { DailyPageCardView } from './DailyPageCardView';
import {
    type DailyFilters,
    type FilterKey,
    DEBOUNCE_MS,
    FILTER_OPTIONS,
    INITIAL_FILTERS,
    parseFiltersFromParams,
    STATUS_LABEL,
    STORAGE_KEY,
} from './dailyPageConstants';
import { DailyPageTableView } from './DailyPageTableView';

export default function DailyPage() {
  const { data, error, loading, reload } = useDaily();
  const { data: staff, loading: staffLoading } = useStaff();
  const { data: users, status } = useUsersStore();
  const usersLoading = status === 'loading';
  const density = useDensity();
  const displayMode = useDisplayMode();
  const [compact, setCompact] = useState(() => density === 'compact');

  const {
    filters: filterValues,
    debounced: debouncedFilters,
    setFilters,
    update,
    reset,
    isDebouncing,
  } = usePersistedFilters<DailyFilters>({
    storageKey: STORAGE_KEY,
    migrateFromKeys: ['daily.filters.v1', 'daily.filters'],
    defaults: INITIAL_FILTERS,
    debounceKeys: ['q'],
    debounceMs: DEBOUNCE_MS,
    ignoreEqualUpdates: true,
  });
  const {
    filter: activeFilter,
    from: fromDate,
    to: toDate,
    quickRange,
    showAdvanced,
  } = filterValues;
  const queryValue = filterValues.q;
  const isDebounceIdle = !isDebouncing;

  const parseUrlFilters = useCallback((params: URLSearchParams, prev: DailyFilters) => parseFiltersFromParams(params, prev), []);
  const buildUrlSearch = useCallback((filters: DailyFilters) => buildSearchParamsUtil(filters), []);
  const normalizeFilterRange = useCallback((filters: DailyFilters) => normalizeFiltersUtil(filters), []);

  const { hydratingRef } = useFiltersSync({
    filters: filterValues,
    debouncedFilters,
    setFilters,
    parseFilters: parseUrlFilters,
    buildSearchParams: buildUrlSearch,
    normalizeFilters: normalizeFilterRange,
  });

  const commitFilters = useCallback((project: (previous: DailyFilters) => DailyFilters) => {
    setFilters((prev) => {
      const next = project(prev);
      if (next === prev) return prev;
      const keys = new Set<keyof DailyFilters>([
        ...(Object.keys(prev) as Array<keyof DailyFilters>),
        ...(Object.keys(next) as Array<keyof DailyFilters>),
      ]);
      for (const key of keys) {
        if (!Object.is(prev[key], next[key])) return next;
      }
      return prev;
    });
  }, [setFilters]);

  const handleQueryChange = useCallback((value: string) => update('q', value), [update]);

  useEffect(() => { setCompact(density === 'compact'); }, [density]);

  useEffect(() => {
    const normalized = normalizeRange(filterValues.from, filterValues.to);
    if ((normalized.from === filterValues.from && normalized.to === filterValues.to) || hydratingRef.current) return;
    commitFilters((prev) => {
      const current = normalizeRange(prev.from, prev.to);
      if (current.from === normalized.from && current.to === normalized.to) return prev;
      return { ...prev, from: normalized.from, to: normalized.to };
    });
  }, [commitFilters, filterValues.from, filterValues.to, hydratingRef]);

  const handleFilterChange = useCallback((next: FilterKey) => update('filter', next), [update]);

  const handleQuickRange = useCallback((next: 'all' | 'today') => {
    commitFilters((prev) => {
      const toggled = prev.quickRange === next ? 'all' : next;
      if (toggled === prev.quickRange && prev.from === '' && prev.to === '') return prev;
      if (toggled === prev.quickRange) return { ...prev, from: '', to: '' };
      return { ...prev, quickRange: toggled, from: '', to: '' };
    });
  }, [commitFilters]);

  const handleFromChange = useCallback((value: string) => update('from', value), [update]);
  const handleToChange = useCallback((value: string) => update('to', value), [update]);

  const toggleAdvanced = useCallback(() => {
    commitFilters((prev) => ({ ...prev, showAdvanced: !prev.showAdvanced }));
  }, [commitFilters]);

  const staffNameMap = useMemo(() => {
    const map = new Map<number, string>();
    (staff ?? []).forEach((member) => {
      const key = Number(member.id);
      if (Number.isFinite(key)) map.set(key, member.name || `#${member.id}`);
    });
    return map;
  }, [staff]);

  const userNameMap = useMemo(() => {
    const map = new Map<number, string>();
    (users ?? []).forEach((user) => {
      const key = Number(user.Id);
      if (Number.isFinite(key)) map.set(key, user.FullName || `#${user.Id}`);
    });
    return map;
  }, [users]);

  const normalizedQuery = debouncedFilters.q.trim().toLowerCase();
  const collator = japaneseNameCollator;
  const statusOptions: StatusOption[] = useMemo(
    () => FILTER_OPTIONS.map((option) => ({
      value: option,
      label: option === 'all' ? 'すべて' : STATUS_LABEL[option] ?? option,
    })),
    [],
  );
  const todayISO = useMemo(() => toLocalDateISO(), []);
  const advancedPanelId = useId();

  const sortedRows = useMemo(() => {
    const rows = data ?? [];
    return [...rows].sort((a, b) => {
      const dateA = a.date ?? '';
      const dateB = b.date ?? '';
      if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
      return collator.compare(a.title ?? '', b.title ?? '');
    });
  }, [collator, data]);

  const filtered = useMemo(() => {
    const rows = sortedRows;
    const applyManualRange = quickRange !== 'today';
    const hasFrom = applyManualRange && Boolean(fromDate);
    const hasTo = applyManualRange && Boolean(toDate);
    let rangeStart = hasFrom ? fromDate : '';
    let rangeEnd = hasTo ? toDate : '';
    if (hasFrom && hasTo && fromDate && toDate && fromDate > toDate) {
      rangeStart = toDate;
      rangeEnd = fromDate;
    }
    return rows.filter((item) => {
      if (activeFilter !== 'all' && (item.status ?? '').toLowerCase() !== activeFilter) return false;
      if (normalizedQuery) {
        const haystack = [item.title, item.notes, item.location]
          .map((value) => (value ?? '').toString().toLowerCase())
          .join(' ');
        if (!haystack.includes(normalizedQuery)) return false;
      }
      const date = item.date ?? '';
      if (quickRange === 'today' && date !== todayISO) return false;
      if (hasFrom && rangeStart && (!date || date < rangeStart)) return false;
      if (hasTo && rangeEnd && (!date || date > rangeEnd)) return false;
      return true;
    });
  }, [activeFilter, normalizedQuery, fromDate, toDate, quickRange, sortedRows, todayISO]);

  const hasFilters = activeFilter !== 'all'
    || Boolean(queryValue.trim())
    || Boolean(fromDate)
    || Boolean(toDate)
    || quickRange === 'today';
  const totalCount = data?.length ?? 0;
  const statusOverrideRef = useRef<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(() => formatCount(totalCount, filtered.length));
  const [statusVersion, setStatusVersion] = useState(0);

  useEffect(() => {
    if (statusOverrideRef.current) { statusOverrideRef.current = null; return; }
    const baseMessage = formatCount(totalCount, filtered.length);
    setStatusMessage((prev) => {
      if (prev === baseMessage) return prev;
      // Bump version in the same render cycle via a second setState
      setStatusVersion((v) => v + 1);
      return baseMessage;
    });
  }, [totalCount, filtered.length]);

  const announceReset = useCallback(() => {
    const message = '検索条件をリセットしました。';
    statusOverrideRef.current = message;
    setStatusMessage(message);
    setStatusVersion((prev) => prev + 1);
  }, []);

  const handleClearFilters = useCallback(() => {
    reset();
    if (!hydratingRef.current) announceReset();
  }, [announceReset, hydratingRef, reset]);

  const isCardMode = displayMode === 'sceneA';

  if (loading && !data) return <div className="p-4">読み込み中…</div>;
  if (error) return <div className="p-4 text-red-600">読み込みエラー: {error.message}</div>;
  if (!data?.length) {
    return (
      <div className="p-4 space-y-3">
        <div>日次記録がありません</div>
        <button type="button" onClick={() => { void reload(); }} className="border px-3 py-1 rounded bg-emerald-600 text-white">
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <PageHeader title="日次記録" />
      <FilterToolbar
        query={queryValue}
        onQueryChange={handleQueryChange}
        debounceMs={DEBOUNCE_MS}
        searchPlaceholder="タイトル / メモ / 担当"
        searchHelpId="daily-search-help"
        toolbarLabel="日次記録の検索条件"
        statusOptions={statusOptions}
        activeStatus={activeFilter}
        onStatusChange={(value: string) => {
          if (FILTER_OPTIONS.includes(value as FilterKey)) handleFilterChange(value as FilterKey);
        }}
        debounceState={isDebounceIdle ? 'idle' : 'busy'}
        extraControls={(
          <div className="flex flex-wrap items-center gap-2">
            <Button size="small" variant={quickRange === 'today' ? 'contained' : 'outlined'} onClick={() => handleQuickRange('today')} aria-pressed={quickRange === 'today'} type="button">
              今日
            </Button>
            <Button size="small" variant={showAdvanced ? 'contained' : 'outlined'} onClick={toggleAdvanced} aria-controls={advancedPanelId} aria-expanded={showAdvanced} aria-pressed={showAdvanced} type="button">
              {showAdvanced ? '詳細を閉じる' : '詳細フィルタ'}
            </Button>
          </div>
        )}
        extraControlsLabel="期間"
        onReset={handleClearFilters}
        isResetDisabled={!hasFilters}
        trailingControls={(
          <Button variant="outlined" size="small" onClick={() => { void reload(); }} disabled={loading} type="button">
            {loading ? '更新中…' : '再読み込み'}
          </Button>
        )}
      >
        <div className="flex flex-wrap items-center gap-3" id={advancedPanelId} hidden={!showAdvanced} aria-hidden={!showAdvanced}>
          <TextField size="small" type="date" label="期間(自)" value={fromDate} onChange={(event) => handleFromChange(event.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="期間(至)" value={toDate} onChange={(event) => handleToChange(event.target.value)} InputLabelProps={{ shrink: true }} />
          <FormControlLabel control={<Switch checked={compact} onChange={(_, value) => setCompact(value)} size="small" />} label="コンパクト表示" />
        </div>
      </FilterToolbar>
      <div role="status" aria-live="polite" aria-atomic="true" className="px-1 text-sm text-gray-600">
        <span key={statusVersion}>{statusMessage}</span>
        <span aria-hidden="true">（条件変更を反映しました）</span>
      </div>
      {isCardMode ? (
        <DailyPageCardView rows={filtered} staffNameMap={staffNameMap} userNameMap={userNameMap} />
      ) : (
        <DailyPageTableView rows={filtered} staffNameMap={staffNameMap} userNameMap={userNameMap} compact={compact} staffLoading={staffLoading} usersLoading={usersLoading} />
      )}
    </div>
  );
}

import { useDensity, useDisplayMode } from '@/app/LayoutContext';
import { useUsersStore } from '@/features/users/store';
import { useFiltersSync } from '@/hooks/useFiltersSync';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useDaily } from '@/stores/useDaily';
import { useStaff } from '@/stores/useStaff';
import FilterToolbar, { type StatusOption } from '@/ui/filters/FilterToolbar';
import { buildSearchParams as buildSearchParamsUtil, normalizeFilters as normalizeFiltersUtil } from '@/utils/filters';
import { formatCount } from '@/utils/formatCount';
import { getNow } from '@/utils/getNow';
import { normalizeRange } from '@/utils/range';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const FILTER_OPTIONS = ['all', 'draft', 'submitted', 'approved'] as const;
type FilterKey = (typeof FILTER_OPTIONS)[number];

type DailyFilters = {
  q: string;
  filter: FilterKey;
  from: string;
  to: string;
  quickRange: 'all' | 'today';
  showAdvanced: boolean;
};

const STORAGE_KEY = 'daily.filters.v2';
const INITIAL_FILTERS: DailyFilters = {
  q: '',
  filter: 'all',
  from: '',
  to: '',
  quickRange: 'all',
  showAdvanced: false,
};

const dateOnly = (s?: string | null) => {
  if (!s) return '';
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  return iso.replace(/-/g, '/');
};

const STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  submitted: '申請中',
  approved: '承認済み',
  rejected: '差戻し',
};

const STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'warning',
};

const applyParam = <TKey extends keyof DailyFilters>(
  draft: DailyFilters,
  key: TKey,
  params: URLSearchParams,
  resolver: () => DailyFilters[TKey],
  fallback?: DailyFilters[TKey],
) => {
  const paramKey = key === 'quickRange' ? 'range' : key;
  if (!params.has(paramKey)) {
    if (fallback !== undefined && draft[key] !== fallback) {
      draft[key] = fallback;
    }
    return;
  }
  draft[key] = resolver();
};

const parseFiltersFromParams = (params: URLSearchParams, prev: DailyFilters): DailyFilters => {
  const next: DailyFilters = { ...prev };

  applyParam(next, 'q', params, () => (params.get('q') ?? '').trim(), '');
  applyParam(next, 'filter', params, () => {
    const value = params.get('filter');
    return FILTER_OPTIONS.includes(value as FilterKey) ? (value as FilterKey) : 'all';
  }, 'all');
  applyParam(next, 'from', params, () => params.get('from') ?? '', '');
  applyParam(next, 'to', params, () => params.get('to') ?? '', '');
  applyParam(next, 'quickRange', params, () => (params.get('range') === 'today' ? 'today' : 'all'), 'all');

  return next;
};

const StatusChip = ({ status }: { status?: string | null }) => {
  const key = (status ?? '').toLowerCase();
  const normalized = key || 'draft';
  const color = STATUS_COLOR[normalized] ?? 'default';
  const label = STATUS_LABEL[normalized] ?? '未指定';
  return <Chip size="small" color={color} variant="outlined" label={label} />;
};

export default function DailyPage() {
  const { data, error, loading, reload } = useDaily();
  const { data: staff, loading: staffLoading } = useStaff();
  const { data: users, status } = useUsersStore();
  const usersLoading = status === 'loading';
  const density = useDensity();
  const displayMode = useDisplayMode();
  const [compact, setCompact] = useState(() => density === 'compact');

  const DEBOUNCE_MS = 300; // 200–400ms で調整
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
      if (next === prev) {
        return prev;
      }
      const keys = new Set<keyof DailyFilters>([
        ...(Object.keys(prev) as Array<keyof DailyFilters>),
        ...(Object.keys(next) as Array<keyof DailyFilters>),
      ]);
      for (const key of keys) {
        if (!Object.is(prev[key], next[key])) {
          return next;
        }
      }
      return prev;
    });
  }, [setFilters]);

  const handleQueryChange = useCallback((value: string) => {
    update('q', value);
  }, [update]);

  useEffect(() => {
    setCompact(density === 'compact');
  }, [density]);

  useEffect(() => {
    const normalized = normalizeRange(filterValues.from, filterValues.to);
    if ((normalized.from === filterValues.from && normalized.to === filterValues.to) || hydratingRef.current) {
      return;
    }
    commitFilters((prev) => {
      const current = normalizeRange(prev.from, prev.to);
      if (current.from === normalized.from && current.to === normalized.to) {
        return prev;
      }
      return { ...prev, from: normalized.from, to: normalized.to };
    });
  }, [commitFilters, filterValues.from, filterValues.to, hydratingRef]);

  const handleFilterChange = useCallback((next: FilterKey) => {
    update('filter', next);
  }, [update]);

  const handleQuickRange = useCallback((next: 'all' | 'today') => {
    commitFilters((prev) => {
      const toggled = prev.quickRange === next ? 'all' : next;
      if (toggled === prev.quickRange && prev.from === '' && prev.to === '') {
        return prev;
      }
      if (toggled === prev.quickRange) {
        return { ...prev, from: '', to: '' };
      }
      return { ...prev, quickRange: toggled, from: '', to: '' };
    });
  }, [commitFilters]);

  const handleFromChange = useCallback((value: string) => {
    update('from', value);
  }, [update]);

  const handleToChange = useCallback((value: string) => {
    update('to', value);
  }, [update]);

  const toggleAdvanced = useCallback(() => {
    commitFilters((prev) => ({ ...prev, showAdvanced: !prev.showAdvanced }));
  }, [commitFilters]);

  const staffNameMap = useMemo(() => {
    const map = new Map<number, string>();
    (staff ?? []).forEach((member) => {
      const key = Number(member.id);
      if (Number.isFinite(key)) {
        map.set(key, member.name || `#${member.id}`);
      }
    });
    return map;
  }, [staff]);

  const userNameMap = useMemo(() => {
    const map = new Map<number, string>();
    (users ?? []).forEach((user) => {
      const key = Number(user.Id);
      if (Number.isFinite(key)) {
        map.set(key, user.FullName || `#${user.Id}`);
      }
    });
    return map;
  }, [users]);

  const normalizedQuery = debouncedFilters.q.trim().toLowerCase();
  const collator = useMemo(() => new Intl.Collator('ja-JP-u-co-unihan'), []);
  const statusOptions: StatusOption[] = useMemo(
    () => FILTER_OPTIONS.map((option) => ({
      value: option,
      label: option === 'all' ? 'すべて' : STATUS_LABEL[option] ?? option,
    })),
    [],
  );
  const todayISO = useMemo(() => getNow().toISOString().slice(0, 10), []);
  const advancedPanelId = useId();

  const sortedRows = useMemo(() => {
    const rows = data ?? [];
    return [...rows].sort((a, b) => {
      const dateA = a.date ?? '';
      const dateB = b.date ?? '';
      if (dateA && dateB && dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
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
      if (activeFilter !== 'all' && (item.status ?? '').toLowerCase() !== activeFilter) {
        return false;
      }
      if (normalizedQuery) {
        const haystack = [item.title, item.notes, item.location]
          .map((value) => (value ?? '').toString().toLowerCase())
          .join(' ');
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }
      const date = item.date ?? '';
      if (quickRange === 'today' && date !== todayISO) {
        return false;
      }
      if (hasFrom && rangeStart && (!date || date < rangeStart)) {
        return false;
      }
      if (hasTo && rangeEnd && (!date || date > rangeEnd)) {
        return false;
      }
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
    if (statusOverrideRef.current) {
      statusOverrideRef.current = null;
      return;
    }
    const baseMessage = formatCount(totalCount, filtered.length);
    let changed = false;
    setStatusMessage((prev) => {
      if (prev === baseMessage) {
        return prev;
      }
      changed = true;
      return baseMessage;
    });
    if (changed) {
      setStatusVersion((prev) => prev + 1);
    }
  }, [totalCount, filtered.length]);

  const announceReset = useCallback(() => {
    const message = '検索条件をリセットしました。';
    statusOverrideRef.current = message;
    setStatusMessage(message);
    setStatusVersion((prev) => prev + 1);
  }, []);

  const handleClearFilters = useCallback(() => {
    reset();
    if (!hydratingRef.current) {
      announceReset();
    }
  }, [announceReset, hydratingRef, reset]);

  const tableTextClass = compact ? 'text-xs' : 'text-sm sm:text-base';
  const cellClass = compact ? 'border px-3 py-2' : 'border px-4 py-3';
  const nowrapCellClass = `${cellClass} whitespace-nowrap`;
  const rowHoverClass = compact ? 'hover:bg-emerald-50/60' : 'hover:bg-emerald-50/40';
  const isCardMode = displayMode === 'sceneA';

  if (loading && !data) {
    return <div className="p-4">読み込み中…</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">読み込みエラー: {error.message}</div>;
  }

  if (!data?.length) {
    return (
      <div className="p-4 space-y-3">
        <div>日次記録がありません</div>
        <button
          type="button"
          onClick={() => {
            void reload();
          }}
          className="border px-3 py-1 rounded bg-emerald-600 text-white"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">日次記録</h1>
      </div>
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
          if (FILTER_OPTIONS.includes(value as FilterKey)) {
            handleFilterChange(value as FilterKey);
          }
        }}
        debounceState={isDebounceIdle ? 'idle' : 'busy'}
        extraControls={(
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="small"
              variant={quickRange === 'today' ? 'contained' : 'outlined'}
              onClick={() => handleQuickRange('today')}
              aria-pressed={quickRange === 'today'}
              type="button"
            >
              今日
            </Button>
            <Button
              size="small"
              variant={showAdvanced ? 'contained' : 'outlined'}
              onClick={toggleAdvanced}
              aria-controls={advancedPanelId}
              aria-expanded={showAdvanced}
              aria-pressed={showAdvanced}
              type="button"
            >
              {showAdvanced ? '詳細を閉じる' : '詳細フィルタ'}
            </Button>
          </div>
        )}
        extraControlsLabel="期間"
        onReset={handleClearFilters}
        isResetDisabled={!hasFilters}
        trailingControls={(
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              void reload();
            }}
            disabled={loading}
            type="button"
          >
            {loading ? '更新中…' : '再読み込み'}
          </Button>
        )}
      >
        <div
          className="flex flex-wrap items-center gap-3"
          id={advancedPanelId}
          hidden={!showAdvanced}
          aria-hidden={!showAdvanced}
        >
          <TextField
            size="small"
            type="date"
            label="期間(自)"
            value={fromDate}
            onChange={(event) => handleFromChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="期間(至)"
            value={toDate}
            onChange={(event) => handleToChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={compact}
                onChange={(_, value) => setCompact(value)}
                size="small"
              />
            }
            label="コンパクト表示"
          />
        </div>
      </FilterToolbar>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="px-1 text-sm text-gray-600"
      >
        <span key={statusVersion}>{statusMessage}</span>
        <span aria-hidden="true">（条件変更を反映しました）</span>
      </div>
      {isCardMode ? (
        <div className="space-y-3">
          {filtered.map((row) => {
            const staffLabel = row.staffId != null ? staffNameMap.get(Number(row.staffId)) : '';
            const userLabel = row.userId != null ? userNameMap.get(Number(row.userId)) : '';
            const primaryDate = dateOnly(row.date);
            return (
              <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-gray-900">
                      {row.title?.trim() || '（無題）'}
                      <span className="ml-2 text-xs font-normal text-gray-500">#{row.id}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {primaryDate || '日付未設定'}・{row.startTime ?? '---'}〜{row.endTime ?? '---'}
                    </div>
                    <div className="text-sm text-gray-600">
                      担当: {staffLabel || '未設定'}
                    </div>
                    {row.userId != null ? (
                      <div className="text-sm text-gray-600">
                        利用者: {userLabel ? `${userLabel}（${row.userId}）` : row.userId}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusChip status={row.status} />
                    <Button
                      component={Link}
                      to={`/daily/${row.id}/edit`}
                      size="small"
                      variant="contained"
                      color="primary"
                    >
                      編集
                    </Button>
                  </div>
                </div>
                {row.location ? (
                  <div className="mt-3 text-sm text-gray-700">場所: {row.location}</div>
                ) : null}
                {row.notes ? (
                  <div className="mt-2 text-sm text-gray-700">メモ: {row.notes}</div>
                ) : null}
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>更新: {row.modified ?? '-'}</span>
                  <span>登録: {row.created ?? '-'}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    component={Link}
                    to={`/daily/new?cloneId=${row.id}`}
                    size="small"
                    variant="text"
                  >
                    複製して作成
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className={`min-w-full border border-gray-300 ${tableTextClass}`}>
            <caption className="sr-only">日次記録一覧</caption>
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="border px-2 py-1">ID</th>
                <th className="border px-2 py-1">タイトル</th>
                <th className="border px-2 py-1">日付</th>
                <th className="border px-2 py-1">開始</th>
                <th className="border px-2 py-1">終了</th>
                <th className="border px-2 py-1">場所</th>
                <th className="border px-2 py-1">利用者</th>
                <th className="border px-2 py-1">担当スタッフ</th>
                <th className="border px-2 py-1">メモ</th>
                <th className="border px-2 py-1">食事ログ</th>
                <th className="border px-2 py-1">行動ログ</th>
                <th className="border px-2 py-1">状態</th>
                <th className="border px-2 py-1">最終更新</th>
                <th className="border px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const staffLabel = row.staffId != null ? staffNameMap.get(Number(row.staffId)) : '';
                const userLabel = row.userId != null ? userNameMap.get(Number(row.userId)) : '';
                return (
                  <tr key={row.id} className={`${i % 2 ? 'bg-gray-50' : 'bg-white'} ${rowHoverClass} transition-colors`}>
                    <td className={`${cellClass} text-right font-medium text-gray-800`}>{row.id}</td>
                    <td className={`${cellClass} font-semibold text-gray-900`} title={row.title ?? ''}>
                      {row.title ?? ''}
                    </td>
                    <td className={nowrapCellClass}>{dateOnly(row.date)}</td>
                    <td className={nowrapCellClass}>{row.startTime ?? ''}</td>
                    <td className={nowrapCellClass}>{row.endTime ?? ''}</td>
                    <td className={`${cellClass} text-gray-700`} title={row.location ?? ''}>
                      {row.location ?? ''}
                    </td>
                    <td className={`${cellClass} ${!userLabel && usersLoading ? 'opacity-60' : ''}`}>
                      <span title={userLabel ? `${row.userId}（${userLabel}）` : String(row.userId ?? '')}>
                        {row.userId ?? ''}
                        {row.userId != null && userLabel ? `（${userLabel}）` : ''}
                      </span>
                    </td>
                    <td className={`${cellClass} ${!staffLabel && staffLoading ? 'opacity-60' : ''}`}>
                      <span title={staffLabel ? `${row.staffId}（${staffLabel}）` : String(row.staffId ?? '')}>
                        {row.staffId ?? ''}
                        {row.staffId != null && staffLabel ? `（${staffLabel}）` : ''}
                      </span>
                    </td>
                    <td className={`${cellClass} text-gray-600`}>
                      <span className="line-clamp-2" title={row.notes ?? ''}>
                        {row.notes ?? ''}
                      </span>
                    </td>
                    <td className={`${cellClass} text-gray-600`}>
                      <span className="line-clamp-2" title={row.mealLog ?? ''}>
                        {row.mealLog ?? ''}
                      </span>
                    </td>
                    <td className={cellClass}>
                      <StatusChip status={row.status} />
                    </td>
                    <td className={nowrapCellClass}>
                      <span title={row.modified ?? ''}>{row.modified ? row.modified.slice(0, 16).replace('T', ' ') : ''}</span>
                    </td>
                    <td className={`${cellClass} whitespace-nowrap`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          component={Link}
                          to={`/daily/${row.id}/edit`}
                          size="small"
                          variant="outlined"
                        >
                          編集
                        </Button>
                        <Button
                          component={Link}
                          to={`/daily/new?cloneId=${row.id}`}
                          size="small"
                          variant="text"
                        >
                          複製して作成
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { AllDayChip } from '@/features/schedule/AllDayChip';
import { buildClonedDraft, type CloneStrategy } from '@/features/schedule/clone';
import { normalizeStatus, STATUS_DEFAULT, STATUS_LABELS } from '@/features/schedule/statusDictionary';
import { SCHEDULE_STATUSES, type Status } from '@/features/schedule/types';
import { updateSchedule } from '@/features/schedule/write';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { ui } from '@/i18n/ui';
import { shouldSkipLogin } from '@/lib/env';
import type { Schedule } from '@/lib/mappers';
import { showDemoWriteDisabled, SUCCESS_UPDATED_MSG } from '@/lib/notice';
import { useSP, type UseSP } from '@/lib/spClient';
import { formatInTimeZone } from '@/lib/tz';
import { useSchedules } from '@/stores/useSchedules';
import { RecurrenceChip, type RecurrenceMeta } from '@/ui/components/RecurrenceChip';
import FilterToolbar, { type StatusOption } from '@/ui/filters/FilterToolbar';
import { formatRangeLocal } from '@/utils/datetime';
import { formatCount } from '@/utils/formatCount';
import { getNow } from '@/utils/getNow';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { endOfWeek, startOfWeek } from 'date-fns';
import type { MouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FILTER_STORAGE_KEY = 'schedules.list.v1';
const FILTER_DEBOUNCE_MS = 250;
const SCHEDULE_TIME_ZONE = 'Asia/Tokyo';
const VIRTUAL_PAGE_SIZE = 20;

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'all', label: 'すべて' },
  ...SCHEDULE_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] } satisfies StatusOption)),
];

type StatusFilter = 'all' | Status;
type RangeFilter = 'today' | 'this-week' | 'all';

type Filters = {
  q: string;
  status: StatusFilter;
  range: RangeFilter;
};

type SortField = 'datetime' | 'title';
type SortDirection = 'asc' | 'desc';

type SortState = {
  field: SortField;
  direction: SortDirection;
};

function resolveAriaSort(sortState: SortState, field: SortField): 'ascending' | 'descending' | 'none' {
  if (sortState.field !== field) {
    return 'none';
  }
  return sortState.direction === 'asc' ? 'ascending' : 'descending';
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function resolveToday(): string {
  return formatInTimeZone(getNow(), SCHEDULE_TIME_ZONE, 'yyyy-MM-dd');
}

function resolveWeekBounds(): { start: string; end: string } {
  const now = getNow();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  return {
    start: formatInTimeZone(start, SCHEDULE_TIME_ZONE, 'yyyy-MM-dd'),
    end: formatInTimeZone(end, SCHEDULE_TIME_ZONE, 'yyyy-MM-dd'),
  };
}

function resolveRecurrenceMeta(item: Schedule): RecurrenceMeta | null {
  const recurrenceText = typeof item.recurrenceRaw === 'string'
    ? item.recurrenceRaw
    : typeof item.recurrenceRaw === 'object' && item.recurrenceRaw !== null && 'summary' in item.recurrenceRaw
      ? (() => {
        const summary = (item.recurrenceRaw as { summary?: unknown }).summary;
        return typeof summary === 'string' ? summary : undefined;
      })()
      : undefined;

  if (item.recurrence?.rule || recurrenceText) {
    return { rrule: item.recurrence?.rule, text: recurrenceText };
  }

  return null;
}

function resolveStatusChipColor(status: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  const canonical = normalizeStatus(status);
  switch (canonical) {
    case '申請中':
      return 'info';
    case '承認済み':
    case '完了':
      return 'success';
    case '下書き':
    default:
      return 'warning';
  }
}

function resolveStatusLabel(status?: string | null): string {
  const canonical = normalizeStatus(status);
  return STATUS_LABELS[canonical];
}

function pickStartKey(item: Schedule): string {
  return item.startUtc ?? item.startLocal ?? '';
}

function pickTitle(item: Schedule): string {
  return (item.title ?? '').toLowerCase();
}

const SHAREPOINT_STATUS_OPTIONS = ['Planned', 'InProgress', 'Done', 'Cancelled'] as const;
type SharePointStatus = (typeof SHAREPOINT_STATUS_OPTIONS)[number];

const scheduleStatusToSharePoint = (status: Schedule['status'] | undefined): SharePointStatus => {
  switch (status) {
    case 'submitted':
      return 'InProgress';
    case 'approved':
      return 'Done';
    case 'draft':
    default:
      return 'Planned';
  }
};

const toDateTimeLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoStringFromLocal = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const parseNumberOrNull = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function ScheduleListView() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useSchedules();
  const sp = useSP();
  const tableLabelId = useId();

  const { filters, debounced, update, reset, isDebouncing } = usePersistedFilters<Filters>({
    storageKey: FILTER_STORAGE_KEY,
    defaults: { q: '', status: 'all', range: 'today' },
    debounceKeys: ['q'],
    debounceMs: FILTER_DEBOUNCE_MS,
  });

  const [sort, setSort] = useState<SortState>({ field: 'datetime', direction: 'asc' });
  const [visibleCount, setVisibleCount] = useState<number>(VIRTUAL_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<Schedule | null>(null);
  const todayKey = useMemo(resolveToday, []);
  const weekBounds = useMemo(resolveWeekBounds, []);

  const schedules = useMemo(() => (data ?? []).slice(), [data]);

  const filtered = useMemo(() => {
    const activeFilters = isDebouncing ? filters : debounced;
    const query = normalizeQuery(activeFilters.q);
    const { status, range } = activeFilters;
    const canonicalStatus = status !== 'all' ? normalizeStatus(status) : null;

    return schedules.filter((item) => {
      if (canonicalStatus && normalizeStatus(item.status) !== canonicalStatus) {
        return false;
      }

      if (range !== 'all') {
        const startDate = item.startDate ?? '';
        const endDate = item.endDate ?? startDate;
        if (range === 'today') {
          if (!startDate || todayKey < startDate || todayKey > endDate) {
            return false;
          }
        } else if (range === 'this-week') {
          if (!startDate || weekBounds.start > endDate || weekBounds.end < startDate) {
            return false;
          }
        }
      }

      if (!query) {
        return true;
      }

      const candidate = [item.title, item.location, typeof item.notes === 'string' ? item.notes : '']
        .join(' ')
        .toLowerCase();
      return candidate.includes(query);
    });
  }, [debounced, filters, isDebouncing, schedules, todayKey, weekBounds.end, weekBounds.start]);

  const sorted = useMemo(() => {
    const base = filtered.slice();
    base.sort((a, b) => {
      if (sort.field === 'title') {
        return sort.direction === 'asc'
          ? pickTitle(a).localeCompare(pickTitle(b))
          : pickTitle(b).localeCompare(pickTitle(a));
      }

      const aKey = pickStartKey(a);
      const bKey = pickStartKey(b);
      if (aKey === bKey) {
        const aId = Number(a.id ?? 0);
        const bId = Number(b.id ?? 0);
        return sort.direction === 'asc' ? aId - bId : bId - aId;
      }

      return sort.direction === 'asc' ? aKey.localeCompare(bKey) : bKey.localeCompare(aKey);
    });
    return base;
  }, [filtered, sort.direction, sort.field]);

  const visibleRows = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);

  useEffect(() => {
    setVisibleCount(VIRTUAL_PAGE_SIZE);
  }, [filtered, sort.direction, sort.field]);

  useEffect(() => {
    if (visibleCount >= sorted.length) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((prev) => Math.min(prev + VIRTUAL_PAGE_SIZE, sorted.length));
      }
    }, { rootMargin: '160px' });

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [sorted.length, visibleCount]);

  useEffect(() => {
    if (!selected) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected]);

  const handleDuplicate = useCallback((row: Schedule, strategy: CloneStrategy = 'nextWeekday') => {
    const draft = buildClonedDraft(row, strategy);
    if (!draft) return;
    navigate('/schedule/new', { state: { draft, sourceId: row.id, strategy } });
  }, [navigate]);

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => {
      if (prev.field !== field) {
        return { field, direction: 'asc' };
      }
      return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);

  const loadingNotice = loading && !data;
  const totalCount = schedules.length;
  const filteredCount = sorted.length;
  const shouldShowEmpty = !loadingNotice && !filteredCount;

  return (
    <div className="space-y-4" aria-live={loading ? 'polite' : 'off'} data-testid="schedule-list-root">
      <FilterToolbar
        toolbarLabel={ui.filters.schedule}
        query={filters.q}
        onQueryChange={(value) => update('q', value)}
        debounceMs={FILTER_DEBOUNCE_MS}
        debounceState={isDebouncing ? 'busy' : 'idle'}
        searchPlaceholder="予定名 / メモ / 担当"
        statusOptions={STATUS_OPTIONS}
        activeStatus={filters.status}
        scope="schedule"
        onStatusChange={(next) => {
          if (next === 'all') {
            update('status', 'all');
            return;
          }
          const canonical = normalizeStatus(next);
          if (SCHEDULE_STATUSES.includes(canonical)) {
            update('status', canonical);
          }
        }}
        extraControls={(
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="small"
              variant={filters.range === 'today' ? 'contained' : 'outlined'}
              onClick={() => update('range', 'today')}
              aria-pressed={filters.range === 'today'}
              type="button"
            >
              今日
            </Button>
            <Button
              size="small"
              variant={filters.range === 'this-week' ? 'contained' : 'outlined'}
              onClick={() => update('range', 'this-week')}
              aria-pressed={filters.range === 'this-week'}
              type="button"
            >
              今週
            </Button>
            <Button
              size="small"
              variant={filters.range === 'all' ? 'contained' : 'outlined'}
              onClick={() => update('range', 'all')}
              aria-pressed={filters.range === 'all'}
              type="button"
            >
              すべて
            </Button>
          </div>
        )}
        onReset={() => reset()}
        isResetDisabled={filters.q.trim().length === 0 && filters.status === 'all' && filters.range === 'today'}
      />

      <div role="status" aria-live="polite" aria-atomic="true" className="px-1 text-sm text-gray-600">
        {formatCount(totalCount, filteredCount)}（条件変更を反映しました）
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </div>
      ) : null}

      {loadingNotice ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-64 w-full animate-pulse rounded bg-gray-200" />
        </div>
      ) : shouldShowEmpty ? (
        <div
          className="space-y-2 rounded border border-dashed border-gray-300 p-4 text-sm text-gray-600"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="schedule-list-empty-state"
        >
          <div>条件に一致する予定が見つかりませんでした。/ No schedules found for the selected filters.</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outlined" size="small" onClick={() => void reload()} disabled={loading}>
              {loading ? '更新中…' : '再読み込み'}
            </Button>
            <Button variant="text" size="small" onClick={() => reset()}>
              絞り込みをクリア
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto" data-testid="schedule-list-view">
          <table className="min-w-full border border-gray-300 text-sm" aria-busy={loading ? 'true' : 'false'} aria-labelledby={tableLabelId}>
            <caption id={tableLabelId} className="sr-only">スケジュール一覧</caption>
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="border px-2 py-1 text-left"
                  scope="col"
                  data-sort-field="title"
                  aria-sort={resolveAriaSort(sort, 'title')}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort('title')}
                    aria-label="タイトルで並べ替え"
                  >
                    タイトル
                    <SortIndicator active={sort.field === 'title'} direction={sort.field === 'title' ? sort.direction : undefined} />
                  </button>
                </th>
                <th
                  className="border px-2 py-1 text-left"
                  scope="col"
                  data-sort-field="datetime"
                  aria-sort={resolveAriaSort(sort, 'datetime')}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort('datetime')}
                    aria-label="日時で並べ替え"
                  >
                    日時
                    <SortIndicator active={sort.field === 'datetime'} direction={sort.field === 'datetime' ? sort.direction : undefined} />
                  </button>
                </th>
                <th className="border px-2 py-1 text-left" scope="col" aria-sort="none">場所</th>
                <th className="border px-2 py-1 text-left" scope="col" aria-sort="none">担当</th>
                <th className="border px-2 py-1 text-left" scope="col" aria-sort="none">利用者</th>
                <th className="border px-2 py-1 text-left" scope="col" aria-sort="none">状態</th>
                <th className="border px-2 py-1 text-left" scope="col" aria-sort="none">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => {
                const recurrenceMeta = resolveRecurrenceMeta(item);
                const hasRecurrence = Boolean(recurrenceMeta);
                const canDuplicate = Boolean((item.startUtc ?? item.startLocal) && (item.endUtc ?? item.endLocal));
                const isSelected = selected?.id === item.id;
                const viewCategory = item.category ?? 'unknown';

                return (
                  <ScheduleRowItem
                    key={item.id}
                    item={item}
                    recurrenceMeta={recurrenceMeta}
                    hasRecurrence={hasRecurrence}
                    canDuplicate={canDuplicate}
                    isSelected={isSelected}
                    viewCategory={viewCategory}
                    onSelect={() => setSelected(item)}
                    handleDuplicate={handleDuplicate}
                    reload={reload}
                    sp={sp}
                  />
                );
              })}
            </tbody>
          </table>
          <div
            ref={sentinelRef}
            data-testid="list-sentinel"
            aria-hidden="true"
            data-active={visibleCount < sorted.length ? '1' : '0'}
            className={visibleCount < sorted.length ? 'h-10 w-full' : 'h-0 w-full'}
          />
        </div>
      )}

      {selected ? (
        <DetailDialog schedule={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

type SortIndicatorProps = {
  active: boolean;
  direction?: SortDirection;
};

function SortIndicator({ active, direction }: SortIndicatorProps) {
  if (!active) {
    return <span aria-hidden="true" className="text-xs text-gray-400">↕</span>;
  }
  return (
    <span aria-hidden="true" className="text-xs text-indigo-600">
      {direction === 'desc' ? '↓' : '↑'}
    </span>
  );
}

type DetailDialogProps = {
  schedule: Schedule;
  onClose: () => void;
};

function DetailDialog({ schedule, onClose }: DetailDialogProps) {
  const handleBackdropClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const recurrenceMeta = resolveRecurrenceMeta(schedule);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="予定の詳細"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
      data-testid="schedule-detail-dialog"
    >
      <div className="max-w-lg w-full space-y-3 rounded-lg bg-white p-5 shadow-xl" role="document">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{schedule.title || '無題の予定'}</h2>
            <p className="text-sm text-gray-600">
              {formatRangeLocal(schedule.startLocal ?? schedule.startUtc, schedule.endLocal ?? schedule.endUtc, { roundTo: 5, tz: SCHEDULE_TIME_ZONE })}
            </p>
          </div>
          <button
            type="button"
            className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
        <div className="grid gap-2 text-sm text-gray-700">
          <div>場所: {schedule.location || '未設定'}</div>
          <div>担当: {schedule.staffId != null ? `#${schedule.staffId}` : '未割当'}</div>
          <div>利用者: {schedule.userId != null ? `#${schedule.userId}` : '未指定'}</div>
          <div>状態: {schedule.statusLabel ?? resolveStatusLabel(schedule.status)}</div>
          <div>繰り返し: {recurrenceMeta?.text || recurrenceMeta?.rrule || 'なし'}</div>
        </div>
        {typeof schedule.notes === 'string' && schedule.notes.trim().length ? (
          <div className="rounded border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-indigo-900" aria-label="メモ">
            {schedule.notes}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type BannerState = {
  message: string;
  tone: 'success' | 'error';
};

type ScheduleRowItemProps = {
  item: Schedule;
  recurrenceMeta: RecurrenceMeta | null;
  hasRecurrence: boolean;
  canDuplicate: boolean;
  isSelected: boolean;
  viewCategory: string;
  onSelect: () => void;
  handleDuplicate: (row: Schedule, strategy?: CloneStrategy) => void;
  reload: () => Promise<Schedule[] | null | undefined>;
  sp: UseSP;
};

function ScheduleRowItem({
  item,
  recurrenceMeta,
  hasRecurrence,
  canDuplicate,
  isSelected,
  viewCategory,
  onSelect,
  handleDuplicate,
  reload,
  sp,
}: ScheduleRowItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title || '');
  const [eventStartInput, setEventStartInput] = useState(toDateTimeLocalInput(item.startUtc ?? item.startLocal ?? null));
  const [eventEndInput, setEventEndInput] = useState(toDateTimeLocalInput(item.endUtc ?? item.endLocal ?? null));
  const [allDay, setAllDay] = useState(Boolean(item.allDay));
  const [location, setLocation] = useState(item.location ?? '');
  const [status, setStatus] = useState<SharePointStatus>(scheduleStatusToSharePoint(item.status));
  const [notes, setNotes] = useState(item.notes ?? '');
  const [staffIdInput, setStaffIdInput] = useState(item.staffId != null ? String(item.staffId) : '');
  const [userIdInput, setUserIdInput] = useState(item.userId != null ? String(item.userId) : '');
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setTitle(item.title || '');
    setEventStartInput(toDateTimeLocalInput(item.startUtc ?? item.startLocal ?? null));
    setEventEndInput(toDateTimeLocalInput(item.endUtc ?? item.endLocal ?? null));
    setAllDay(Boolean(item.allDay));
    setLocation(item.location ?? '');
    setStatus(scheduleStatusToSharePoint(item.status));
    setNotes(item.notes ?? '');
    setStaffIdInput(item.staffId != null ? String(item.staffId) : '');
    setUserIdInput(item.userId != null ? String(item.userId) : '');
  }, [item]);

  useEffect(() => {
    if (!editing) {
      resetForm();
    }
  }, [editing, resetForm]);

  useEffect(() => {
    setBanner(null);
  }, [item.etag, item.id]);

  const handleRowClick = useCallback(() => {
    if (editing) {
      return;
    }
    onSelect();
  }, [editing, onSelect]);

  const handleRowKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTableRowElement>) => {
    if (editing) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  }, [editing, onSelect]);

  const handleEditClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    resetForm();
    setBanner(null);
    setEditing(true);
  }, [resetForm]);

  const handleCancel = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setEditing(false);
    resetForm();
    setBanner(null);
  }, [resetForm]);

  const handleSave = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (saving) {
      return;
    }
    if (shouldSkipLogin()) {
      showDemoWriteDisabled((message) => setBanner({ message, tone: 'error' }));
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle.length) {
      setBanner({ message: 'タイトルを入力してください', tone: 'error' });
      return;
    }
    if (location.length > 255) {
      setBanner({ message: '場所は255文字以内で入力してください', tone: 'error' });
      return;
    }
    if (notes.length > 2000) {
      setBanner({ message: 'メモは2000文字以内で入力してください', tone: 'error' });
      return;
    }

    const patch: Record<string, unknown> = {};

    if (trimmedTitle !== (item.title ?? '')) {
      patch.Title = trimmedTitle;
    }

    const eventIso = toIsoStringFromLocal(eventStartInput);
    const originalEventIso = item.startUtc ?? null;
    if (eventIso && eventIso !== originalEventIso) {
      patch.EventDate = eventIso;
    }

    const endIso = toIsoStringFromLocal(eventEndInput);
    const originalEndIso = item.endUtc ?? null;
    if (endIso && endIso !== originalEndIso) {
      patch.EndDate = endIso;
    }

    if (allDay !== Boolean(item.allDay)) {
      patch.AllDay = allDay;
    }

    if (location !== (item.location ?? '')) {
      patch.Location = location;
    }

    const originalStatusSp = scheduleStatusToSharePoint(item.status);
    if (status !== originalStatusSp) {
      patch.Status = status;
    }

    if (notes !== (item.notes ?? '')) {
      patch.Notes = notes;
    }

    const staffIdNormalized = parseNumberOrNull(staffIdInput);
    if (staffIdNormalized !== (item.staffId ?? null)) {
      patch.StaffIdId = staffIdNormalized;
    }

    const userIdNormalized = parseNumberOrNull(userIdInput);
    if (userIdNormalized !== (item.userId ?? null)) {
      patch.UserIdId = userIdNormalized;
    }

    if (Object.keys(patch).length === 0) {
      setBanner({ message: '変更はありません', tone: 'error' });
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      await updateSchedule(sp, {
        id: item.id,
        etag: item.etag ?? undefined,
        patch,
      });
      await reload();
      setBanner({ message: SUCCESS_UPDATED_MSG, tone: 'success' });
      setEditing(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[schedule] update failed', error);
      const message = error instanceof Error ? error.message : String(error);
      setBanner({ message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  }, [allDay, eventEndInput, eventStartInput, item, location, notes, reload, saving, sp, staffIdInput, status, title, userIdInput]);

  const bannerClass = banner?.tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-700'
    : 'border-red-200 bg-red-50 text-red-700';

  return (
    <tr
      className={`cursor-pointer transition focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 ${isSelected ? 'bg-indigo-50' : 'odd:bg-white even:bg-gray-50'}`}
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      data-testid={`schedule-row-${item.id}`}
      data-schedule-row="true"
      data-id={item.id}
      data-status={normalizeStatus(item.status ?? STATUS_DEFAULT)}
      data-category={viewCategory}
      data-all-day={item.allDay ? '1' : '0'}
      data-recurrence={hasRecurrence ? '1' : '0'}
    >
      <td className="border px-2 py-1 font-medium text-gray-900">
        {editing ? (
          <input
            type="text"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            data-testid="se-title"
            aria-label="タイトル"
            disabled={saving}
          />
        ) : (
          item.title || '無題の予定'
        )}
      </td>
      <td className="border px-2 py-1 text-gray-700">
        {editing ? (
          <div className="flex flex-col gap-2 text-xs text-gray-600">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-gray-700">開始</span>
              <input
                type="datetime-local"
                className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
                value={eventStartInput}
                onChange={(event) => setEventStartInput(event.target.value)}
                data-testid="se-event"
                disabled={saving}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-gray-700">終了</span>
              <input
                type="datetime-local"
                className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
                value={eventEndInput}
                onChange={(event) => setEventEndInput(event.target.value)}
                data-testid="se-end"
                disabled={saving}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={allDay}
                onChange={(event) => setAllDay(event.target.checked)}
                data-testid="se-allday"
                disabled={saving}
              />
              終日
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span>{formatRangeLocal(item.startLocal ?? item.startUtc, item.endLocal ?? item.endUtc, { roundTo: 5, tz: SCHEDULE_TIME_ZONE })}</span>
            {item.allDay ? <AllDayChip /> : null}
            <RecurrenceChip meta={recurrenceMeta} />
          </div>
        )}
      </td>
      <td className="border px-2 py-1 text-gray-700">
        {editing ? (
          <input
            type="text"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            data-testid="se-location"
            aria-label="場所"
            maxLength={255}
            disabled={saving}
          />
        ) : (
          item.location || '未設定'
        )}
      </td>
      <td className="border px-2 py-1 text-gray-700">
        {editing ? (
          <input
            type="number"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
            value={staffIdInput}
            onChange={(event) => setStaffIdInput(event.target.value)}
            data-testid="se-staffid"
            aria-label="スタッフ ID"
            disabled={saving}
          />
        ) : item.staffId != null ? (
          `#${item.staffId}`
        ) : (
          '未割当'
        )}
      </td>
      <td className="border px-2 py-1 text-gray-700">
        {editing ? (
          <input
            type="number"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
            data-testid="se-userid"
            aria-label="利用者 ID"
            disabled={saving}
          />
        ) : item.userId != null ? (
          `#${item.userId}`
        ) : (
          '未指定'
        )}
      </td>
      <td className="border px-2 py-1 text-gray-700">
        {editing ? (
          <select
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
            value={status}
            onChange={(event) => setStatus(event.target.value as SharePointStatus)}
            data-testid="se-status"
            aria-label="ステータス"
            disabled={saving}
          >
            {SHAREPOINT_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <Chip
            data-testid="schedule-status"
            data-status-chip="true"
            data-status={normalizeStatus(item.status ?? STATUS_DEFAULT)}
            label={item.statusLabel ?? resolveStatusLabel(item.status)}
            color={resolveStatusChipColor(item.status ?? STATUS_DEFAULT)}
            size="small"
          />
        )}
      </td>
      <td className="border px-2 py-1 text-gray-700">
        <div className="flex flex-col gap-2">
          {banner ? (
            <div className={`rounded border px-2 py-1 text-xs ${bannerClass}`} role="alert">
              {banner.message}
            </div>
          ) : null}
          {!editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-100"
                onClick={handleEditClick}
                data-testid={`schedule-edit-${item.id}`}
              >
                編集
              </button>
              <Tooltip title="複製して作成">
                <span>
                  <IconButton
                    aria-label="この予定を複製して新規作成"
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDuplicate(item, 'nextWeekday');
                    }}
                    disabled={!canDuplicate}
                  >
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                <span className="font-medium text-gray-700">メモ</span>
                <textarea
                  className="h-20 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  data-testid="se-notes"
                  maxLength={2000}
                  disabled={saving}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-indigo-500 bg-indigo-500 px-2 py-1 text-xs text-white transition hover:bg-indigo-600 disabled:opacity-60"
                  onClick={handleSave}
                  data-testid="schedule-save"
                  disabled={saving}
                >
                  保存
                </button>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-100"
                  onClick={handleCancel}
                  data-testid="schedule-cancel"
                  disabled={saving}
                >
                  取消
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export const __test__ = {
  ScheduleRowItem,
};

import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useSchedules } from '@/stores/useSchedules';
import { useSP } from '@/lib/spClient';
import { getMonthlySchedule } from '@/features/schedule/spClient.schedule';
import { cn } from '@/ui/cn';

type RawSchedule = {
  id?: string | number;
  title?: string | null;
  start?: string | null;
  startUtc?: string | null;
  startLocal?: string | null;
  dayKey?: string | null;
};

type MonthEntry = {
  id: string;
  title: string;
  startIso: string;
  dayKey: string;
};

type MonthViewState = {
  entries: MonthEntry[];
  loading: boolean;
  error: string | null;
};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const sanitizeIso = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
};

const normalizeDayKey = (value: string | null | undefined, fallbackIso: string | null): string | null => {
  if (typeof value === 'string' && value.trim()) {
    const digits = value.replace(/[^0-9]/g, '');
    if (/^\d{8}$/.test(digits)) {
      return digits;
    }
  }
  if (!fallbackIso) return null;
  return fallbackIso.slice(0, 10).replace(/-/g, '');
};

const toMonthEntries = (input: readonly RawSchedule[] | null | undefined): MonthEntry[] => {
  if (!input?.length) return [];
  return input
    .map((item, index) => {
      const iso = sanitizeIso(item.start ?? item.startLocal ?? item.startUtc);
      const dayKey = normalizeDayKey(item.dayKey ?? null, iso);
      if (!iso || !dayKey) {
        return null;
      }
      const id = item.id ?? `anon-${index}`;
      const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
      return {
        id: String(id),
        title: rawTitle || '予定',
        startIso: iso,
        dayKey,
      } satisfies MonthEntry;
    })
    .filter((entry): entry is MonthEntry => Boolean(entry));
};

const groupByDayKey = (entries: readonly MonthEntry[]): Record<string, MonthEntry[]> =>
  entries.reduce<Record<string, MonthEntry[]>>((acc, entry) => {
    if (!acc[entry.dayKey]) {
      acc[entry.dayKey] = [entry];
    } else {
      acc[entry.dayKey]!.push(entry);
    }
    return acc;
  }, {});

const extractDemoEntries = (raw: unknown): MonthEntry[] => {
  if (!Array.isArray(raw)) return [];
  return toMonthEntries(raw as RawSchedule[]);
};

export default function MonthView() {
  const sp = useSP();
  const { data: demoSchedules } = useSchedules();
  const fallbackEntries = useMemo(() => extractDemoEntries(demoSchedules ?? []), [demoSchedules]);
  const [referenceDate, setReferenceDate] = useState<Date>(() => startOfMonth(new Date()));
  const [{ entries, loading, error }, setState] = useState<MonthViewState>({
    entries: fallbackEntries,
    loading: false,
    error: null,
  });

  useEffect(() => {
    setState((prev) => ({ ...prev, entries: fallbackEntries }));
  }, [fallbackEntries]);

  const load = useCallback(
    async (target: Date) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const rows = await getMonthlySchedule(sp, {
          year: target.getFullYear(),
          month: target.getMonth() + 1,
        });
        const nextEntries = toMonthEntries(rows as unknown as RawSchedule[]);
        setState({ entries: nextEntries, loading: false, error: null });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '予定の取得に失敗しました';
        setState({ entries: fallbackEntries, loading: false, error: message });
      }
    },
    [fallbackEntries, sp]
  );

  useEffect(() => {
    load(referenceDate).catch(() => {
      /* エラーは state に反映済み */
    });
  }, [load, referenceDate]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(referenceDate);
    const monthEnd = endOfMonth(referenceDate);
    const rangeStart = startOfWeek(monthStart, { locale: ja });
    const rangeEnd = endOfWeek(monthEnd, { locale: ja });
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const grouped = groupByDayKey(entries);

    return days.map((date) => {
      const key = format(date, 'yyyyMMdd');
      return {
        date,
        key,
        isCurrentMonth: isSameMonth(date, referenceDate),
        entries: grouped[key] ?? [],
      };
    });
  }, [entries, referenceDate]);

  const monthLabel = useMemo(() => format(referenceDate, 'yyyy年 M月', { locale: ja }), [referenceDate]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900" aria-live="polite">
          スケジュール（月表示）
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outlined"
            size="small"
            onClick={() => setReferenceDate((prev) => addMonths(prev, -1))}
            aria-label="前の月へ移動"
          >
            前の月
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setReferenceDate(startOfMonth(new Date()))}
            aria-label="今月に移動"
          >
            今月
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setReferenceDate((prev) => addMonths(prev, 1))}
            aria-label="次の月へ移動"
          >
            次の月
          </Button>
        </div>
      </header>

      <div className="text-sm text-slate-600">{monthLabel}</div>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <div className="grid grid-cols-7 gap-2 text-sm font-semibold text-slate-600" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} role="columnheader" className="text-center">
            {label}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-2"
        role="grid"
        aria-label="月間スケジュール"
        data-testid="schedule-month-grid"
      >
        {calendarDays.map(({ date, key, isCurrentMonth, entries: dayEntries }) => (
          <div
            key={key}
            role="gridcell"
            aria-selected={isCurrentMonth}
            className={cn(
              'min-h-[120px] rounded-md border p-2 text-sm transition duration-150',
              isCurrentMonth ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 text-slate-400'
            )}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>{format(date, 'd')}</span>
              <span className="text-[10px] text-slate-400">{format(date, 'EEE', { locale: ja })}</span>
            </div>
            {loading ? (
              <Skeleton variant="rectangular" height={12} sx={{ mt: 1 }} />
            ) : dayEntries.length ? (
              <ul className="mt-2 space-y-1">
                {dayEntries.slice(0, 3).map((item) => (
                  <li
                    key={`${item.id}-${item.startIso}`}
                    className="truncate rounded-sm bg-indigo-50 px-1 py-0.5 text-[11px] text-indigo-700"
                    data-testid="schedule-item"
                  >
                    {item.title}
                  </li>
                ))}
                {dayEntries.length > 3 ? (
                  <li className="text-[10px] text-slate-500">+{dayEntries.length - 3} 件</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-4 text-[11px] text-slate-400">予定なし</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

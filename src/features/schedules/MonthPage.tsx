import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { useAnnounce } from '@/a11y/LiveAnnouncer';
import Loading from '@/ui/components/Loading';
import { TESTIDS } from '@/testids';
import type { ScheduleCategory } from './domain/types';
import { getDayChipSx } from './theme/dateStyles';
import { DayPopover } from './components/DayPopover';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SchedItem } from './data';

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

type CalendarDay = {
  iso: string;
  day: number;
  weekDayIndex: number;
  inMonth: boolean;
  isToday: boolean;
  eventCount: number;
  firstTitle?: string;
};

type CalendarWeek = {
  id: string;
  days: CalendarDay[];
};

type MonthPageProps = {
  items: SchedItem[];
  loading?: boolean;
  activeCategory?: 'All' | ScheduleCategory;
};

export default function MonthPage({ items, loading = false, activeCategory = 'All' }: MonthPageProps) {
  const announce = useAnnounce();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedIso = searchParams.get('date');
  const focusDate = useMemo(() => parseDateParam(requestedIso), [requestedIso]);
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfMonth(focusDate));
  const [activeDateIso, setActiveDateIso] = useState<string>(() => toDateIso(focusDate));

  useEffect(() => {
    const nextAnchor = startOfMonth(focusDate);
    setAnchorDate((prev) => (prev.getTime() === nextAnchor.getTime() ? prev : nextAnchor));
    const nextIso = toDateIso(focusDate);
    setActiveDateIso((prev) => (prev === nextIso ? prev : nextIso));
  }, [focusDate]);

  useEffect(() => {
    if (requestedIso) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('date', toDateIso(focusDate));
    setSearchParams(next, { replace: true });
  }, [focusDate, requestedIso, searchParams, setSearchParams]);

  const resolvedActiveDateIso = activeDateIso ?? toDateIso(anchorDate);

  const daySummaries = useMemo(() => buildDaySummaries(items), [items]);
  const weeks = useMemo(
    () => buildCalendarWeeks(anchorDate, daySummaries.counts, daySummaries.firstTitle),
    [anchorDate, daySummaries],
  );

  const monthLabel = useMemo(() => formatMonthLabel(anchorDate), [anchorDate]);
  const monthAnnouncement = useMemo(() => formatMonthAnnouncement(anchorDate), [anchorDate]);
  const totalCount = useMemo(
    () => countEventsInMonth(daySummaries.counts, anchorDate),
    [daySummaries.counts, anchorDate],
  );

  // Day Popover state
  const [dayPopoverAnchor, setDayPopoverAnchor] = useState<HTMLElement | null>(null);
  const [dayPopoverDateIso, setDayPopoverDateIso] = useState<string | null>(null);

  const isDayPopoverOpen = Boolean(dayPopoverAnchor) && Boolean(dayPopoverDateIso);

  const handleDayPopoverClose = useCallback(() => {
    setDayPopoverAnchor(null);
    setDayPopoverDateIso(null);
  }, []);

  useEffect(() => {
    if (monthAnnouncement) {
      announce(monthAnnouncement);
    }
  }, [announce, monthAnnouncement]);

  const handleDaySelect = useCallback(
    (e: React.MouseEvent<HTMLElement>, iso: string) => {
      // Open popover instead of navigating directly
      setDayPopoverAnchor(e.currentTarget);
      setDayPopoverDateIso(iso);
    },
    [],
  );

  const handleOpenDay = useCallback(
    (iso: string) => {
      setActiveDateIso(iso);
      const next = new URLSearchParams(searchParams);
      next.set('date', iso);
      setSearchParams(next, { replace: true });
      const nextDate = parseDateParam(iso);
      setAnchorDate(startOfMonth(nextDate));
      // Navigate to day view (now tab within week page)
      const params = new URLSearchParams({ date: iso, tab: 'day' });
      if (activeCategory !== 'All') {
        params.set('lane', activeCategory);
      }
      navigate(`/schedules/week?${params.toString()}`);
    },
    [activeCategory, navigate, searchParams, setSearchParams],
  );

  const getItemsForDate = useCallback(
    (dateIso: string): SchedItem[] => {
      return items.filter((it) => (it.start ?? '').slice(0, 10) === dateIso);
    },
    [items],
  );

  const headingId = TESTIDS.SCHEDULES_MONTH_HEADING_ID;
  const rangeId = TESTIDS.SCHEDULES_MONTH_RANGE_ID;

  const setMonthAnchor = useCallback(
    (nextAnchor: Date) => {
      const nextIso = toDateIso(nextAnchor);
      setAnchorDate(nextAnchor);
      setActiveDateIso(nextIso);
      const next = new URLSearchParams(searchParams);
      next.set('date', nextIso);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const shiftMonth = useCallback(
    (delta: number) => {
      setMonthAnchor(addMonths(anchorDate, delta));
    },
    [anchorDate, setMonthAnchor],
  );

  const handlePrevMonth = useCallback(() => shiftMonth(-1), [shiftMonth]);
  const handleNextMonth = useCallback(() => shiftMonth(1), [shiftMonth]);
  const handleCurrentMonth = useCallback(
    () => {
      setMonthAnchor(startOfMonth(new Date()));
    },
    [setMonthAnchor],
  );

  return (
    <section
      data-testid={TESTIDS.SCHEDULES_MONTH_PAGE}
      aria-label="月間スケジュール"
      aria-labelledby={headingId}
      aria-describedby={rangeId}
      tabIndex={-1}
      style={{ paddingBottom: 32 }}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handlePrevMonth}
          aria-label="前の月へ移動"
          data-testid={TESTIDS.SCHEDULES_MONTH_PREV}
        >
          前
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h6"
            id={headingId}
            data-testid={TESTIDS.SCHEDULES_MONTH_HEADING_ID}
            sx={{ mb: 0.5 }}
          >
            {monthLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            予定 {totalCount} 件
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={handleCurrentMonth}
          aria-label="今月に移動"
        >
          今月
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleNextMonth}
          aria-label="次の月へ移動"
          data-testid={TESTIDS.SCHEDULES_MONTH_NEXT}
        >
          次
        </Button>
      </Box>

      <div
        style={{ padding: '16px 12px 32px' }}
        aria-busy={loading || undefined}
        aria-live={loading ? 'polite' : undefined}
      >
        {loading ? (
          <div style={{ marginBottom: 16 }}>
            <Loading />
          </div>
        ) : null}
        <div role="grid" aria-label={`${monthLabel}のカレンダー`} style={gridContainerStyle}>
          <div role="row" style={{ display: 'contents' }}>
            {WEEKDAY_LABELS.map((label, index) => (
              <div key={label} role="columnheader" style={weekdayHeaderStyle(index)}>
                {label}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week.id} role="row" style={{ display: 'contents' }}>
              {week.days.map((day) => {
                const isSelected = day.iso === resolvedActiveDateIso;
                const ariaLabel = buildDayAriaLabel(day);
                return (
                  <Button
                    key={day.iso}
                    type="button"
                    data-testid={`${TESTIDS.SCHEDULES_MONTH_DAY_PREFIX}-${day.iso}`}
                    aria-label={ariaLabel}
                    aria-current={isSelected ? 'date' : undefined}
                    onClick={(e) => handleDaySelect(e, day.iso)}
                    variant="outlined"
                    fullWidth
                    sx={{
                      ...monthDayBaseSx(day),
                      ...getDayChipSx({ isToday: day.isToday, isSelected }),
                    } as SxProps<Theme>}
                  >
                    <Badge
                      badgeContent={day.eventCount}
                      invisible={!day.eventCount}
                      overlap="circular"
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: '#d32f2f',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          minWidth: 18,
                          height: 18,
                          padding: '0 5px',
                          transform: 'translate(35%, -35%)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        },
                      }}
                    >
                      <span style={dayNumberStyle(day)}>
                        {day.day}
                        {day.isToday ? <span style={todayDotStyle} aria-hidden="true" /> : null}
                        {day.isToday ? (
                          <span style={{ fontSize: 12, color: '#1e88e5', marginLeft: 4 }}>(今日)</span>
                        ) : null}
                      </span>
                    </Badge>
                    {day.firstTitle ? (
                      <Typography sx={dayTitleSx} title={day.firstTitle}>
                        {day.firstTitle}
                        {day.eventCount > 1 ? ` +${day.eventCount - 1}` : ''}
                      </Typography>
                    ) : null}
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
        {!loading && totalCount === 0 ? null : null}
      </div>

      {dayPopoverDateIso && (
        <DayPopover
          open={isDayPopoverOpen}
          anchorEl={dayPopoverAnchor as HTMLButtonElement | null}
          date={dayPopoverDateIso}
          dateLabel={dayPopoverDateIso}
          items={getItemsForDate(dayPopoverDateIso)}
          onClose={handleDayPopoverClose}
          onOpenDay={(dateIso) => {
            handleOpenDay(dateIso);
            handleDayPopoverClose();
          }}
        />
      )}
    </section>
  );
}

const gridContainerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
};

const weekdayHeaderStyle = (index: number): CSSProperties => ({
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: index === 5 ? '#1e88e5' : index === 6 ? '#d14343' : 'rgba(0,0,0,0.65)',
  padding: '4px 0',
});

const monthDayBaseSx = (day: CalendarDay): Record<string, string | number> => ({
  borderRadius: 2,
  borderColor: 'rgba(0,0,0,0.12)',
  textTransform: 'none',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexDirection: 'column',
  padding: '10px 12px',
  minHeight: 90,
  gap: 1,
  color: day.inMonth ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.4)',
  backgroundColor: day.inMonth ? '#fff' : 'rgba(0,0,0,0.02)',
  display: 'flex',
  width: '100%',
  textAlign: 'left',
});

const dayNumberStyle = (day: CalendarDay): CSSProperties => ({
  fontSize: 16,
  fontWeight: day.isToday ? 700 : 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

const dayTitleSx = {
  mt: 0.5,
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(0,0,0,0.75)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
};

const todayDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#1565c0',
  display: 'inline-block',
};

const startOfWeek = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  return next;
};

const startOfMonth = (date: Date): Date => {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addMonths = (date: Date, delta: number): Date => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + delta);
  return startOfMonth(next);
};

const startOfCalendar = (anchor: Date): Date => startOfWeek(startOfMonth(anchor));

const toDateIso = (date: Date): string => date.toISOString().slice(0, 10);

const parseDateParam = (value: string | null): Date => {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const buildDaySummaries = (
  items: SchedItem[],
): { counts: Record<string, number>; firstTitle: Record<string, string> } => {
  const counts: Record<string, number> = {};
  const firstTitle: Record<string, string> = {};

  for (const item of items) {
    const start = new Date(item.start);
    if (Number.isNaN(start.getTime())) continue;
    let end = new Date(item.end ?? item.start);
    if (Number.isNaN(end.getTime()) || end < start) {
      end = new Date(start);
    }
    const cursor = startOfDay(start);
    const boundary = startOfDay(end);
    while (cursor <= boundary) {
      const iso = toDateIso(cursor);
      counts[iso] = (counts[iso] ?? 0) + 1;
      // 先頭1件だけタイトルを保持（既に存在すれば上書きしない）
      if (firstTitle[iso] == null || firstTitle[iso] === '') {
        const title = item.title || item.notes || '';
        if (title) {
          firstTitle[iso] = title;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return { counts, firstTitle };
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const buildCalendarWeeks = (
  anchorDate: Date,
  counts: Record<string, number>,
  firstTitle: Record<string, string>,
): CalendarWeek[] => {
  const start = startOfCalendar(anchorDate);
  const todayIso = toDateIso(new Date());
  const weeks: CalendarWeek[] = [];
  let cursor = new Date(start);
  for (let week = 0; week < 6; week++) {
    const days: CalendarDay[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const iso = toDateIso(cursor);
      days.push({
        iso,
        day: cursor.getDate(),
        weekDayIndex: dayIndex,
        inMonth: cursor.getMonth() === anchorDate.getMonth(),
        isToday: iso === todayIso,
        eventCount: counts[iso] ?? 0,
        firstTitle: firstTitle[iso],
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push({ id: `${days[0]?.iso ?? `${toDateIso(start)}-${week}`}`, days });
  }
  return weeks;
};

const formatMonthLabel = (date: Date): string =>
  new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(date);

const formatMonthAnnouncement = (date: Date): string => {
  const label = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric' }).format(date);
  return `${label}の予定を表示`;
};

const countEventsInMonth = (counts: Record<string, number>, anchorDate: Date): number => {
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = addMonths(monthStart, 1);
  const cursor = new Date(monthStart);
  let total = 0;
  while (cursor < monthEnd) {
    const iso = toDateIso(cursor);
    total += counts[iso] ?? 0;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
};

const buildDayAriaLabel = (day: CalendarDay): string => {
  const dateLabel = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${day.iso}T00:00:00`));
  const countLabel = day.eventCount === 0 ? '予定0件' : `予定${day.eventCount}件`;
  return `${dateLabel} ${countLabel}`;
};

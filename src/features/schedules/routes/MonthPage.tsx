import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { useAnnounce } from '@/a11y/LiveAnnouncer';
import Loading from '@/ui/components/Loading';
import { TESTIDS } from '@/testids';
import type { ScheduleCategory } from '../domain/types';
import { SCHEDULE_MONTH_SPACING } from '../constants';
import { getDayChipSx } from '../theme/dateStyles';
import { DayPopover } from '../components/DayPopover';
import { ScheduleEmptyHint } from '../components/ScheduleEmptyHint';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SchedItem } from '../data';import { toDateKey } from '../lib/dateKey';
const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

type CalendarDay = {
  iso: string;
  day: number;
  weekDayIndex: number;
  inMonth: boolean;
  isToday: boolean;
  eventCount: number;
  titles?: string[];
};

type CalendarWeek = {
  id: string;
  days: CalendarDay[];
};

type MonthPageProps = {
  items: SchedItem[];
  loading?: boolean;
  activeCategory?: 'All' | ScheduleCategory;
  compact?: boolean;
};

export default function MonthPage({ items, loading = false, activeCategory = 'All', compact }: MonthPageProps) {
  const announce = useAnnounce();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCompact = Boolean(compact);
  const requestedIso = searchParams.get('date');
  const focusDate = useMemo(() => parseDateParam(requestedIso), [requestedIso]);
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfMonth(focusDate));
  const [activeDateIso, setActiveDateIso] = useState<string>(() => toDateKey(focusDate));

  useEffect(() => {
    const nextAnchor = startOfMonth(focusDate);
    setAnchorDate((prev) => (prev.getTime() === nextAnchor.getTime() ? prev : nextAnchor));
    const nextIso = toDateKey(focusDate);
    setActiveDateIso((prev) => (prev === nextIso ? prev : nextIso));
  }, [focusDate]);

  useEffect(() => {
    if (requestedIso) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('date', toDateKey(focusDate));
    setSearchParams(next, { replace: true });
  }, [focusDate, requestedIso, searchParams, setSearchParams]);

  const resolvedActiveDateIso = activeDateIso ?? toDateKey(anchorDate);

  const daySummaries = useMemo(() => buildDaySummaries(items), [items]);
  const weeks = useMemo(
    () => buildCalendarWeeks(anchorDate, daySummaries.counts, daySummaries.titles),
    [anchorDate, daySummaries],
  );

  const monthLabel = useMemo(() => formatMonthLabel(anchorDate), [anchorDate]);
  const monthAnnouncement = useMemo(() => formatMonthAnnouncement(anchorDate), [anchorDate]);

  // Height calculation for iPad landscape fixed layout
  const headerRef = useRef<HTMLDivElement>(null);
  const weekdayRef = useRef<HTMLDivElement>(null);
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const [cellMinH, setCellMinH] = useState<number | null>(null);
  const rows = weeks.length;
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

  // Measure and calculate cell height for iPad landscape fixed layout
  useLayoutEffect(() => {
    const wrap = gridWrapRef.current;
    if (!wrap) return;

    const ro = new ResizeObserver(() => {
      const wrapH = wrap.getBoundingClientRect().height;
      const gap = isCompact ? SCHEDULE_MONTH_SPACING.gridGapCompact : SCHEDULE_MONTH_SPACING.gridGapNormal;
      const totalGaps = gap * Math.max(0, rows - 1);
      const availableH = wrapH - totalGaps;
      const cellH = Math.floor(availableH / rows);
      const minAllowed = isCompact ? 56 : 64;
      setCellMinH(Math.max(minAllowed, cellH));
    });

    ro.observe(wrap);
    return () => ro.disconnect();
  }, [isCompact, rows]);

  return (
    <section
      data-testid={TESTIDS.SCHEDULES_MONTH_PAGE}
      aria-label="月間スケジュール"
      aria-labelledby={headingId}
      aria-describedby={rangeId}
      tabIndex={-1}
      style={{
        paddingBottom: 32,
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <div
        ref={headerRef}
        style={{ padding: isCompact ? SCHEDULE_MONTH_SPACING.headerPaddingCompact : SCHEDULE_MONTH_SPACING.headerPaddingNormal }}
        aria-busy={loading || undefined}
        aria-live={loading ? 'polite' : undefined}
      >
        {loading ? (
          <div style={{ marginBottom: isCompact ? 12 : 16 }}>
            <Loading />
          </div>
        ) : null}
        {!loading && totalCount === 0 && (
          <Box sx={{ px: 2, mb: isCompact ? 1 : 2 }}>
            <ScheduleEmptyHint view="month" compact={isCompact} categoryFilter={activeCategory} />
          </Box>
        )}
        <div
          ref={gridWrapRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div role="grid" aria-label={`${monthLabel}のカレンダー`} style={{ ...gridContainerStyle, gap: isCompact ? SCHEDULE_MONTH_SPACING.gridGapCompact : SCHEDULE_MONTH_SPACING.gridGapNormal }}>
            <div ref={weekdayRef} role="row" style={{ display: 'contents' }}>
            {WEEKDAY_LABELS.map((label, index) => (
              <div key={label} role="columnheader" style={{ ...weekdayHeaderStyle(index), fontSize: isCompact ? 10.5 : 12, padding: isCompact ? SCHEDULE_MONTH_SPACING.weekdayHeaderPaddingCompact : SCHEDULE_MONTH_SPACING.weekdayHeaderPaddingNormal }}>
                {label}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div
              key={week.id}
              role="row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gridColumn: 'span 7',
                height: cellMinH ?? (isCompact ? SCHEDULE_MONTH_SPACING.cellMinHeightCompact : SCHEDULE_MONTH_SPACING.cellMinHeightNormal),
                gap: isCompact ? SCHEDULE_MONTH_SPACING.gridGapCompact : SCHEDULE_MONTH_SPACING.gridGapNormal,
              }}
            >
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
                      padding: isCompact ? SCHEDULE_MONTH_SPACING.cellPaddingCompact : SCHEDULE_MONTH_SPACING.cellPaddingNormal,
                      height: '100%',
                      minHeight: 0,
                      overflow: 'hidden',
                      gap: isCompact ? SCHEDULE_MONTH_SPACING.cellGapCompact : SCHEDULE_MONTH_SPACING.cellGapNormal,
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
                      <span style={{ ...dayNumberStyle(day), fontSize: isCompact ? 14 : 16 }}>
                        {day.day}
                        {day.isToday ? <span style={todayDotStyle} aria-hidden="true" /> : null}
                        {day.isToday ? (
                          <span style={{ fontSize: isCompact ? 10 : 12, color: '#1e88e5', marginLeft: 4 }}>(今日)</span>
                        ) : null}
                      </span>
                    </Badge>
                    {day.titles && day.titles.length > 0 ? (
                      <Box sx={{ width: '100%' }}>
                        {day.titles.slice(0, 2).map((title, index, visible) => {
                          const remaining = Math.max(0, day.eventCount - visible.length);
                          const suffix = remaining > 0 && index === visible.length - 1 ? ` +${remaining}` : '';
                          return (
                            <Typography
                              key={`${day.iso}-${index}`}
                              sx={{ ...dayTitleSx, fontSize: isCompact ? 11 : 12, mt: index === 0 ? (isCompact ? 0.25 : 0.5) : 0 }}
                              title={title}
                            >
                              {title}
                              {suffix}
                            </Typography>
                          );
                        })}
                      </Box>
                    ) : null}
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
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
  gap: SCHEDULE_MONTH_SPACING.gridGapNormal,
};

const weekdayHeaderStyle = (index: number): CSSProperties => ({
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: index === 5 ? '#1e88e5' : index === 6 ? '#d14343' : 'rgba(0,0,0,0.65)',
  padding: SCHEDULE_MONTH_SPACING.weekdayHeaderPaddingNormal,
});

const monthDayBaseSx = (day: CalendarDay): Record<string, string | number> => ({
  borderRadius: 2,
  borderColor: 'rgba(0,0,0,0.12)',
  textTransform: 'none',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexDirection: 'column',
  padding: SCHEDULE_MONTH_SPACING.cellPaddingNormal,
  minHeight: SCHEDULE_MONTH_SPACING.cellMinHeightNormal,
  gap: SCHEDULE_MONTH_SPACING.cellGapNormal,
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
): { counts: Record<string, number>; titles: Record<string, string[]> } => {
  const counts: Record<string, number> = {};
  const titles: Record<string, string[]> = {};

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
      const iso = toDateKey(cursor);
      counts[iso] = (counts[iso] ?? 0) + 1;
      const title = item.title || item.notes || '';
      if (title) {
        const bucket = titles[iso] ?? [];
        if (bucket.length < 2) {
          bucket.push(title);
          titles[iso] = bucket;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return { counts, titles };
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const buildCalendarWeeks = (
  anchorDate: Date,
  counts: Record<string, number>,
  titles: Record<string, string[]>,
): CalendarWeek[] => {
  const start = startOfCalendar(anchorDate);
  const todayIso = toDateKey(new Date());
  const weeks: CalendarWeek[] = [];
  let cursor = new Date(start);
  for (let week = 0; week < 6; week++) {
    const days: CalendarDay[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const iso = toDateKey(cursor);
      days.push({
        iso,
        day: cursor.getDate(),
        weekDayIndex: dayIndex,
        inMonth: cursor.getMonth() === anchorDate.getMonth(),
        isToday: iso === todayIso,
        eventCount: counts[iso] ?? 0,
        titles: titles[iso],
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push({ id: `${days[0]?.iso ?? `${toDateKey(start)}-${week}`}`, days });
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
    const iso = toDateKey(cursor);
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

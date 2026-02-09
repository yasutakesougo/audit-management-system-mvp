import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import type { SxProps, Theme } from '@mui/material/styles';
import { useAnnounce } from '@/a11y/LiveAnnouncer';
import Loading from '@/ui/components/Loading';
import { TESTIDS } from '@/testids';
import { makeRange, useSchedules } from './useSchedules';
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
const DEFAULT_START_TIME = '10:00';
const DEFAULT_END_TIME = '11:00';

type CalendarDay = {
  iso: string;
  day: number;
  weekDayIndex: number;
  inMonth: boolean;
  isToday: boolean;
  eventCount: number;
  titles: string[];
};

type CalendarWeek = {
  id: string;
  days: CalendarDay[];
};

export default function MonthPage() {
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

  const calendarRange = useMemo(() => {
    const from = startOfCalendar(anchorDate);
    const to = endOfCalendar(from);
    return makeRange(from, to);
  }, [anchorDate]);

  const { items, loading } = useSchedules(calendarRange);

  const daySummaries = useMemo(() => buildDaySummaries(items), [items]);
  const weeks = useMemo(
    () => buildCalendarWeeks(anchorDate, daySummaries.counts, daySummaries.titles),
    [anchorDate, daySummaries],
  );

  const monthLabel = useMemo(() => formatMonthLabel(anchorDate), [anchorDate]);
  const monthAnnouncement = useMemo(() => formatMonthAnnouncement(anchorDate), [anchorDate]);
  const totalCount = useMemo(
    () => countEventsInMonth(daySummaries.counts, anchorDate),
    [daySummaries.counts, anchorDate],
  );
  const showMonthSummary = !loading && totalCount > 0;

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
      navigate(`/schedules/week?date=${encodeURIComponent(iso)}&tab=day`);
    },
    [navigate, searchParams, setSearchParams],
  );

  const handleCreateOnDay = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, iso: string) => {
      event.preventDefault();
      event.stopPropagation();
      const params = new URLSearchParams();
      params.set('date', iso);
      params.set('tab', 'day');
      params.set('dialog', 'create');
      params.set('dialogDate', iso);
      params.set('dialogStart', DEFAULT_START_TIME);
      params.set('dialogEnd', DEFAULT_END_TIME);
      params.set('dialogCategory', 'User');
      navigate(`/schedules/week?${params.toString()}`);
    },
    [navigate],
  );

  const getItemsForDate = useCallback(
    (dateIso: string): SchedItem[] => {
      return items.filter((it) => (it.start ?? '').slice(0, 10) === dateIso);
    },
    [items],
  );

  const headingId = TESTIDS.SCHEDULES_MONTH_HEADING_ID;
  const rangeId = TESTIDS.SCHEDULES_MONTH_RANGE_ID;

  return (
    <section
      data-testid={TESTIDS.SCHEDULES_MONTH_PAGE}
      aria-label="月間スケジュール"
      aria-labelledby={headingId}
      aria-describedby={rangeId}
      tabIndex={-1}
      style={{ paddingBottom: 16, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <Box sx={{ px: 2, py: 1, flex: '0 0 auto' }}>
        <Typography 
          variant="h6" 
          id={headingId}
          data-testid={TESTIDS.SCHEDULES_MONTH_HEADING_ID}
          sx={{ mb: 0.5 }}
        >
          {monthLabel}
        </Typography>
        {showMonthSummary ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
            予定 {totalCount} 件
          </Typography>
        ) : null}
      </Box>

      <Box
        sx={{ px: 1.5, pb: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        aria-busy={loading || undefined}
        aria-live={loading ? 'polite' : undefined}
      >
        {loading ? (
          <Box sx={{ mb: 1 }}>
            <Loading />
          </Box>
        ) : null}
        <Box role="grid" aria-label={`${monthLabel}のカレンダー`} sx={gridContainerSx}>
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
                const visibleTitles = day.titles.slice(0, 2);
                const restCount = Math.max(day.eventCount - visibleTitles.length, 0);
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
                    <span style={dayNumberStyle(day)}>
                      {day.day}
                      {day.isToday ? <span style={todayDotStyle} aria-hidden="true" /> : null}
                      {day.isToday ? (
                        <span style={{ fontSize: 11, color: '#1e88e5', marginLeft: 4 }}>(今日)</span>
                      ) : null}
                    </span>
                    {visibleTitles.map((title) => (
                      <Typography key={title} sx={dayTitleSx} title={title}>
                        {title}
                      </Typography>
                    ))}
                    {restCount > 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ px: 0.25 }}>
                        +{restCount}
                      </Typography>
                    ) : null}
                    <Box
                      component="span"
                      role="button"
                      tabIndex={0}
                      aria-label={`${day.day}日の予定を追加`}
                      onClick={(event) => handleCreateOnDay(event as React.MouseEvent<HTMLButtonElement>, day.iso)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleCreateOnDay(event as unknown as React.MouseEvent<HTMLButtonElement>, day.iso);
                        }
                      }}
                      sx={addButtonSx}
                    >
                      <AddRoundedIcon fontSize="inherit" />
                    </Box>
                  </Button>
                );
              })}
            </div>
          ))}
        </Box>
      </Box>

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

const gridContainerSx: SxProps<Theme> = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gridTemplateRows: 'auto repeat(6, minmax(0, 1fr))',
  gap: 0.75,
  overflow: 'hidden',
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
  padding: '14px 12px',
  minHeight: 0,
  gap: 0.5,
  color: day.inMonth ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.4)',
  backgroundColor: day.inMonth ? '#fff' : 'rgba(0,0,0,0.02)',
  display: 'flex',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
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
  mt: 0.75,
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(0,0,0,0.72)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
};

const todayDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#1565c0',
  display: 'inline-block',
};

const addButtonSx: SxProps<Theme> = {
  position: 'absolute',
  right: 6,
  bottom: 6,
  width: 22,
  height: 22,
  borderRadius: 999,
  border: '1px solid rgba(148,163,184,0.6)',
  backgroundColor: '#fff',
  color: 'rgba(30,64,175,0.8)',
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  opacity: 0,
  transition: 'opacity 120ms ease',
  '&:hover': { backgroundColor: 'rgba(59,130,246,0.08)' },
  '.MuiButtonBase-root:hover &': { opacity: 1 },
  '&:focus-visible': { opacity: 1 },
  '@media (hover: none)': { opacity: 1 },
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

const endOfCalendar = (start: Date): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + 6 * 7);
  return end;
};

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
      const iso = toDateIso(cursor);
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
        titles: titles[iso] ?? [],
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

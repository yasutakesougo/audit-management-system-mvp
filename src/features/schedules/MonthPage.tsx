import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { useAnnounce } from '@/a11y/LiveAnnouncer';
import EmptyState from '@/ui/components/EmptyState';
import Loading from '@/ui/components/Loading';
import { MASTER_SCHEDULE_TITLE_JA } from '@/features/schedule/constants';
import { TESTIDS } from '@/testids';
import { makeRange, useSchedules } from './useSchedules';
import { getDayChipSx } from './theme/dateStyles';
import { SchedulesHeader } from './components/SchedulesHeader';
import { ScheduleEmptyHint } from './components/ScheduleEmptyHint';
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

  const countsByDay = useMemo(() => buildDayCounts(items), [items]);
  const weeks = useMemo(
    () => buildCalendarWeeks(anchorDate, countsByDay),
    [anchorDate, countsByDay],
  );

  const monthLabel = useMemo(() => formatMonthLabel(anchorDate), [anchorDate]);
  const monthAnnouncement = useMemo(() => formatMonthAnnouncement(anchorDate), [anchorDate]);
  const totalCount = useMemo(() => countEventsInMonth(countsByDay, anchorDate), [countsByDay, anchorDate]);
  const showEmptyHint = !loading && totalCount === 0;

  useEffect(() => {
    if (monthAnnouncement) {
      announce(monthAnnouncement);
    }
  }, [announce, monthAnnouncement]);

  const handleShiftMonth = useCallback((delta: number) => {
    setAnchorDate((prev) => addMonths(prev, delta));
  }, [setAnchorDate]);

  const handleDaySelect = useCallback(
    (iso: string, inMonth: boolean) => {
      setActiveDateIso(iso);
      const next = new URLSearchParams(searchParams);
      next.set('date', iso);
      setSearchParams(next, { replace: true });
      if (!inMonth) {
        const nextDate = parseDateParam(iso);
        setAnchorDate(startOfMonth(nextDate));
      }
      // A2: Navigate to day view with explicit tab (prevents week normalization)
      navigate(`/schedules/day?date=${encodeURIComponent(iso)}&tab=day`);
    },
    [navigate, searchParams, setSearchParams],
  );

  const handleTodayClick = useCallback(() => {
    const today = new Date();
    const todayIso = toDateIso(today);
    setAnchorDate(startOfMonth(today));
    setActiveDateIso(todayIso);
    const next = new URLSearchParams(searchParams);
    next.set('date', todayIso);
    setSearchParams(next, { replace: true });
    // A3: Return to today in month view
    navigate(`/schedules/month?date=${encodeURIComponent(todayIso)}&tab=month`);
  }, [navigate, searchParams, setSearchParams, setActiveDateIso, setAnchorDate]);

  const headingId = TESTIDS.SCHEDULES_MONTH_HEADING_ID;
  const rangeId = TESTIDS.SCHEDULES_MONTH_RANGE_ID;
  const dayHref = useMemo(
    () => `/schedules/day?date=${encodeURIComponent(resolvedActiveDateIso)}&tab=day`,
    [resolvedActiveDateIso],
  );
  const weekHref = useMemo(() => `/schedules/week?date=${resolvedActiveDateIso}`, [resolvedActiveDateIso]);
  const monthHref = useMemo(
    () => `/schedules/month?date=${resolvedActiveDateIso}`,
    [resolvedActiveDateIso],
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
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          backgroundColor: (theme) => theme.palette.background.paper,
          backdropFilter: 'blur(6px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: 2,
          py: 2,
        }}
      >
        <SchedulesHeader
          mode="month"
          title={MASTER_SCHEDULE_TITLE_JA}
          subLabel="月表示（全体カレンダー）"
          periodLabel={`表示月: ${monthLabel}`}
          onPrev={() => handleShiftMonth(-1)}
          onNext={() => handleShiftMonth(1)}
          onToday={handleTodayClick}
          dayHref={dayHref}
          weekHref={weekHref}
          monthHref={monthHref}
          headingId={headingId}
          titleTestId={TESTIDS.SCHEDULES_MONTH_HEADING_ID}
          rangeLabelId={rangeId}
          rangeTestId={TESTIDS.SCHEDULES_MONTH_RANGE_ID}
          prevTestId={TESTIDS.SCHEDULES_MONTH_PREV}
          nextTestId={TESTIDS.SCHEDULES_MONTH_NEXT}
          showPrimaryAction={false}
        >
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
            予定 {totalCount} 件
          </Typography>
        </SchedulesHeader>
      </Box>

      <div
        style={{ padding: '16px 12px 32px' }}
        aria-busy={loading || undefined}
        aria-live={loading ? 'polite' : undefined}
      >
        {showEmptyHint ? (
          <ScheduleEmptyHint view="month" periodLabel={monthLabel} sx={{ mb: 2 }} />
        ) : null}
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
                    onClick={() => handleDaySelect(day.iso, day.inMonth)}
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
                        <span style={{ fontSize: 12, color: '#1e88e5', marginLeft: 4 }}>(今日)</span>
                      ) : null}
                    </span>
                    <span style={eventCountStyle(day)}>
                      {day.eventCount > 0 ? `予定 ${day.eventCount} 件` : '予定 0 件'}
                    </span>
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
        {!loading && totalCount === 0 ? (
          <div style={{ marginTop: 24 }}>
            <EmptyState
              title="この月の予定はありません"
              description="別の日付や条件で再度お試しください。"
              data-testid="schedule-month-empty"
            />
          </div>
        ) : null}
      </div>
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

const todayDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#1565c0',
  display: 'inline-block',
};

const eventCountStyle = (day: CalendarDay): CSSProperties => ({
  fontSize: 12,
  fontWeight: 600,
  color: day.eventCount > 0 ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)',
});

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

const buildDayCounts = (items: SchedItem[]): Record<string, number> => {
  const counts: Record<string, number> = {};
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
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return counts;
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const buildCalendarWeeks = (anchorDate: Date, counts: Record<string, number>): CalendarWeek[] => {
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

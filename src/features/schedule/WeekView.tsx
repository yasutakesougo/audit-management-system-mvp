import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import { ScheduleConflictGuideDialog, type SuggestionAction } from '@/features/schedule/components/ScheduleConflictGuideDialog';
import { hasConflict, type ScheduleConflict } from '@/features/schedule/conflictChecker';
import { getScheduleColorTokens } from '@/features/schedule/serviceColors';
import type { Schedule } from '@/lib/mappers';
import { TESTIDS, tid } from '@/testids';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo, useRef, useState } from 'react';

export const getWeekRange = (input: Date): { start: Date; end: Date } => {
  const anchor = new Date(input);
  anchor.setUTCHours(0, 0, 0, 0);

  const start = new Date(anchor);
  while (start.getUTCDay() !== 1) {
    start.setUTCDate(start.getUTCDate() - 1);
  }

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  // Force consumers that rely on getDay() to see the UTC weekday value so tests remain
  // stable regardless of the host timezone. All scheduling math below works in UTC.
  start.getDay = start.getUTCDay.bind(start);
  end.getDay = end.getUTCDay.bind(end);

  return { start, end };
};

const HOURS = Array.from({ length: 12 }, (_, index) => 8 + index);
const HOUR_HEIGHT = 56;
const SLOT_DURATION_MINUTES = 30;
const SLOT_HEIGHT = (HOUR_HEIGHT * SLOT_DURATION_MINUTES) / 60;
const DAY_START_HOUR = HOURS[0];
const DAY_END_HOUR = HOURS[HOURS.length - 1] + 1; // exclusive end hour
const TOTAL_TIME_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * (60 / SLOT_DURATION_MINUTES);
const TIME_SLOTS = Array.from({ length: TOTAL_TIME_SLOTS }, (_, index) => {
  const absoluteMinutes = index * SLOT_DURATION_MINUTES;
  const hour = DAY_START_HOUR + Math.floor(absoluteMinutes / 60);
  const minute = absoluteMinutes % 60;
  return { hour, minute, index };
});
const TIMEZONE = 'Asia/Tokyo';
const TIMEZONE_OFFSET = '+09:00';
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const monthDayFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: TIMEZONE,
  month: 'numeric',
  day: 'numeric',
});

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute' as const,
  whiteSpace: 'nowrap' as const,
  width: 1,
};

const pad = (value: number) => String(value).padStart(2, '0');

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
const MAX_EVENTS_PER_DAY = 4;
const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 18;
const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MIN_EVENT_DURATION_MINUTES = SLOT_DURATION_MINUTES;
const MIN_RENDERED_HEIGHT = Math.max(HOUR_HEIGHT / 2, SLOT_HEIGHT);
const LEGACY_FALLBACK_CLASS = 'bg-indigo-100';
const LEGACY_INDIGO_ACCENT = '#4338CA';
const LEGACY_INDIGO_BG = '#E0E7FF';

const parseIso = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ensureScheduleBounds = (schedule: Schedule): { start: Date | null; end: Date | null } => {
  const start = parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
  let end = parseIso(
    schedule.endLocal ?? schedule.endUtc ?? schedule.startLocal ?? schedule.startUtc ?? undefined,
  );

  if (!start && !end) {
    return { start: null, end: null };
  }

  if (!start && end) {
    const fallbackStart = new Date(end.getTime() - MIN_EVENT_DURATION_MINUTES * MILLISECONDS_PER_MINUTE);
    return { start: fallbackStart, end };
  }

  if (start && !end) {
    end = new Date(start.getTime() + MIN_EVENT_DURATION_MINUTES * MILLISECONDS_PER_MINUTE);
  }

  return { start: start ?? null, end: end ?? null };
};

const formatTime = (date: Date): string => timeFormatter.format(date);

const getDateKey = (date: Date): string => dateKeyFormatter.format(date);

const makeZonedDate = (date: Date, hour: number, minute = 0, second = 0): Date => {
  const key = getDateKey(date);
  return new Date(`${key}T${pad(hour)}:${pad(minute)}:${pad(second)}${TIMEZONE_OFFSET}`);
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const buildSlotLabel = (day: Date, hour: number, minute: number): string => {
  const start = makeZonedDate(day, hour, minute, 0);
  const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
  const [month, dayNumber] = monthDayFormatter.format(start).split('/');
  const startLabel = timeFormatter.format(start);
  const endLabel = timeFormatter.format(end);
  return `${Number(month)}月${Number(dayNumber)}日 ${startLabel} から ${endLabel} の枠`;
};

const eventOverlapsDay = (schedule: Schedule, dayStart: Date, dayEnd: Date): boolean => {
  const start = parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
  const end = parseIso(schedule.endLocal ?? schedule.endUtc ?? schedule.startLocal ?? schedule.startUtc ?? undefined) ?? start;
  if (!start || !end) {
    return false;
  }
  return start < dayEnd && end > dayStart;
};

const resolveEventPosition = (schedule: Schedule, day: Date, columnHeight: number): { top: number; height: number } | null => {
  if (schedule.allDay) {
    return { top: 6, height: Math.max(HOUR_HEIGHT / 1.5, columnHeight * 0.18) };
  }

  const { start, end } = ensureScheduleBounds(schedule);
  if (!start || !end) {
    return null;
  }

  const dayStart = makeZonedDate(day, HOURS[0], 0, 0);
  const dayEnd = makeZonedDate(day, HOURS[HOURS.length - 1] + 1, 0, 0);
  const totalSpanMinutes = (dayEnd.getTime() - dayStart.getTime()) / MILLISECONDS_PER_MINUTE;
  if (!Number.isFinite(totalSpanMinutes) || totalSpanMinutes <= 0) {
    return { top: 0, height: columnHeight };
  }

  const visibleStart = start < dayStart ? dayStart : start;
  const visibleEnd = end > dayEnd ? dayEnd : end;

  const startOffsetMinutes = (visibleStart.getTime() - dayStart.getTime()) / MILLISECONDS_PER_MINUTE;
  const safeOffset = Number.isFinite(startOffsetMinutes) ? startOffsetMinutes : 0;
  const computedTop = (safeOffset / totalSpanMinutes) * columnHeight;
  const safeTop = clamp(Number.isFinite(computedTop) ? computedTop : 0, 0, columnHeight);

  if (visibleEnd <= visibleStart) {
    return { top: safeTop, height: MIN_RENDERED_HEIGHT };
  }

  const rawSpanMinutes = Math.max(
    (visibleEnd.getTime() - visibleStart.getTime()) / MILLISECONDS_PER_MINUTE,
    MIN_EVENT_DURATION_MINUTES,
  );
  const computedHeight = (rawSpanMinutes / totalSpanMinutes) * columnHeight;
  const availableSpace = Math.max(columnHeight - safeTop, MIN_RENDERED_HEIGHT);
  const safeHeight = clamp(
    Number.isFinite(computedHeight) ? computedHeight : MIN_RENDERED_HEIGHT,
    MIN_RENDERED_HEIGHT,
    availableSpace,
  );

  return { top: safeTop, height: safeHeight };
};

type WeekViewProps = {
  weekStart: Date;
  schedules: Schedule[];
  onSelectSlot(start: Date, end: Date): void;
  onSelectEvent(schedule: Schedule): void;
  loading?: boolean;
  conflictIndex?: Record<string, ScheduleConflict[]>; // Add conflict detection support
  onApplySuggestion?: (action: SuggestionAction) => void; // Add suggestion action support
  allSchedules?: Schedule[]; // For staff alternative engine (conflict checking)
  onEventDragEnd?: (schedule: Schedule, window: { start: Date; end: Date }) => void;
};

export function WeekView({ weekStart, schedules, onSelectSlot, onSelectEvent, loading = false, conflictIndex, onApplySuggestion, allSchedules = schedules, onEventDragEnd }: WeekViewProps) {
  // Guide dialog state management
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTargetId, setGuideTargetId] = useState<string | null>(null);
  const theme = useTheme();

  const guideTargetSchedule = useMemo(
    () => schedules.find((s) => String(s.id) === guideTargetId) ?? null,
    [guideTargetId, schedules],
  );

  // Convert Schedule to BaseSchedule for dialog
  const guideTargetBaseSchedule = useMemo(() => {
    if (!guideTargetSchedule) return null;

    return {
      id: String(guideTargetSchedule.id),
      etag: '', // Schedule doesn't have etag, using empty string
      category: guideTargetSchedule.category as 'User' | 'Org' | 'Staff',
      title: guideTargetSchedule.title,
      start: guideTargetSchedule.startUtc || guideTargetSchedule.startLocal || '',
      end: guideTargetSchedule.endUtc || guideTargetSchedule.endLocal || '',
      allDay: guideTargetSchedule.allDay || false,
      status: guideTargetSchedule.status === 'draft' ? '下書き' as const :
              guideTargetSchedule.status === 'submitted' ? '申請中' as const :
              guideTargetSchedule.status === 'approved' ? '承認済み' as const : '下書き' as const,
      location: undefined,
      notes: guideTargetSchedule.notes || undefined,
      dayKey: undefined,
    };
  }, [guideTargetSchedule]);

  // Convert all schedules to BaseSchedule for conflict checking in dialog
  const allBaseSchedules = useMemo(() => {
    return allSchedules.map(schedule => ({
      id: String(schedule.id),
      etag: '',
      category: schedule.category as 'User' | 'Org' | 'Staff',
      title: schedule.title,
      start: schedule.startUtc || schedule.startLocal || '',
      end: schedule.endUtc || schedule.endLocal || '',
      allDay: schedule.allDay || false,
      status: schedule.status === 'draft' ? '下書き' as const :
              schedule.status === 'submitted' ? '申請中' as const :
              schedule.status === 'approved' ? '承認済み' as const : '下書き' as const,
      location: undefined,
      notes: schedule.notes || undefined,
      dayKey: undefined,
    }));
  }, [allSchedules]);

  const guideConflicts: ScheduleConflict[] = useMemo(
    () => (guideTargetId && conflictIndex?.[guideTargetId]) || [],
    [guideTargetId, conflictIndex],
  );

  const draggingScheduleRef = useRef<Schedule | null>(null);
  const draggingDurationRef = useRef<number>(SLOT_DURATION_MINUTES);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<{ dayIndex: number; slotIndex: number } | null>(null);

  const clearDragState = () => {
    draggingScheduleRef.current = null;
    draggingDurationRef.current = SLOT_DURATION_MINUTES;
    setDraggingEventId(null);
    setActiveDropTarget(null);
  };

  const days = useMemo<Date[]>(() => {
    const start = new Date(weekStart);
    start.setUTCHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    });
  }, [weekStart]);

  const eventsByDay = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.schedules.recompute, {
      view: 'week',
      scheduleCount: schedules.length,
      bytes: estimatePayloadSize(schedules),
    });
    try {
      const buckets = days.map((day) => {
        const dayStart = makeZonedDate(day, 0, 0, 0);
        const dayEnd = makeZonedDate(day, 23, 59, 59);
        return schedules.filter((schedule) => eventOverlapsDay(schedule, dayStart, dayEnd));
      });
      span({ meta: { status: 'ok', bucketCount: buckets.length, bytes: estimatePayloadSize(buckets) } });
      return buckets;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [days, schedules]);

  const templateColumns = '88px repeat(7, minmax(0, 1fr))';
  const columnHeight = SLOT_HEIGHT * TIME_SLOTS.length;
  const todayKey = getDateKey(new Date());

  return (
    <Paper
      role="grid"
      aria-label="週次スケジュールビュー"
      elevation={1}
      sx={(theme) => ({
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
        boxShadow: theme.shadows[1],
        height: '100%',
        p: 2,
      })}
    >
      <Box sx={{ position: 'relative', overflow: 'auto', borderRadius: 1 }}>
        <Box
          sx={(theme) => ({
            display: 'grid',
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.action.hover,
            color: theme.palette.text.secondary,
            gridTemplateColumns: templateColumns,
          })}
        >
          <Box
            sx={(theme) => ({
              position: 'sticky',
              left: 0,
              zIndex: 10,
              borderRight: `1px solid ${theme.palette.divider}`,
              px: 1.5,
              py: 1.5,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: theme.typography.caption.fontSize,
              fontWeight: 600,
              bgcolor: theme.palette.background.paper,
            })}
          >
            時間
          </Box>
          {days.map((day, index) => {
            const weekday = WEEKDAY_LABELS[index];
            const intlWeekday = day.toLocaleDateString('en-US', { weekday: 'short' });
            const shortLabel = `${weekday} / ${intlWeekday}`;
            const dateLabel = `${day.getMonth() + 1}/${day.getDate()}`;
            const fullLabel = `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日 (${weekday})`;
            const dayKey = getDateKey(day);
            const isToday = dayKey === todayKey;
            return (
              <Box
                key={day.toISOString()}
                sx={(theme) => ({
                  borderRight: `1px solid ${theme.palette.divider}`,
                  px: 1.5,
                  py: 1.25,
                  textAlign: 'center',
                  bgcolor: isToday ? alpha(theme.palette.primary.light ?? theme.palette.primary.main, 0.15) : theme.palette.action.hover,
                  transition: 'background-color 150ms ease',
                })}
              >
                <Typography
                  variant="body2"
                  component="div"
                  sx={{
                    fontWeight: isToday ? 700 : 600,
                    color: isToday ? 'primary.main' : 'text.primary',
                    letterSpacing: '0.02em',
                  }}
                  aria-hidden="true"
                >
                  {shortLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} aria-hidden="true">
                  {dateLabel}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    border: 0,
                    clip: 'rect(0 0 0 0)',
                    height: 1,
                    margin: -1,
                    overflow: 'hidden',
                    padding: 0,
                    position: 'absolute',
                    whiteSpace: 'nowrap',
                    width: 1,
                  }}
                >
                  {fullLabel}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box
          role="rowgroup"
          sx={{
            display: 'grid',
            gridTemplateColumns: templateColumns,
          }}
        >
          <Box
            sx={(theme) => ({
              position: 'relative',
              borderRight: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.action.hover,
            })}
          >
            {TIME_SLOTS.map((slot) => {
              const isOnHour = slot.minute === 0;
              const isOutsideBusinessHours = slot.hour < BUSINESS_HOUR_START || slot.hour >= BUSINESS_HOUR_END;
              return (
                <Box
                  key={`time:${slot.index}`}
                  sx={(theme) => ({
                    height: SLOT_HEIGHT,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    pr: 1.5,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, isOnHour ? 1 : 0.5)}`,
                    opacity: isOutsideBusinessHours ? 0.6 : 1,
                  })}
                >
                  {isOnHour ? (
                    <Typography
                      variant="body2"
                      sx={{
                        color: (theme) => theme.palette.text.secondary,
                        fontFeatureSettings: '"tnum" 1',
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {`${pad(slot.hour)}:00`}
                    </Typography>
                  ) : null}
                </Box>
              );
            })}
          </Box>

        {days.map((day, index) => {
          const schedulesForDay = eventsByDay[index] ?? [];
          return (
            <Box
              key={`col:${day.toISOString()}`}
              role="presentation"
              sx={(theme) => ({
                position: 'relative',
                borderRight: `1px solid ${theme.palette.divider}`,
                minHeight: columnHeight,
              })}
            >
              {TIME_SLOTS.map((slot) => {
                const slotStart = new Date(day);
                slotStart.setUTCHours(slot.hour, slot.minute, 0, 0);
                const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
                const isOnHour = slot.minute === 0;
                const isActiveDropTarget = activeDropTarget?.dayIndex === index && activeDropTarget?.slotIndex === slot.index;
                const isOutsideBusinessHours = slot.hour < BUSINESS_HOUR_START || slot.hour >= BUSINESS_HOUR_END;
                return (
                  <Box
                    key={`${day.toISOString()}-${slot.index}`}
                    component="button"
                    type="button"
                    onClick={() => onSelectSlot(slotStart, slotEnd)}
                    onDragOver={(event) => {
                      if (!draggingEventId) return;
                      event.preventDefault();
                      setActiveDropTarget({ dayIndex: index, slotIndex: slot.index });
                    }}
                    onDragEnter={(event) => {
                      if (!draggingEventId) return;
                      event.preventDefault();
                      setActiveDropTarget({ dayIndex: index, slotIndex: slot.index });
                    }}
                    onDragLeave={() => {
                      setActiveDropTarget((prev) => {
                        if (prev?.dayIndex === index && prev.slotIndex === slot.index) {
                          return null;
                        }
                        return prev;
                      });
                    }}
                    onDrop={(event) => {
                      if (!draggingEventId || !draggingScheduleRef.current) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      const durationMinutes = draggingDurationRef.current;
                      const dayEnd = new Date(day);
                      dayEnd.setUTCHours(DAY_END_HOUR, 0, 0, 0);
                      const rawEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
                      const dropEnd = rawEnd > dayEnd ? dayEnd : rawEnd;
                      const nextEnd = dropEnd > slotStart ? dropEnd : new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
                      onEventDragEnd?.(draggingScheduleRef.current, {
                        start: new Date(slotStart),
                        end: nextEnd,
                      });
                      clearDragState();
                    }}
                    aria-label={buildSlotLabel(day, slot.hour, slot.minute)}
                    sx={(theme) => ({
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'flex-start',
                      width: '100%',
                      height: SLOT_HEIGHT,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, isOnHour ? 0.9 : 0.4)}`,
                      paddingInline: theme.spacing(1),
                      textAlign: 'left',
                      fontSize: theme.typography.caption.fontSize,
                      color: isOnHour ? theme.palette.text.secondary : theme.palette.text.disabled,
                      transition: 'background-color 120ms ease, box-shadow 120ms ease',
                      backgroundColor: isActiveDropTarget
                        ? theme.palette.action.selected
                        : isOutsideBusinessHours
                          ? alpha(theme.palette.action.hover, 0.35)
                          : 'transparent',
                      opacity: isOutsideBusinessHours ? 0.7 : 1,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                      '&:focus-visible': {
                        outline: 'none',
                        boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
                      },
                      ...(isActiveDropTarget
                        ? {
                            boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
                          }
                        : null),
                    })}
                  >
                    <Box component="span" sx={visuallyHidden}>
                      空き枠を追加
                    </Box>
                  </Box>
                );
              })}

              {schedulesForDay.slice(0, MAX_EVENTS_PER_DAY).map((schedule) => {
                const position = resolveEventPosition(schedule, day, columnHeight);
                if (!position) {
                  return null;
                }

                const start = parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
                const end = parseIso(schedule.endLocal ?? schedule.endUtc ?? schedule.startLocal ?? schedule.startUtc ?? undefined);
                const primaryUserName =
                  schedule.personName ||
                  schedule.targetUserNames?.[0] ||
                  schedule.title ||
                  '（名称未設定）';
                const serviceTypeLabel = schedule.serviceType ?? schedule.category ?? '通常';
                const timeLabel =
                  start && end
                    ? `${formatTime(start)} – ${formatTime(end)}`
                    : schedule.dayPart ?? '';
                const locationLabel =
                  schedule.location ||
                  schedule.relatedResourceNames?.[0] ||
                  schedule.dayPart ||
                  '';
                const assigneeLabel =
                  schedule.assignedStaffNames?.[0] ||
                  schedule.staffNames?.[0] ||
                  '';
                const accessibilityLabel = [primaryUserName, serviceTypeLabel, timeLabel]
                  .filter(Boolean)
                  .join(' / ');
                const conflicted = hasConflict(conflictIndex, String(schedule.id));
                const lacksClassification = !schedule.serviceType && !schedule.category && !schedule.personType;
                const fallbackColorTokens = lacksClassification
                  ? {
                      bg: theme.palette.mode === 'dark' ? alpha(LEGACY_INDIGO_ACCENT, 0.22) : LEGACY_INDIGO_BG,
                      border: alpha(LEGACY_INDIGO_ACCENT, theme.palette.mode === 'dark' ? 0.6 : 0.35),
                      accent: LEGACY_INDIGO_ACCENT,
                      pillBg: LEGACY_INDIGO_ACCENT,
                      pillText: theme.palette.getContrastText(LEGACY_INDIGO_ACCENT),
                    }
                  : null;
                const colorTokens = fallbackColorTokens ?? getScheduleColorTokens(theme, schedule);
                const fallbackClassName = lacksClassification ? LEGACY_FALLBACK_CLASS : undefined;
                const hoverSurface = alpha(colorTokens.accent, theme.palette.mode === 'dark' ? 0.35 : 0.18);
                const durationMinutes = (() => {
                  const startDate = parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
                  const endDate = parseIso(schedule.endLocal ?? schedule.endUtc ?? schedule.startLocal ?? schedule.startUtc ?? undefined) ?? startDate;
                  if (!startDate || !endDate) {
                    return SLOT_DURATION_MINUTES;
                  }
                  const diff = (endDate.getTime() - startDate.getTime()) / (60 * 1000);
                  return Math.max(diff, SLOT_DURATION_MINUTES);
                })();

                const isDragging = draggingEventId === String(schedule.id);
                const conflictShadow = `0 0 0 2px ${theme.palette.error.main}`;
                const activeShadow = theme.shadows[2];

                const handleClick = () => {
                  if (conflicted && conflictIndex) {
                    setGuideTargetId(String(schedule.id));
                    setGuideOpen(true);
                  } else {
                    onSelectEvent(schedule);
                  }
                };

                return (
                  <Box key={schedule.id} data-testid="schedule-item">
                    <Box
                      component="button"
                      type="button"
                      className={fallbackClassName}
                      aria-label={accessibilityLabel}
                      draggable={Boolean(onEventDragEnd)}
                      onClick={handleClick}
                    onDragStart={(event) => {
                      if (!onEventDragEnd) return;
                      draggingScheduleRef.current = schedule;
                      draggingDurationRef.current = durationMinutes;
                      setDraggingEventId(String(schedule.id));
                      setActiveDropTarget(null);
                      event.dataTransfer?.setData('text/plain', String(schedule.id));
                    }}
                      onDragEnd={() => {
                        if (!onEventDragEnd) return;
                        clearDragState();
                      }}
                      aria-grabbed={isDragging || undefined}
                      data-schedule-id={schedule.id}
                      sx={{
                        position: 'absolute',
                        top: position.top,
                        height: position.height,
                        left: 4,
                        right: 4,
                        width: 'auto',
                        display: 'flex',
                        alignItems: 'stretch',
                        gap: 0.75,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: conflicted ? theme.palette.error.main : colorTokens.border,
                        backgroundColor: colorTokens.bg,
                        boxShadow: conflicted ? conflictShadow : '0 1px 2px rgba(15, 23, 42, 0.18)',
                        padding: theme.spacing(0.75, 1),
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background-color 120ms ease, box-shadow 150ms ease, transform 120ms ease',
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: hoverSurface,
                          boxShadow: conflicted ? conflictShadow : '0 2px 6px rgba(15, 23, 42, 0.25)',
                        },
                        '&:active': {
                          boxShadow: conflicted ? conflictShadow : activeShadow,
                        },
                        '&:focus-visible': {
                          outline: `2px solid ${colorTokens.accent}`,
                          outlineOffset: 2,
                        },
                        ...(isDragging && {
                          opacity: 0.5,
                          borderStyle: 'dashed',
                        }),
                      }}
                    >
                    <Box
                      component="span"
                      sx={visuallyHidden}
                      {...tid(
                        conflicted
                          ? TESTIDS['schedules-event-conflicted']
                          : TESTIDS['schedules-event-normal'],
                      )}
                    />
                    <Box
                      sx={{
                        width: 4,
                        borderRadius: 999,
                        bgcolor: colorTokens.accent,
                        alignSelf: 'stretch',
                      }}
                    />
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.25,
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        noWrap
                        sx={{ color: conflicted ? theme.palette.error.main : theme.palette.text.primary }}
                      >
                        {conflicted ? '⚠️ ' : ''}
                        {primaryUserName}
                      </Typography>
                      {(timeLabel || serviceTypeLabel) && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            mt: 0.25,
                            flexWrap: 'nowrap',
                          }}
                        >
                          {timeLabel ? (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {timeLabel}
                            </Typography>
                          ) : null}
                          <Box
                            component="span"
                            sx={{
                              px: 0.75,
                              py: 0.25,
                              borderRadius: 999,
                              fontSize: (theme) => theme.typography.caption.fontSize,
                              fontWeight: 600,
                              bgcolor: colorTokens.pillBg,
                              color: colorTokens.pillText,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {serviceTypeLabel}
                          </Box>
                        </Box>
                      )}
                      {locationLabel ? (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {locationLabel}
                        </Typography>
                      ) : null}
                      {assigneeLabel ? (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {assigneeLabel}
                        </Typography>
                      ) : null}
                      {schedule.notes ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {schedule.notes}
                        </Typography>
                      ) : null}
                    </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          );
        })}
        </Box>

        {loading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-slate-600" aria-live="polite">
            予定を読み込んでいます…
          </div>
        ) : null}
      </Box>

      <ScheduleConflictGuideDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        schedule={guideTargetBaseSchedule}
        conflicts={guideConflicts}
        allSchedules={allBaseSchedules}
        onApplySuggestion={(action) => {
          // 親に伝えてからダイアログを閉じる
          onApplySuggestion?.(action);
          setGuideOpen(false);
        }}
      />
    </Paper>
  );
}

export default WeekView;

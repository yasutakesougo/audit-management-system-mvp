import { addDays, format, startOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { DragEvent, HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
// MUI Components
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// Icons
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import CalendarViewWeekRoundedIcon from '@mui/icons-material/CalendarViewWeekRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';

import { getLocalDateKey } from '../dateutils.local';
import { formatOrgSubtitle } from '../presenters/format';
import type { Schedule, ScheduleStaff } from '../types';
import { isOrg, isStaff, isUserCare } from '../types';
import TimelineEventCard from './TimelineEventCard';

export const laneOrder: Array<Schedule['category']> = ['User', 'Staff', 'Org'];
export const laneLabels: Record<Schedule['category'], { label: string; icon: React.ElementType; color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' }> = {
  User: { label: '利用者レーン', icon: PersonRoundedIcon, color: 'success' }, // 緑系 - 利用者（メインユーザー）
  Staff: { label: '職員レーン', icon: BadgeRoundedIcon, color: 'warning' }, // オレンジ系 - 職員（サポート役）
  Org: { label: '組織イベント', icon: BusinessRoundedIcon, color: 'primary' }, // 青系 - 組織（重要度高）
};

type TimelineWeekProps = {
  events: Schedule[];
  startDate?: Date;
  onEventMove?: (payload: EventMovePayload) => void;
  onEventCreate?: (payload: { category: Schedule['category']; date: string }) => void;
  onEventEdit?: (event: Schedule) => void;
};

type WeekDay = {
  date: Date;
  key: string;
  label: string;
  weekday: string;
  isToday: boolean;
};

type LaneMatrix = Record<Schedule['category'], Record<string, Schedule[]>>;

export type EventMovePayload = {
  id: string;
  from: { category: Schedule['category']; dayKey: string };
  to: { category: Schedule['category']; dayKey: string };
};

export default function TimelineWeek({ events, startDate, onEventMove, onEventCreate, onEventEdit }: TimelineWeekProps) {
  const baseDate = useMemo(() => {
    if (startDate) {
      // 指定された日付の週の月曜日を取得
      return startOfWeek(startDate, { weekStartsOn: 1 });
    }
    return guessWeekStart(events);
  }, [events, startDate]);
  const weekDays = useMemo(() => buildWeekDays(baseDate), [baseDate]);
  const columnTemplate = useMemo(
    () => `160px repeat(${weekDays.length}, 200px)`, // 固定幅に変更
    [weekDays.length]
  );
  const minGridWidth = useMemo(
    () => 160 + (weekDays.length * 200), // カテゴリ列 + 各日列
    [weekDays.length]
  );
  const laneMatrix = useMemo(() => buildLaneMatrix(events, weekDays), [events, weekDays]);
  const rangeLabel = useMemo(() => formatRangeLabel(weekDays), [weekDays]);
  const hasToday = useMemo(() => weekDays.some((day) => day.isToday), [weekDays]);
  const headersRef = useRef<Record<string, HTMLDivElement | null>>({});
  const rangeLabelId = useId();
  const dragInstructionsId = useId();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeDropKey, setActiveDropKey] = useState<string | null>(null);
  const gridDescribedBy = useMemo(() => {
    const ids = [rangeLabel ? rangeLabelId : null, onEventMove ? dragInstructionsId : null].filter(Boolean) as string[];
    return ids.length ? ids.join(' ') : undefined;
  }, [dragInstructionsId, onEventMove, rangeLabel, rangeLabelId]);
  const enableDrag = Boolean(onEventMove);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleTodayJump = useCallback(() => {
    if (!hasToday) return;
    const todayKey = getLocalDateKey(new Date());
    if (!todayKey) return;
    const target = headersRef.current[todayKey];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      target.focus({ preventScroll: true });
    }
  }, [hasToday]);

  const handleScrollReset = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }, []);

  const handleDragStart = useCallback(
    (eventId: string) => (event: DragEvent<HTMLElement>) => {
      if (!enableDrag) return;
      event.dataTransfer.setData('text/x-schedule-id', eventId);
      event.dataTransfer.effectAllowed = 'move';
      setDraggingId(eventId);
    },
    [enableDrag]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setActiveDropKey(null);
  }, []);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!enableDrag) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [enableDrag]
  );

  const handleDragEnter = useCallback(
    (key: string) => (event: DragEvent<HTMLDivElement>) => {
      if (!enableDrag) return;
      event.preventDefault();
      setActiveDropKey(key);
    },
    [enableDrag]
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!enableDrag) return;
      const related = event.relatedTarget as Node | null;
      if (related && event.currentTarget.contains(related)) {
        return;
      }
      setActiveDropKey(null);
    },
    [enableDrag]
  );

  const handleDrop = useCallback(
    (targetCategory: Schedule['category'], targetDayKey: string) => (event: DragEvent<HTMLDivElement>) => {
      if (!enableDrag || !onEventMove) return;
      event.preventDefault();
      const draggedId = event.dataTransfer.getData('text/x-schedule-id') || draggingId;
      if (!draggedId) {
        setDraggingId(null);
        setActiveDropKey(null);
        return;
      }
      const source = events.find((item) => item.id === draggedId);
      if (!source) {
        setDraggingId(null);
        setActiveDropKey(null);
        return;
      }
      if (source.category !== targetCategory) {
        setDraggingId(null);
        setActiveDropKey(null);
        return;
      }
      const fromDayKey = resolveEventDayKey(source);
      if (!fromDayKey) {
        setDraggingId(null);
        setActiveDropKey(null);
        return;
      }
      if (fromDayKey === targetDayKey && source.category === targetCategory) {
        setDraggingId(null);
        setActiveDropKey(null);
        return;
      }
      onEventMove({
        id: draggedId,
        from: { category: source.category, dayKey: fromDayKey },
        to: { category: targetCategory, dayKey: targetDayKey },
      });
      setDraggingId(null);
      setActiveDropKey(null);
    },
    [draggingId, enableDrag, events, onEventMove]
  );

  const handleKeyboardMove = useCallback(
    (keyboardEvent: KeyboardEvent<HTMLElement>, schedule: Schedule, currentCategory: Schedule['category'], currentDayKey: string) => {
      if (!onEventMove) return;
      if (!keyboardEvent.shiftKey) return;

  const targetCategory: Schedule['category'] = currentCategory;
      let targetDayKey: string = currentDayKey;
      let handled = false;

      switch (keyboardEvent.key) {
        case 'ArrowRight': {
          const nextKey = getAdjacentDayKey(weekDays, currentDayKey, 1);
          if (nextKey) {
            targetDayKey = nextKey;
            handled = true;
          }
          break;
        }
        case 'ArrowLeft': {
          const prevKey = getAdjacentDayKey(weekDays, currentDayKey, -1);
          if (prevKey) {
            targetDayKey = prevKey;
            handled = true;
          }
          break;
        }
        default:
          break;
      }

      if (!handled) return;

      keyboardEvent.preventDefault();

      const fromDayKey = resolveEventDayKey(schedule);
      if (!fromDayKey) return;
      if (fromDayKey === targetDayKey && schedule.category === targetCategory) return;

      onEventMove({
        id: schedule.id,
        from: { category: schedule.category, dayKey: fromDayKey },
        to: { category: targetCategory, dayKey: targetDayKey },
      });
    },
    [onEventMove, weekDays]
  );

  // セルクリックでイベント作成
  const handleCellClick = useCallback(
    (category: Schedule['category'], dayKey: string) => (event: MouseEvent<HTMLDivElement>) => {
      // ドラッグ中やイベント要素の場合は無視
      if (draggingId || (event.target as HTMLElement).closest('[data-schedule-event="true"]')) {
        return;
      }

      if (onEventCreate) {
        // dayKeyから日付文字列を生成
        const day = weekDays.find(d => d.key === dayKey);
        if (day) {
          const dateString = format(day.date, 'yyyy-MM-dd');
          onEventCreate({ category, date: dateString });
        }
      }
    },
    [onEventCreate, weekDays, draggingId]
  );

  // イベントクリックで編集
  const handleEventClick = useCallback(
    (event: Schedule) => (clickEvent: MouseEvent<HTMLDivElement>) => {
      clickEvent.stopPropagation(); // セルクリックの伝播を防ぐ
      if (onEventEdit) {
        onEventEdit(event);
      }
    },
    [onEventEdit]
  );

  return (
    <Box component="section" aria-label="週タイムライン">
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarViewWeekRoundedIcon />
            週タイムライン
          </Typography>
          <Typography variant="body2" color="text.secondary" id={rangeLabelId}>
            {rangeLabel}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleTodayJump}
            disabled={!hasToday}
            startIcon={<TodayRoundedIcon />}
            aria-label="今日の列に移動"
          >
            今日へ移動
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleScrollReset}
            startIcon={<RefreshRoundedIcon />}
          >
            先頭へ戻る
          </Button>
        </Stack>
      </Stack>

      {enableDrag && (
        <Typography
          component="div"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0
          }}
          id={dragInstructionsId}
        >
          Shiftキーと左右矢印キーで予定の日付を移動できます。ドラッグ＆ドロップにも対応しています。
        </Typography>
      )}

      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          width: '100%',
          maxWidth: '100vw'
        }}
      >
        <Box
          ref={scrollRef}
          role="grid"
          aria-label="週ごとの予定一覧"
          aria-describedby={gridDescribedBy}
          sx={{
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: '70vh',
            width: '100%'
          }}
        >
          <Box sx={{ minWidth: minGridWidth, width: 'max-content' }}>
          {/* Header Row */}
          <Box
            role="row"
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'grid',
              gridTemplateColumns: columnTemplate,
              width: minGridWidth,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'grey.50'
            }}
          >
            <Box
              role="columnheader"
              sx={{
                px: 3,
                py: 1.5,
                position: 'sticky',
                left: 0,
                zIndex: 11,
                bgcolor: 'background.paper',
                borderRight: 1,
                borderColor: 'divider'
              }}
            >
              <Typography variant="subtitle2" fontWeight="600" color="text.secondary">
                カテゴリ
              </Typography>
            </Box>
            {weekDays.map((day, index) => (
              <Box
                key={day.key}
                role="columnheader"
                id={`timeline-week-header-${day.key}`}
                ref={(node: HTMLDivElement | null) => {
                  if (node) {
                    headersRef.current[day.key] = node;
                  } else {
                    delete headersRef.current[day.key];
                  }
                }}
                tabIndex={-1}
                sx={{
                  px: 2,
                  py: 1.5,
                  borderLeft: index > 0 ? 1 : 0,
                  borderColor: 'divider',
                  bgcolor: day.isToday ? 'primary.light' : 'grey.50',
                  color: day.isToday ? 'primary.contrastText' : 'text.primary',
                  '&:focus-visible': {
                    outline: 2,
                    outlineColor: 'primary.main',
                    outlineOffset: 2
                  }
                }}
              >
                <Typography
                  variant="caption"
                  color={day.isToday ? 'primary.contrastText' : 'text.secondary'}
                  sx={{ display: 'block', fontWeight: 'medium', letterSpacing: '0.5px' }}
                >
                  {day.weekday}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {day.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Lane Rows */}
          {laneOrder.map((category) => {
            const laneConfig = laneLabels[category];
            const IconComponent = laneConfig.icon;
            return (
              <Box
                key={category}
                role="row"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: columnTemplate,
                  width: minGridWidth,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 }
                }}
              >
                <Box
                  role="rowheader"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: laneConfig.color === 'success' ? 'success.light' :
                            laneConfig.color === 'warning' ? 'warning.light' :
                            laneConfig.color === 'primary' ? 'primary.light' :
                            laneConfig.color === 'secondary' ? 'secondary.light' :
                            laneConfig.color === 'info' ? 'info.light' : 'grey.100',
                    px: 3,
                    py: 3,
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                    borderRight: 1,
                    borderColor: 'divider'
                  }}
                >
                  <IconComponent sx={{ fontSize: 20, color: `${laneConfig.color}.dark` }} />
                  <Typography variant="subtitle2" fontWeight="600" color={`${laneConfig.color}.dark`}>
                    {laneConfig.label}
                  </Typography>
                </Box>
                {weekDays.map((day, index) => {
                  const dayEvents = laneMatrix[category]?.[day.key] ?? [];
                  const ariaLabel = `${laneConfig.label}・${format(day.date, 'M月d日 (EEE)', { locale: ja })}`;
                  const dropKey = `${category}-${day.key}`;
                  return (
                    <Box
                      key={day.key}
                      role="gridcell"
                      aria-label={ariaLabel}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        p: 1.5,
                        minHeight: 120,
                        borderLeft: index > 0 ? 1 : 0,
                        borderColor: 'divider',
                        bgcolor: activeDropKey === dropKey ? 'action.hover' :
                                 laneConfig.color === 'success' ? 'rgba(76, 175, 80, 0.04)' : // 薄い緑
                                 laneConfig.color === 'warning' ? 'rgba(255, 152, 0, 0.04)' : // 薄いオレンジ
                                 laneConfig.color === 'primary' ? 'rgba(25, 118, 210, 0.04)' : 'background.paper', // 薄い青
                        transition: 'background-color 0.2s ease-in-out',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                      onDragOver={enableDrag ? handleDragOver : undefined}
                      onDragEnter={enableDrag ? handleDragEnter(dropKey) : undefined}
                      onDragLeave={enableDrag ? handleDragLeave : undefined}
                      onDrop={enableDrag ? handleDrop(category, day.key) : undefined}
                      onClick={handleCellClick(category, day.key)}
                      aria-dropeffect={enableDrag ? 'move' : undefined}
                    >
                      {dayEvents.length > 0 ? (
                        dayEvents.map((event) => {
                          const baseContainerProps = {
                            'data-testid': 'schedule-item',
                            'data-schedule-event': 'true',
                            'data-id': event.id,
                            'data-status': event.status,
                            'data-category': event.category,
                            'data-all-day': event.allDay ? '1' : '0',
                            'data-recurrence': event.recurrenceRule ? '1' : '0',
                          } as HTMLAttributes<HTMLElement>;

                          const containerProps = enableDrag
                            ? {
                                ...baseContainerProps,
                                draggable: true,
                                onDragStart: handleDragStart(event.id),
                                onDragEnd: handleDragEnd,
                                onKeyDown: (keyboardEvent: KeyboardEvent<HTMLElement>) =>
                                  handleKeyboardMove(keyboardEvent, event, category, day.key),
                                onClick: handleEventClick(event),
                                'aria-grabbed': draggingId === event.id,
                                'aria-describedby': dragInstructionsId,
                                'aria-roledescription': 'ドラッグ可能な予定',
                              }
                            : {
                                ...baseContainerProps,
                                onClick: handleEventClick(event),
                              };

                          return (
                            <TimelineEventCard
                              key={event.id}
                              title={event.title}
                              startISO={event.start}
                              endISO={event.end}
                              allDay={event.allDay}
                              status={event.status}
                              recurrenceRule={event.recurrenceRule}
                              subtitle={getTimelineSubtitle(event)}
                              dayPart={event.category === 'Staff' ? event.dayPart : undefined}
                              baseShiftWarnings={event.baseShiftWarnings}
                              containerProps={containerProps}
                            />
                          );
                        })
                      ) : (
                        <Typography variant="caption" color="text.disabled" textAlign="center">
                          予定なし
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            );
          })}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

function guessWeekStart(events: Schedule[]): Date {
  let earliestTs: number | null = null;
  for (const event of events) {
    const ts = new Date(event.start).getTime();
    if (Number.isNaN(ts)) continue;
    if (earliestTs === null || ts < earliestTs) {
      earliestTs = ts;
    }
  }
  const baseDate = earliestTs !== null ? new Date(earliestTs) : new Date();
  // 月曜始まりの週の開始日を取得
  return startOfWeek(baseDate, { weekStartsOn: 1 }); // 1 = Monday
}

function buildWeekDays(start: Date, days: number = 7): WeekDay[] {
  const todayKey = getLocalDateKey(new Date());
  return Array.from({ length: days }).map((_, index) => {
    const date = addDays(start, index);
    const key = getLocalDateKey(date) ?? format(date, 'yyyy-MM-dd');
    return {
      date,
      key,
      label: format(date, 'M月d日', { locale: ja }),
      weekday: format(date, 'EEE', { locale: ja }),
      isToday: todayKey === key,
    } satisfies WeekDay;
  });
}

function buildLaneMatrix(events: Schedule[], days: WeekDay[]): LaneMatrix {
  const dayKeys = new Set(days.map((day) => day.key));
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const initial: LaneMatrix = laneOrder.reduce((acc, category) => {
    acc[category] = days.reduce<Record<string, Schedule[]>>((map, day) => {
      map[day.key] = [];
      return map;
    }, {});
    return acc;
  }, {} as LaneMatrix);

  for (const event of sorted) {
    const lane = event.category;
    const key = event.dayKey ?? getLocalDateKey(event.start);
    if (!lane || !key || !dayKeys.has(key)) continue;
    initial[lane][key].push(event);
  }

  return initial;
}

function resolveEventDayKey(event: Schedule): string | null {
  return event.dayKey ?? getLocalDateKey(event.start);
}

function getAdjacentDayKey(days: WeekDay[], currentKey: string, offset: 1 | -1): string | null {
  const index = days.findIndex((day) => day.key === currentKey);
  if (index === -1) return null;
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= days.length) {
    return null;
  }
  return days[nextIndex].key;
}

function formatRangeLabel(days: WeekDay[]): string {
  if (!days.length) return '';
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const formatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' });
  return `${formatter.format(first)} 〜 ${formatter.format(last)}`;
}

export function getTimelineSubtitle(event: Schedule): string {
  if (isUserCare(event)) {
    const staff = event.staffNames?.join('・') || event.staffIds.join('・');
    return [event.serviceType, staff].filter(Boolean).join('・');
  }
  if (isStaff(event)) {
    const staff = event.staffNames?.join('・');
    const dayPart = event.dayPart && event.dayPart !== 'Full' ? formatDayPart(event.dayPart) : null;
    const subType = event.subType === '年休' && dayPart ? `${event.subType}（${dayPart}）` : event.subType;
    return [subType, staff].filter(Boolean).join('・');
  }
  if (isOrg(event)) {
    return formatOrgSubtitle(event);
  }
  return '';
}

function formatDayPart(dayPart: Extract<ScheduleStaff['dayPart'], 'AM' | 'PM'>): string {
  return dayPart === 'AM' ? '午前休' : '午後休';
}

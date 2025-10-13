import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useCallback, useId, useMemo, useRef, type HTMLAttributes, type MouseEvent } from 'react';
// MUI Components
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// Icons
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';

import { startOfDay } from '../dateutils.local';
import type { Schedule } from '../types';
import TimelineEventCard from './TimelineEventCard';
import { getTimelineSubtitle, laneLabels, laneOrder } from './TimelineWeek';

type TimelineDayProps = {
  events: Schedule[];
  date: Date;
  onEventCreate?: (payload: { category: Schedule['category']; date: string }) => void;
  onEventEdit?: (event: Schedule) => void;
};

type LaneBuckets = Record<Schedule['category'], Schedule[]>;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function TimelineDay({ events, date, onEventCreate, onEventEdit }: TimelineDayProps) {
  const dayStart = useMemo(() => startOfDay(date), [date]);
  const dayEnd = useMemo(() => new Date(dayStart.getTime() + ONE_DAY_MS), [dayStart]);
  const buckets = useMemo(() => buildDayBuckets(events, dayStart, dayEnd), [events, dayStart, dayEnd]);
  const rangeLabel = useMemo(() => format(dayStart, 'yyyy年M月d日 (EEE)', { locale: ja }), [dayStart]);
  const rangeLabelId = useId();
  const hourSlots = useMemo(() => buildHourSlots(dayStart), [dayStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleScrollReset = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }, []);

  const handleScrollToNow = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;

    const now = new Date();
    const currentHour = now.getHours();

    // 6時以前は6時に、23時以降は23時にスクロール
    const targetHour = Math.max(6, Math.min(23, currentHour));
    // 6:00からのオフセットを計算（80px per hour）
    const hourOffset = targetHour - 6;
    const scrollLeft = Math.max(0, (hourOffset * 80) - 160); // 多少手前から表示

    node.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, []);

  // セルクリックでイベント作成
  const handleCellClick = useCallback(
    (category: Schedule['category']) => (event: MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('[data-schedule-event="true"]')) {
        return;
      }

      if (onEventCreate) {
        const dateString = format(date, 'yyyy-MM-dd');
        onEventCreate({ category, date: dateString });
      }
    },
    [onEventCreate, date]
  );

  // イベントクリックで編集
  const handleEventClick = useCallback(
    (event: Schedule) => (clickEvent: MouseEvent<HTMLDivElement>) => {
      clickEvent.stopPropagation();
      if (onEventEdit) {
        onEventEdit(event);
      }
    },
    [onEventEdit]
  );

  return (
    <Box component="section" aria-label={`日タイムライン (${rangeLabel})`}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TodayRoundedIcon />
            日タイムライン
          </Typography>
          <Typography variant="body2" color="text.secondary" id={rangeLabelId}>
            {rangeLabel}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleScrollToNow}
            startIcon={<TodayRoundedIcon />}
          >
            現在時刻へ
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

      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
        <Box
          ref={scrollRef}
          data-testid="day-scroll-container"
          role="grid"
          aria-label="指定日の予定一覧"
          aria-describedby={rangeLabelId}
          sx={{
            overflow: 'auto',
            maxHeight: '70vh'
          }}
        >
          {/* Time Grid Header - スクロール内 */}
          <Box sx={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '160px repeat(18, minmax(80px, 1fr))',
                minWidth: 1600, // 160 + (18 * 80)
                bgcolor: 'grey.50'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 2,
                  px: 3,
                  borderRight: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  position: 'sticky',
                  left: 0,
                  zIndex: 11
                }}
              >
                <Typography variant="subtitle2" fontWeight="600" color="text.secondary">
                  カテゴリ
                </Typography>
              </Box>
              {hourSlots.map((slot, index) => (
                <Box
                  key={slot.startEpoch}
                  data-testid="hour-slot"
                  data-hour={slot.label}
                  data-iso={slot.iso}
                  data-dst-repeat={slot.isDstRepeat ? '1' : undefined}
                  sx={{
                    py: 1.5,
                    px: 1,
                    borderRight: index === 17 ? 0 : 1, // 最後は17番目（18時間目）
                    borderColor: 'divider',
                    textAlign: 'center',
                    bgcolor: (index + 6) % 6 === 0 ? 'primary.light' : 'transparent', // 6時間間隔調整
                    minWidth: 80,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={index % 6 === 0 ? 600 : 400}
                    color={index % 6 === 0 ? 'primary.dark' : 'text.secondary'}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {slot.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {laneOrder.map((category, categoryIndex) => {
            const laneEvents = buckets[category] ?? [];
            const laneKey = category.toLowerCase();
            const laneConfig = laneLabels[category];
            const IconComponent = laneConfig.icon;
            return (
              <Box
                key={category}
                role="row"
                onClick={handleCellClick(category)}
                sx={{
                  position: 'relative',
                  borderBottom: categoryIndex === laneOrder.length - 1 ? 0 : 1,
                  borderColor: 'divider',
                  minHeight: 120,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                {/* Grid Background */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '160px repeat(18, minmax(80px, 1fr))',
                    minWidth: 1600,
                    height: '100%'
                  }}
                >
                  <Box
                    role="rowheader"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      bgcolor: laneConfig.color === 'primary' ? 'primary.light' :
                              laneConfig.color === 'secondary' ? 'secondary.light' :
                              laneConfig.color === 'info' ? 'info.light' : 'grey.100',
                      px: 3,
                      py: 3,
                      borderRight: 1,
                      borderColor: 'divider',
                      position: 'sticky',
                      left: 0,
                      zIndex: 5
                    }}
                  >
                    <IconComponent sx={{ fontSize: 20, color: `${laneConfig.color}.dark` }} />
                    <Typography variant="subtitle2" fontWeight="600" color={`${laneConfig.color}.dark`}>
                      {laneConfig.label}
                    </Typography>
                  </Box>

                  {/* Time Grid Background */}
                  {Array.from({ length: 18 }, (_, hourIndex) => (
                    <Box
                      key={hourIndex}
                      sx={{
                        borderRight: hourIndex === 17 ? 0 : 1,
                        borderColor: 'divider',
                        bgcolor: (hourIndex + 6) % 6 === 0 ? 'grey.50' : 'background.paper',
                        minWidth: 80
                      }}
                    />
                  ))}
                </Box>

                {/* Events Overlay */}
                <Box
                  role="gridcell"
                  aria-label={`${laneConfig.label}・${rangeLabel}`}
                  data-testid={`lane-${laneKey}`}
                  sx={{
                    position: 'absolute',
                    left: 160,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    p: 2,
                    pointerEvents: 'none',
                    zIndex: 3
                  }}
                >
                  {laneEvents.length ? (
                    <Stack spacing={1.5} sx={{ py: 1, pointerEvents: 'auto' }}>
                      {laneEvents.map((event) => (
                        <Box
                          key={event.id}
                          sx={{
                            position: 'relative',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              transition: 'transform 0.2s ease-in-out'
                            }
                          }}
                        >
                          <TimelineEventCard
                            title={event.title}
                            startISO={event.start}
                            endISO={event.end}
                            allDay={event.allDay}
                            status={event.status}
                            recurrenceRule={event.recurrenceRule}
                            subtitle={getTimelineSubtitle(event)}
                            dayPart={event.category === 'Staff' ? event.dayPart : undefined}
                            baseShiftWarnings={event.baseShiftWarnings}
                            containerProps={{
                              'data-schedule-event': 'true',
                              'data-id': event.id,
                              'data-status': event.status,
                              'data-category': event.category,
                              'data-all-day': event.allDay ? '1' : '0',
                              'data-recurrence': event.recurrenceRule ? '1' : '0',
                              onClick: handleEventClick(event),
                              sx: {
                                boxShadow: 2,
                                borderRadius: 2,
                                border: 2,
                                borderColor: `${laneConfig.color}.main`,
                                bgcolor: 'background.paper',
                                cursor: 'pointer',
                                '&:hover': {
                                  boxShadow: 4,
                                  borderColor: `${laneConfig.color}.dark`
                                }
                              }
                            } as HTMLAttributes<HTMLElement>}
                          />
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      opacity: 0.5
                    }}>
                      <Typography variant="body2" color="text.disabled" fontStyle="italic">
                        予定なし
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}

function buildDayBuckets(events: Schedule[], dayStart: Date, dayEnd: Date): LaneBuckets {
  const buckets = laneOrder.reduce<LaneBuckets>((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as LaneBuckets);

  for (const event of events) {
    if (!overlapsDay(event, dayStart, dayEnd)) continue;
    const clamped = clampEventToDay(event, dayStart, dayEnd);
    if (!clamped) {
      continue;
    }
    buckets[event.category].push(clamped);
  }

  for (const category of laneOrder) {
    buckets[category].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  return buckets;
}

function overlapsDay(event: Schedule, dayStart: Date, dayEnd: Date): boolean {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  return start < dayEnd && end > dayStart;
}

type HourSlot = {
  label: string;
  iso: string;
  startEpoch: number;
  isDstRepeat?: boolean;
};

function buildHourSlots(dayStart: Date): HourSlot[] {
  const seenEpochCounts = new Map<number, number>();
  // 6:00から23:00まで（18時間）
  return Array.from({ length: 18 }, (_, index) => {
    const hour = index + 6; // 6から23まで
    const slot = new Date(dayStart.getTime());
    slot.setHours(hour, 0, 0, 0);
    const startEpoch = slot.getTime();
    const iso = slot.toISOString();
    const priorCount = seenEpochCounts.get(startEpoch) ?? 0;
    seenEpochCounts.set(startEpoch, priorCount + 1);
    return {
      label: format(slot, 'HH:mm'),
      iso,
      startEpoch,
      isDstRepeat: priorCount > 0,
    } satisfies HourSlot;
  });
}

function clampEventToDay(event: Schedule, dayStart: Date, dayEnd: Date): Schedule | null {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const clampedStart = start < dayStart ? new Date(dayStart) : start;
  const clampedEnd = end > dayEnd ? new Date(dayEnd) : end;

  if (clampedEnd.getTime() <= clampedStart.getTime()) {
    return null;
  }

  if (clampedStart.getTime() === start.getTime() && clampedEnd.getTime() === end.getTime()) {
    return event;
  }

  return {
    ...event,
    start: clampedStart.toISOString(),
    end: clampedEnd.toISOString(),
  };
}

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import { TESTIDS } from '@/testids';

import type { DateRange, SchedItem } from '../data';
import { getScheduleStatusMeta } from '../statusMetadata';

type LaneKey = 'Org' | 'Staff' | 'User';

const COLUMNS: { key: LaneKey; label: string }[] = [
  { key: 'Org', label: '事業所' },
  { key: 'Staff', label: '職員' },
  { key: 'User', label: '利用者' },
];

const HOURS = Array.from({ length: 13 }, (_, index) => index + 8); // 8:00 - 20:00 inclusive start
const ROW_HEIGHT = 48;
const GRID_HEIGHT = HOURS.length * ROW_HEIGHT;
const GRID_START_MIN = 8 * 60;
const GRID_END_MIN = 20 * 60;
const GRID_TOTAL_MIN = GRID_END_MIN - GRID_START_MIN;

const LANE_COLORS: Record<LaneKey, { bg: string; fg: string }> = {
  Org: { bg: '#5C6BC0', fg: '#fff' },
  Staff: { bg: '#26A69A', fg: '#fff' },
  User: { bg: '#42A5F5', fg: '#fff' },
};

export type WeekTimelineCreateHint = {
  category: LaneKey;
  day: Date;
  hour: number;
};

type Props = {
  range: DateRange;
  items: SchedItem[];
  onCreateHint?: (hint: WeekTimelineCreateHint) => void;
};

const toDate = (value: string): Date => new Date(value);
const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};
const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const minutesSince = (anchor: Date, value: Date): number => Math.floor((value.getTime() - anchor.getTime()) / 60000);

const getDaysInRange = (range: DateRange): Date[] => {
  const from = startOfDay(toDate(range.from));
  const to = startOfDay(toDate(range.to));
  const days: Date[] = [];
  const cursor = new Date(from);
  while (cursor < to) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const formatDayLabel = (date: Date): string => {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
};

const hasAssignedStaffId = (value?: string): boolean => Boolean(value?.trim());

const normalizeCategory = (item: SchedItem): LaneKey => {
  if (item.category === 'Org' || item.category === 'Staff' || item.category === 'User') {
    return item.category;
  }
  if (item.userId) {
    return 'User';
  }
  if (hasAssignedStaffId(item.assignedStaffId)) {
    return 'Staff';
  }
  return 'Org';
};

const getStartTimestamp = (iso?: string): number => {
  if (!iso) {
    return Number.POSITIVE_INFINITY;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
};

const formatMinutesPx = (minutes: number): number => (minutes / GRID_TOTAL_MIN) * GRID_HEIGHT;

const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
});

const formatTimeLabel = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return timeFormatter.format(date);
};

const buildTimelineAriaLabel = (item: SchedItem): string => {
  const start = formatTimeLabel(item.start);
  const end = formatTimeLabel(item.end);
  const timePart = start && end ? `${start}〜${end}` : start || end;
  const serviceName = item.subType ?? item.serviceType ?? '';
  const userName = item.personName ?? item.title ?? '';
  const staffNames = Array.isArray(item.staffNames) ? item.staffNames.filter(Boolean) : [];
  const staffLabel = staffNames.length > 0 ? staffNames.join('、') : item.assignedStaffId ?? '';

  return [
    timePart,
    serviceName,
    userName ? `利用者：${userName}` : '',
    staffLabel ? `担当：${staffLabel}` : '',
  ]
    .filter(Boolean)
    .join(' ');
};

const WeekTimeline: React.FC<Props> = ({ range, items, onCreateHint }) => {
  const days = useMemo(() => getDaysInRange(range), [range.from, range.to]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Record<LaneKey, SchedItem[]>>();
    for (const day of days) {
      map.set(day.toISOString(), { Org: [], Staff: [], User: [] });
    }
    for (const item of items) {
      const dayKey = startOfDay(toDate(item.start)).toISOString();
      const bucket = map.get(dayKey);
      if (!bucket) continue;
      bucket[normalizeCategory(item)].push(item);
    }
    return map;
  }, [days, items]);

  if (!days.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" align="center">
          期間内の表示対象日がありません。
        </Typography>
      </Paper>
    );
  }

  return (
    <Box
      data-testid={TESTIDS['schedules-week-timeline']}
      sx={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', pr: 1, pb: 1 }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2 }}>
        {COLUMNS.map((column) => (
          <Paper key={column.key} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              {column.label}
            </Typography>
            <Stack spacing={2}>
              {days.map((day) => {
                const dayKey = day.toISOString();
                const itemsForDay = itemsByDay.get(dayKey)?.[column.key] ?? [];
                return (
                  <DayTimelineSection
                    key={`${column.key}-${dayKey}`}
                    day={day}
                    category={column.key}
                    items={itemsForDay}
                    onCreateHint={onCreateHint}
                  />
                );
              })}
            </Stack>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

type DayTimelineSectionProps = {
  day: Date;
  category: LaneKey;
  items: SchedItem[];
  onCreateHint?: (hint: WeekTimelineCreateHint) => void;
};

const HOURS_LABEL_WIDTH = 38;

const DayTimelineSection: React.FC<DayTimelineSectionProps> = ({ day, category, items, onCreateHint }) => {
  const dayStart = startOfDay(day);
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => getStartTimestamp(a.start) - getStartTimestamp(b.start)),
    [items],
  );

  const handleSlotActivate = (hour: number) => {
    onCreateHint?.({ category, day, hour });
  };

  const color = LANE_COLORS[category];

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
        {formatDayLabel(day)}
      </Typography>
      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
        <Box sx={{ width: HOURS_LABEL_WIDTH }}>
          {HOURS.map((hour) => (
            <Box key={`${day.toISOString()}-label-${hour}`} sx={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'flex-start' }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled' }}>
                {hour}:00
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ flex: 1, position: 'relative', minHeight: GRID_HEIGHT }}>
          {HOURS.map((hour, index) => (
            <Box
              key={`${day.toISOString()}-${category}-slot-${hour}`}
              role="button"
              tabIndex={0}
              onClick={() => handleSlotActivate(hour)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleSlotActivate(hour);
                }
              }}
              sx={{
                height: ROW_HEIGHT,
                borderTop: index === 0 ? 'none' : '1px dashed',
                borderColor: 'divider',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            />
          ))}

          {sortedItems.map((item) => {
            const startDate = toDate(item.start);
            if (!isSameDay(day, startDate)) {
              return null;
            }
            const endDate = toDate(item.end);
            const startMinutes = clamp(minutesSince(dayStart, startDate) - GRID_START_MIN, 0, GRID_TOTAL_MIN);
            const endMinutes = clamp(minutesSince(dayStart, endDate) - GRID_START_MIN, 0, GRID_TOTAL_MIN);
            if (endMinutes <= startMinutes) {
              return null;
            }
            const duration = Math.max(endMinutes - startMinutes, 15);
            const top = formatMinutesPx(startMinutes);
            const height = formatMinutesPx(duration);
            const statusMeta = getScheduleStatusMeta(item.status);
            const opacity = statusMeta?.opacity ?? 1;
            const statusLabel = item.status && item.status !== 'Planned' ? statusMeta?.label : undefined;
            const reason = item.statusReason?.trim() || '';
            const ariaLabel = [
              buildTimelineAriaLabel(item),
              statusLabel ? `ステータス：${statusLabel}` : '',
              reason ? `理由：${reason}` : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <Box
                key={item.id}
                sx={{ position: 'absolute', left: 0, right: 0, top, height, px: 0.5, zIndex: 2 }}
              >
                <Paper
                  data-testid="schedule-item"
                  data-id={item.id}
                  data-category={category}
                  elevation={3}
                  sx={{
                    height: '100%',
                    p: 0.75,
                    bgcolor: color.bg,
                    color: color.fg,
                    borderRadius: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    opacity,
                  }}
                  role="article"
                  aria-label={ariaLabel}
                >
                  <Typography variant="caption" fontWeight={700} noWrap>
                    {item.title}
                  </Typography>
                  {category === 'User' && item.userId && (
                    <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
                      {item.userId}
                    </Typography>
                  )}
                  {category === 'Staff' && hasAssignedStaffId(item.assignedStaffId) && (
                    <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
                      職員ID: {item.assignedStaffId}
                    </Typography>
                  )}
                  {category === 'Org' && item.locationName && (
                    <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
                      {item.locationName}
                    </Typography>
                  )}
                  {statusLabel && (
                    <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
                      ステータス: {statusLabel}
                    </Typography>
                  )}
                  {reason && (
                    <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
                      {reason}
                    </Typography>
                  )}
                </Paper>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default WeekTimeline;

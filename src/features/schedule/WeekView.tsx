import { useMemo } from 'react';
import type { Schedule } from '@/lib/mappers';

export const getWeekRange = (input: Date): { start: Date; end: Date } => {
  const base = new Date(input);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const HOURS = Array.from({ length: 12 }, (_, index) => 8 + index);
const HOUR_HEIGHT = 56;

const STATUS_STYLES: Record<Schedule['status'], string> = {
  draft: 'bg-sky-100 border-sky-300 text-sky-900',
  submitted: 'bg-amber-100 border-amber-300 text-amber-900',
  approved: 'bg-emerald-100 border-emerald-300 text-emerald-900',
};

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
const MAX_EVENTS_PER_DAY = 4;

const parseIso = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (date: Date): string =>
  date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const buildSlotLabel = (day: Date, hour: number): string => {
  const start = new Date(day);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  return `${start.getMonth() + 1}月${start.getDate()}日 ${formatTime(start)} から ${formatTime(end)} の枠`;
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

  const dayStart = new Date(day);
  dayStart.setHours(HOURS[0], 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(HOURS[HOURS.length - 1] + 1, 0, 0, 0);

  const start = parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
  const end = parseIso(schedule.endLocal ?? schedule.endUtc ?? schedule.startLocal ?? schedule.startUtc ?? undefined) ?? start;
  if (!start || !end) {
    return null;
  }

  const visibleStart = start < dayStart ? dayStart : start;
  const visibleEnd = end > dayEnd ? dayEnd : end;
  const totalSpanHours = HOURS[HOURS.length - 1] + 1 - HOURS[0];

  const startHour = (visibleStart.getHours() + visibleStart.getMinutes() / 60) - HOURS[0];
  const endHour = (visibleEnd.getHours() + visibleEnd.getMinutes() / 60) - HOURS[0];
  const top = clamp(startHour * HOUR_HEIGHT, 0, columnHeight);
  const rawHeight = Math.max((endHour - startHour) * HOUR_HEIGHT, HOUR_HEIGHT / 3);
  const maxHeight = columnHeight - top;
  const height = clamp(rawHeight, HOUR_HEIGHT / 2, maxHeight || columnHeight / totalSpanHours);

  return { top, height };
};

type WeekViewProps = {
  weekStart: Date;
  schedules: Schedule[];
  onSelectSlot(start: Date, end: Date): void;
  onSelectEvent(schedule: Schedule): void;
  loading?: boolean;
};

export function WeekView({ weekStart, schedules, onSelectSlot, onSelectEvent, loading = false }: WeekViewProps) {
  const days = useMemo<Date[]>(() => {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      return date;
    });
  }, [weekStart]);

  const eventsByDay = useMemo(() => {
    return days.map((day) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      return schedules.filter((schedule) => eventOverlapsDay(schedule, dayStart, dayEnd));
    });
  }, [days, schedules]);

  const templateColumns = '88px repeat(7, minmax(0, 1fr))';
  const columnHeight = HOUR_HEIGHT * HOURS.length;

  return (
    <div className="relative overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm" role="grid" aria-label="週次スケジュールビュー">
      <div
        className="grid border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
        style={{ gridTemplateColumns: templateColumns }}
      >
        <div className="sticky left-0 z-10 border-r border-slate-200 px-3 py-3 text-xs uppercase tracking-wide text-slate-500">
          時間
        </div>
        {days.map((day, index) => {
          const weekday = WEEKDAY_LABELS[index];
          const label = `${day.getMonth() + 1}/${day.getDate()} (${weekday})`;
          return (
            <div
              key={day.toISOString()}
              className="border-r border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-800"
            >
              <span aria-hidden="true">{label}</span>
              <span className="sr-only">{`${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日 (${weekday})`}</span>
            </div>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: templateColumns }} role="rowgroup">
        <div className="relative border-r border-slate-200 bg-slate-50/60">
          {HOURS.map((hour) => (
            <div key={hour} className="flex h-14 items-start justify-end border-b border-slate-100 pr-3 text-xs text-slate-500">
              {`${String(hour).padStart(2, '0')}:00`}
            </div>
          ))}
        </div>

        {days.map((day, index) => {
          const schedulesForDay = eventsByDay[index] ?? [];
          return (
            <div
              key={`col:${day.toISOString()}`}
              className="relative border-r border-slate-200"
              style={{ minHeight: columnHeight }}
              role="presentation"
            >
              {HOURS.map((hour) => {
                const slotStart = new Date(day);
                slotStart.setHours(hour, 0, 0, 0);
                const slotEnd = new Date(slotStart);
                slotEnd.setHours(slotStart.getHours() + 1);
                return (
                  <button
                    type="button"
                    key={`${day.toISOString()}-${hour}`}
                    className="group relative flex h-14 w-full items-start border-b border-slate-100 px-2 text-left text-xs text-slate-500 transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                    onClick={() => onSelectSlot(slotStart, slotEnd)}
                    aria-label={buildSlotLabel(day, hour)}
                  >
                    <span className="sr-only">空き枠を追加</span>
                  </button>
                );
              })}

              {schedulesForDay.slice(0, MAX_EVENTS_PER_DAY).map((schedule) => {
                const position = resolveEventPosition(schedule, day, columnHeight);
                if (!position) {
                  return null;
                }

                const start = parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
                const end = parseIso(schedule.endLocal ?? schedule.endUtc ?? schedule.startLocal ?? schedule.startUtc ?? undefined);
                const labelParts = [schedule.title || '予定'];
                if (start && end) {
                  labelParts.push(`${formatTime(start)} – ${formatTime(end)}`);
                }
                const label = labelParts.join(' / ');
                const statusClass = STATUS_STYLES[schedule.status] ?? STATUS_STYLES.draft;
                const baseClass = 'absolute left-1 right-1 flex flex-col rounded-md border px-2 py-1 text-left text-xs shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';

                return (
                  <button
                    key={schedule.id}
                    type="button"
                    className={`${baseClass} ${statusClass}`}
                    style={{ top: position.top, height: position.height }}
                    onClick={() => onSelectEvent(schedule)}
                    aria-label={label}
                    data-testid="schedule-item"
                  >
                    <span className="font-medium leading-tight">{schedule.title || '予定'}</span>
                    {start && end ? (
                      <span className="text-[11px] text-slate-600">{`${formatTime(start)} – ${formatTime(end)}`}</span>
                    ) : null}
                    {schedule.notes ? (
                      <span className="mt-1 line-clamp-2 text-[11px] text-slate-600">{schedule.notes}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-slate-600" aria-live="polite">
          予定を読み込んでいます…
        </div>
      ) : null}
    </div>
  );
}

export default WeekView;

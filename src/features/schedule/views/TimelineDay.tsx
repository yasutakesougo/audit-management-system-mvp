import { useCallback, useId, useMemo, useRef, type HTMLAttributes } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import TimelineEventCard from './TimelineEventCard';
import { getTimelineSubtitle, laneLabels, laneOrder } from './TimelineWeek';
import type { Schedule } from '../types';
import { getLocalDateKey, startOfDay } from '../dateutils.local';
import { cn } from '@/utils/cn';

type TimelineDayProps = {
  events: Schedule[];
  date: Date;
};

type LaneBuckets = Record<Schedule['category'], Schedule[]>;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function TimelineDay({ events, date }: TimelineDayProps) {
  const dayStart = useMemo(() => startOfDay(date), [date]);
  const dayEnd = useMemo(() => new Date(dayStart.getTime() + ONE_DAY_MS), [dayStart]);
  const buckets = useMemo(() => buildDayBuckets(events, dayStart, dayEnd), [events, dayStart, dayEnd]);
  const dayKey = useMemo(() => getLocalDateKey(dayStart) ?? format(dayStart, 'yyyy-MM-dd'), [dayStart]);
  const isToday = useMemo(() => getLocalDateKey(new Date()) === dayKey, [dayKey]);
  const rangeLabel = useMemo(() => format(dayStart, 'yyyy年M月d日 (EEE)', { locale: ja }), [dayStart]);
  const rangeLabelId = useId();
  const hourSlots = useMemo(() => buildHourSlots(dayStart), [dayStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleScrollReset = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }, []);

  return (
    <section aria-label={`日タイムライン (${rangeLabel})`} className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">日タイムライン</h2>
          <p id={rangeLabelId} className="text-xs text-gray-600">
            {rangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleScrollReset}
            className={cn(
              'rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
              'hover:bg-indigo-100'
            )}
          >
            今日へ移動
          </button>
        </div>
      </header>

      <div className="overflow-x-auto" ref={scrollRef} data-testid="day-scroll-container">
        <div
          role="grid"
          aria-label="指定日の予定一覧"
          aria-describedby={rangeLabelId}
          className="min-w-max rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div
            role="row"
            className="grid border-b border-gray-200 text-xs font-medium text-gray-600"
            style={{ gridTemplateColumns: '140px minmax(320px, 1fr)' }}
          >
            <div role="columnheader" className="px-3 py-2 text-left text-gray-500">
              カテゴリ
            </div>
            <div
              role="columnheader"
              className={cn(
                'px-3 py-2 text-left',
                isToday ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 ring-inset' : 'bg-gray-50 text-gray-700'
              )}
            >
              {rangeLabel}
            </div>
          </div>

          {laneOrder.map((category) => {
            const laneEvents = buckets[category] ?? [];
            return (
              <div
                key={category}
                role="row"
                className="grid border-b last:border-b-0 border-gray-100"
                style={{ gridTemplateColumns: '140px minmax(320px, 1fr)' }}
              >
                <div
                  role="rowheader"
                  className="flex items-center bg-gray-50 px-3 py-3 text-sm font-medium text-gray-700"
                >
                  {laneLabels[category]}
                </div>
                <div
                  role="gridcell"
                  aria-label={`${laneLabels[category]}・${rangeLabel}`}
                  className={cn(
                    'flex min-h-[140px] flex-col gap-2 p-3',
                    isToday ? 'bg-indigo-50/40 ring-1 ring-indigo-100 ring-inset' : 'bg-white'
                  )}
                >
                  <ul aria-label="24時間スロット" className="sr-only">
                    {hourSlots.map((slot) => (
                      <li key={slot.iso} data-testid="day-hour-slot" data-hour={slot.label}>
                        {slot.label}
                      </li>
                    ))}
                  </ul>
                  {laneEvents.length ? (
                    laneEvents.map((event) => (
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
                        containerProps={{
                          'data-schedule-event': 'true',
                          'data-id': event.id,
                          'data-status': event.status,
                          'data-category': event.category,
                          'data-all-day': event.allDay ? '1' : '0',
                          'data-recurrence': event.recurrenceRule ? '1' : '0',
                        } as HTMLAttributes<HTMLElement>}
                      />
                    ))
                  ) : (
                    <p className="text-[11px] text-gray-400">予定なし</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
};

function buildHourSlots(dayStart: Date): HourSlot[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const slot = new Date(dayStart.getTime());
    slot.setHours(hour, 0, 0, 0);
    return {
      label: format(slot, 'HH:mm'),
      iso: slot.toISOString(),
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

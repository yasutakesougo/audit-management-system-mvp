import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, HTMLAttributes } from 'react';
import { addDays, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import TimelineEventCard from './TimelineEventCard';
import type { Schedule, ScheduleStaff } from '../types';
import { isOrg, isStaff, isUserCare } from '../types';
import { formatOrgSubtitle } from '../presenters/format';
import { getLocalDateKey, startOfDay } from '../dateutils.local';
import { cn } from '@/utils/cn';

export const laneOrder: Array<Schedule['category']> = ['User', 'Staff', 'Org'];
export const laneLabels: Record<Schedule['category'], string> = {
  User: '利用者レーン',
  Staff: '職員レーン',
  Org: '組織イベント',
};

type TimelineWeekProps = {
  events: Schedule[];
  startDate?: Date;
  onEventMove?: (payload: EventMovePayload) => void;
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

export default function TimelineWeek({ events, startDate, onEventMove }: TimelineWeekProps) {
  const baseDate = useMemo(() => startOfDay(startDate ?? guessWeekStart(events)), [events, startDate]);
  const weekDays = useMemo(() => buildWeekDays(baseDate), [baseDate]);
  const columnTemplate = useMemo(
    () => `140px repeat(${weekDays.length}, minmax(0, 1fr))`,
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

  return (
    <section aria-label="週タイムライン" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3" aria-label="タイムラインのヘッダー">
        <div>
          <h2 className="text-base font-semibold text-gray-900">週タイムライン</h2>
          <p id={rangeLabelId} className="text-xs text-gray-600">
            {rangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="今日の列に移動"
            onClick={handleTodayJump}
            disabled={!hasToday}
            className={cn(
              'rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
              hasToday ? 'hover:bg-indigo-100' : 'cursor-not-allowed opacity-60'
            )}
          >
            今日へ移動
          </button>
        </div>
      </header>

      {enableDrag ? (
        <p id={dragInstructionsId} className="sr-only">
          Shiftキーと左右矢印キーで予定の日付を移動できます。ドラッグ＆ドロップにも対応しています。
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <div
          role="grid"
          aria-label="週ごとの予定一覧"
          aria-describedby={gridDescribedBy}
          className="min-w-max rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div role="row" className="grid border-b border-gray-200 text-xs font-medium text-gray-600" style={{ gridTemplateColumns: columnTemplate }}>
            <div role="columnheader" className="px-3 py-2 text-left text-gray-500">カテゴリ</div>
            {weekDays.map((day, index) => (
              <div
                key={day.key}
                role="columnheader"
                id={`timeline-week-header-${day.key}`}
                ref={(node) => {
                  if (node) {
                    headersRef.current[day.key] = node;
                  } else {
                    delete headersRef.current[day.key];
                  }
                }}
                tabIndex={-1}
                className={cn(
                  'flex flex-col gap-0.5 px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                  index > 0 ? 'border-l border-gray-200' : 'border-l-0',
                  day.isToday
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 ring-inset'
                    : 'bg-gray-50 text-gray-700'
                )}
              >
                <span className={cn('text-[11px] font-medium tracking-wide', day.isToday ? 'text-indigo-600' : 'text-gray-500')}>
                  {day.weekday}
                </span>
                <span className="text-sm font-semibold text-gray-900">{day.label}</span>
              </div>
            ))}
          </div>

          {laneOrder.map((category) => (
            <div
              key={category}
              role="row"
              className="grid border-b last:border-b-0 border-gray-100"
              style={{ gridTemplateColumns: columnTemplate }}
            >
              <div
                role="rowheader"
                className="flex items-center bg-gray-50 px-3 py-3 text-sm font-medium text-gray-700"
              >
                {laneLabels[category]}
              </div>
              {weekDays.map((day, index) => {
                const dayEvents = laneMatrix[category]?.[day.key] ?? [];
                const ariaLabel = `${laneLabels[category]}・${format(day.date, 'M月d日 (EEE)', { locale: ja })}`;
                const dropKey = `${category}-${day.key}`;
                return (
                  <div
                    key={day.key}
                    role="gridcell"
                    aria-label={ariaLabel}
                    className={cn(
                      'flex min-h-[120px] flex-col gap-2 p-3 align-top transition-colors',
                      index > 0 ? 'border-l border-gray-100' : 'border-l-0',
                      day.isToday ? 'bg-indigo-50/40 ring-1 ring-indigo-100 ring-inset' : 'bg-white',
                      enableDrag && activeDropKey === dropKey ? 'ring-2 ring-indigo-300 ring-inset' : null
                    )}
                    onDragOver={enableDrag ? handleDragOver : undefined}
                    onDragEnter={enableDrag ? handleDragEnter(dropKey) : undefined}
                    onDragLeave={enableDrag ? handleDragLeave : undefined}
                    onDrop={enableDrag ? handleDrop(category, day.key) : undefined}
                    aria-dropeffect={enableDrag ? 'move' : undefined}
                  >
                    {dayEvents.length ? (
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
                              'aria-grabbed': draggingId === event.id,
                              'aria-describedby': dragInstructionsId,
                              'aria-roledescription': 'ドラッグ可能な予定',
                            }
                          : baseContainerProps;

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
                      <p className="text-[11px] text-gray-400">予定なし</p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
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
  return startOfDay(earliestTs !== null ? new Date(earliestTs) : new Date());
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

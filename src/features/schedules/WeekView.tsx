import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import type { MouseEvent } from 'react';
import { useMemo } from 'react';

import { TESTIDS } from '@/testids';

import type { SchedItem } from './data';
import { SCHEDULES_DEBUG } from './debug';
import { getScheduleStatusMeta } from './statusMetadata';
import { getDayChipSx } from './theme/dateStyles';
import { type DateRange, makeRange, useSchedules } from './useSchedules';

export type WeekViewProps = {
  items?: SchedItem[];
  loading?: boolean;
  range?: DateRange;
  onDayClick?: (dayIso: string, event?: MouseEvent<HTMLButtonElement>) => void;
  activeDateIso?: string | null;
  onItemSelect?: (item: SchedItem) => void;
};

const startOfWeek = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = (day + 6) % 7; // Monday start
  next.setDate(next.getDate() - diff);
  return next;
};

const endOfWeek = (start: Date): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
};

const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

const formatEventTimeRange = (startIso: string, endIso?: string | null): string => {
  const start = formatTime(startIso);
  if (!endIso) {
    return start;
  }
  return `${start} – ${formatTime(endIso)}`;
};

const buildWeekEventAriaLabel = (item: SchedItem, timeRange: string, statusLabel?: string): string => {
  const service = item.subType ?? item.serviceType ?? '';
  const person = item.personName ?? '';
  const staffNames = Array.isArray(item.staffNames) ? item.staffNames.filter(Boolean).join('、') : '';
  const location = item.locationName ?? item.location ?? '';
  const reason = item.statusReason?.trim() ?? '';

  const segments = [
    timeRange,
    item.title,
    service ? `サービス ${service}` : '',
    person ? `利用者 ${person}` : '',
    staffNames ? `担当 ${staffNames}` : '',
    location ? `場所 ${location}` : '',
    statusLabel ? `状態 ${statusLabel}` : '',
    reason ? `メモ ${reason}` : '',
  ];

  return segments.filter(Boolean).join(' ');
};

const dayFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

const rangeFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
});

const toDateIsoLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type ServiceTypeKey = 'normal' | 'transport' | 'respite' | 'nursing' | 'absence' | 'other';

const resolveServiceTypeKey = (rawCategory?: string | null): ServiceTypeKey => {
  if (!rawCategory) return 'normal';
  const value = rawCategory.toLowerCase();
  if (value.includes('送迎') || value.includes('transport')) return 'transport';
  if (value.includes('短期') || value.includes('respite')) return 'respite';
  if (value.includes('看護') || value.includes('nurse') || value.includes('medical')) return 'nursing';
  if (value.includes('欠席') || value.includes('absent') || value.includes('absence')) return 'absence';
  return 'normal';
};

export default function WeekView(props: WeekViewProps) {
  const hasExternalData = props.items !== undefined && props.loading !== undefined;

  if (hasExternalData) {
    return (
      <WeekViewContent
        items={props.items!}
        loading={props.loading!}
        range={props.range}
        onDayClick={props.onDayClick}
        activeDateIso={props.activeDateIso}
        onItemSelect={props.onItemSelect}
      />
    );
  }

  return <WeekViewWithData {...props} />;
}

type WeekViewContentProps = {
  items: SchedItem[];
  loading: boolean;
  range?: DateRange;
  onDayClick?: (dayIso: string, event?: MouseEvent<HTMLButtonElement>) => void;
  activeDateIso?: string | null;
  onItemSelect?: (item: SchedItem) => void;
};

const WeekViewWithData = (props: WeekViewProps) => {
  const resolvedRange = useMemo(() => props.range ?? defaultWeekRange(), [props.range]);
  const { items, loading } = useSchedules(resolvedRange);

  return (
    <WeekViewContent
      items={items}
      loading={loading}
      range={resolvedRange}
      onDayClick={props.onDayClick}
      activeDateIso={props.activeDateIso}
      onItemSelect={props.onItemSelect}
    />
  );
};

const WeekViewContent = ({ items, loading, onDayClick, activeDateIso, range, onItemSelect }: WeekViewContentProps) => {
  const theme = useTheme();
  const resolvedRange = useMemo(() => range ?? defaultWeekRange(), [range]);

  if (SCHEDULES_DEBUG) {
    // eslint-disable-next-line no-console -- diagnostics for E2E/dev only
    console.log('[schedules] WeekView', {
      from: resolvedRange.from,
      to: resolvedRange.to,
      items: items.length,
    });
  }

  const weekDays = useMemo(() => {
    const start = new Date(resolvedRange.from);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = toDateIsoLocal(date);
      return {
        iso,
        label: dayFormatter.format(date),
      };
    });
  }, [resolvedRange.from]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const resolvedActiveIso = activeDateIso ?? weekDays[0]?.iso ?? todayIso;

  const groupedItems = useMemo(() => {
    const map = new Map<string, typeof items>();
    weekDays.forEach((day) => {
      map.set(day.iso, []);
    });
    items.forEach((item) => {
      const key = item.start.slice(0, 10);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });
    return map;
  }, [items, weekDays]);

  const selectedItems = groupedItems.get(resolvedActiveIso) ?? [];

  const handleClick = (iso: string, event: MouseEvent<HTMLButtonElement>) => {
    onDayClick?.(iso, event);
  };

  const rangeLabel = `${rangeFormatter.format(new Date(resolvedRange.from))} – ${rangeFormatter.format(
    new Date(resolvedRange.to),
  )}`;

  return (
    <div data-testid="schedule-week-view" className="space-y-3">
      <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
        <span>今週の予定</span>
        <span>{rangeLabel}</span>
      </header>
      <div
        aria-label="週ごとの予定一覧"
        role="grid"
        data-testid={TESTIDS['schedules-week-grid']}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7"
      >
        {weekDays.map((day) => {
          const isToday = day.iso === todayIso;
          const isActive = day.iso === resolvedActiveIso;
          const dayItems = groupedItems.get(day.iso) ?? [];
          const ariaLabel = `${day.label}${isToday ? '（今日）' : ''} 予定${dayItems.length}件`;
          return (
            <div key={day.iso} role="gridcell" className="min-w-0">
              <Button
                type="button"
                aria-label={ariaLabel}
                aria-current={isActive ? 'date' : undefined}
                onClick={(event) => handleClick(day.iso, event as MouseEvent<HTMLButtonElement>)}
                data-testid={`${TESTIDS.SCHEDULES_WEEK_DAY_PREFIX}-${day.iso}`}
                variant="outlined"
                sx={{ ...dayChipBaseSx, ...getDayChipSx({ isToday, isSelected: isActive }) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.65)' }}>{day.label}</span>
                  {isToday && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: '#E3F2FD',
                        color: '#0D47A1',
                        fontWeight: 700,
                      }}
                    >
                      今日
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  {dayItems.length === 0 ? (
                    <span style={{ fontSize: 11, color: 'rgba(31,41,55,0.9)' }}>予定なし</span>
                  ) : (
                    dayItems.slice(0, 3).map((item) => {
                      const statusMeta = getScheduleStatusMeta(item.status);
                      const showStatus = item.status && item.status !== 'Planned' && statusMeta;
                      const label = showStatus ? `${item.title}（${statusMeta!.label}）` : item.title;
                      return (
                        <span
                          key={item.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '2px 6px',
                            borderRadius: 999,
                            fontSize: 11,
                            background: 'rgba(0,0,0,0.04)',
                            color: 'rgba(0,0,0,0.75)',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: statusMeta?.dotColor ?? 'rgba(76,175,80,0.9)',
                              flexShrink: 0,
                            }}
                          />
                          {label}
                        </span>
                      );
                    })
                  )}
                  {dayItems.length > 3 && (
                    <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)' }}>+{dayItems.length - 3} 件</span>
                  )}
                </div>
              </Button>
            </div>
          );
        })}
      </div>
      {loading ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500" aria-busy="true">
          予定を読み込み中…
        </p>
      ) : selectedItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500" data-testid="schedule-week-empty">
          選択した日の予定はまだありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="schedule-week-list" role="list">
          {selectedItems.map((item) => {
            const statusMeta = getScheduleStatusMeta(item.status);
            const statusLabel = item.status && item.status !== 'Planned' ? statusMeta?.label : undefined;
            const buttonOpacity = statusMeta?.opacity ?? 1;
            const statusReason = item.statusReason?.trim();
            const isDisabled = Boolean(statusMeta?.isDisabled);
            const handleItemClick = () => {
              if (SCHEDULES_DEBUG) {
                // eslint-disable-next-line no-console -- trace row clicks only when debugging schedules
                console.info('[WeekView] row click', item.id);
              }
              if (isDisabled) return;
              onItemSelect?.(item);
            };
            const serviceTypeKey = resolveServiceTypeKey(item.serviceType ?? item.category);
            const serviceTokens = theme.serviceTypeColors?.[serviceTypeKey];
            const timeRange = formatEventTimeRange(item.start, item.end);
            const ariaLabel = buildWeekEventAriaLabel(item, timeRange, statusLabel);

            return (
              <li
                key={item.id}
                data-testid="schedule-item"
                data-category={item.category}
                data-schedule-event="true"
                data-id={item.id}
                data-status={item.status ?? ''}
                data-all-day={item.allDay ? '1' : '0'}
                className="rounded-md border text-left shadow-sm"
                style={{
                  backgroundColor: serviceTokens?.bg,
                  borderColor: serviceTokens?.border,
                }}
                role="listitem"
              >
                <button
                  type="button"
                  className="flex w-full flex-col px-4 py-3 text-left"
                  onClick={handleItemClick}
                  disabled={isDisabled}
                  style={{ opacity: buttonOpacity }}
                  aria-label={ariaLabel}
                  title={timeRange}
                >
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    {serviceTokens ? (
                      <span
                        aria-hidden="true"
                        className="inline-block h-4 w-1 rounded-full"
                        style={{ backgroundColor: serviceTokens.accent }}
                      />
                    ) : null}
                    <span>{item.title}</span>
                    {statusLabel && statusMeta && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          background: statusMeta.chipBg,
                          color: statusMeta.chipColor,
                          fontWeight: 600,
                        }}
                      >
                        {statusLabel}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600 flex flex-wrap gap-2 items-center">
                    <span>{timeRange}</span>
                    {item.locationName ?? item.location ? (
                      <span aria-label="場所" className="truncate">
                        {item.locationName ?? item.location}
                      </span>
                    ) : null}
                  </p>
                  {(item.personName ?? item.serviceType ?? item.subType) && (
                    <p className="text-xs text-slate-500">
                      {[item.personName, item.serviceType ?? item.subType]
                        .filter(Boolean)
                        .join(' / ')}
                    </p>
                  )}
                  {statusReason && (
                    <p className="text-xs text-slate-500 mt-1" data-testid="schedule-status-reason">
                      {statusReason}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const dayChipBaseSx = {
  width: '100%',
  justifyContent: 'flex-start',
  textTransform: 'none',
  alignItems: 'flex-start',
  flexDirection: 'column',
  borderRadius: 2,
  padding: '10px 12px',
  gap: 0.75,
  color: 'text.primary',
} as const;

const defaultWeekRange = (): DateRange => {
  const start = startOfWeek(new Date());
  return makeRange(start, endOfWeek(start));
};

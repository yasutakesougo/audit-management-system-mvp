import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { MouseEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { TESTIDS } from '@/testids';

import type { SchedItem } from './data';
import { SCHEDULES_DEBUG } from './debug';
import { getScheduleStatusMeta } from './statusMetadata';
import { SERVICE_TYPE_COLOR, SERVICE_TYPE_META, normalizeServiceType, type ServiceTypeColor, type ServiceTypeKey } from './serviceTypeMetadata';
import { getDayChipSx } from './theme/dateStyles';
import { type DateRange } from './data';
import { makeRange, useSchedules } from './useSchedules';
import {
  WeekServiceSummaryChips,
  type WeekServiceSummaryItem,
} from './WeekServiceSummaryChips';

export type WeekViewProps = {
  items?: WeekSchedItem[];
  loading?: boolean;
  range?: DateRange;
  onDayClick?: (dayIso: string, event?: MouseEvent<HTMLButtonElement>) => void;
  activeDateIso?: string | null;
  onItemSelect?: (item: WeekSchedItem) => void;
  onItemAccept?: (item: WeekSchedItem) => void;
};

type WeekSchedItem = SchedItem & { staffNames?: string[]; location?: string };

type WeekServiceFilter = ServiceTypeKey | 'unset';

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

const buildWeekEventAriaLabel = (
  item: SchedItem & { staffNames?: string[]; location?: string },
  timeRange: string,
  statusLabel?: string,
): string => {
  const itemAny = item as Record<string, unknown>;
  const service = item.subType ?? item.serviceType ?? '';
  const person = item.personName ?? '';
  const staffNamesRaw = itemAny.staffNames as string[] | undefined;
  const staffNames = Array.isArray(staffNamesRaw) ? staffNamesRaw.filter(Boolean).join('、') : '';
  const location = item.locationName ?? (itemAny.location as string | undefined) ?? '';
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

const mapServiceTypeToThemeKey = (value?: WeekServiceFilter | null): WeekServiceFilter => value ?? 'unset';

const getServiceTypeMeta = (value?: WeekServiceFilter | null) =>
  value && value !== 'unset' ? SERVICE_TYPE_META[value] : undefined;

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
        onItemAccept={props.onItemAccept}
      />
    );
  }

  return <WeekViewWithData {...props} />;
}

type WeekViewContentProps = {
  items: WeekSchedItem[];
  loading: boolean;
  range?: DateRange;
  onDayClick?: (dayIso: string, event?: MouseEvent<HTMLButtonElement>) => void;
  activeDateIso?: string | null;
  onItemSelect?: (item: WeekSchedItem) => void;
  onItemAccept?: (item: WeekSchedItem) => void;
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
      onItemAccept={props.onItemAccept}
    />
  );
};

const WeekViewContent = ({ items, loading, onDayClick, activeDateIso, range, onItemSelect, onItemAccept }: WeekViewContentProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuItem, setMenuItem] = useState<WeekSchedItem | null>(null);
  const resolvedRange = useMemo(() => range ?? defaultWeekRange(), [range]);

  type ServiceTokens = { bg: string; border: string; accent: string };

  const baseServiceTokens = useMemo<Record<ServiceTypeKey, ServiceTokens>>(() => {
    const buildTokens = (color: ServiceTypeColor): ServiceTokens => {
      if (color === 'default') {
        return {
          bg: theme.palette.grey[50],
          border: theme.palette.grey[300],
          accent: theme.palette.grey[600],
        };
      }
      const paletteEntry = theme.palette[color];
      return {
        bg: paletteEntry?.light ?? theme.palette.grey[50],
        border: paletteEntry?.main ?? theme.palette.grey[300],
        accent: paletteEntry?.dark ?? theme.palette.grey[700],
      };
    };

    return (Object.keys(SERVICE_TYPE_COLOR) as ServiceTypeKey[]).reduce<Record<ServiceTypeKey, ServiceTokens>>((map, key) => {
      map[key] = buildTokens(SERVICE_TYPE_COLOR[key]);
      return map;
    }, {} as Record<ServiceTypeKey, ServiceTokens>);
  }, [theme]);

  const serviceTypeColors = (theme as unknown as {
    serviceTypeColors?: Record<string, ServiceTokens>;
  }).serviceTypeColors;

  const getServiceTokens = useCallback(
    (key: ServiceTypeKey): ServiceTokens => {
      const override = serviceTypeColors?.[key];
      if (override) return override;
      return baseServiceTokens[key];
    },
    [baseServiceTokens, serviceTypeColors],
  );

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

  const serviceSummary: WeekServiceSummaryItem[] = useMemo(() => {
    const counts: Partial<Record<WeekServiceFilter, number>> = {};

    selectedItems.forEach((item) => {
      const normalizedServiceType = normalizeServiceType(item.serviceType as string | null);
      const key = mapServiceTypeToThemeKey(normalizedServiceType);
      counts[key] = (counts[key] ?? 0) + 1;
    });

    return (Object.keys(SERVICE_TYPE_META) as WeekServiceFilter[]).map<WeekServiceSummaryItem>((key) => {
      const meta = getServiceTypeMeta(key);

      return {
        key,
        label: meta?.label ?? key,
        count: counts[key] ?? 0,
        color: meta?.color,
        tokens: getServiceTokens(key),
      };
    });
  }, [getServiceTokens, selectedItems]);

  const handleClick = (iso: string, event: MouseEvent<HTMLButtonElement>) => {
    onDayClick?.(iso, event);
  };

  const handleMenuOpen = (event: MouseEvent<HTMLElement>, item: WeekSchedItem) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuItem(item);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuItem(null);
  };

  const handleMenuEdit = () => {
    if (menuItem) {
      onItemSelect?.(menuItem);
    }
    handleMenuClose();
  };

  const handleMenuAccept = () => {
    if (menuItem && onItemAccept) {
      onItemAccept(menuItem);
    }
    handleMenuClose();
  };

  const rangeLabel = `${rangeFormatter.format(new Date(resolvedRange.from))} – ${rangeFormatter.format(
    new Date(resolvedRange.to),
  )}`;

  const serviceSummaryItems: WeekServiceSummaryItem[] = serviceSummary
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      ...entry,
      testId: `${TESTIDS.SCHEDULES_WEEK_SERVICE_SUMMARY}-${entry.key}`,
    }));

  return (
    <div data-testid="schedule-week-view" className="space-y-3">
      <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
        <span>今週の予定</span>
        <span>{rangeLabel}</span>
      </header>
      <div
        aria-label="週ごとの予定一覧"
        role="grid"
        aria-rowcount={1}
        aria-colcount={weekDays.length}
        data-testid={TESTIDS['schedules-week-grid']}
        className="w-full"
      >
        <div className="mb-2" data-testid={TESTIDS.SCHEDULES_WEEK_SERVICE_SUMMARY}>
          {serviceSummaryItems.length === 0 ? (
            <span className="text-xs text-slate-500">区分未設定 0件</span>
          ) : (
            <WeekServiceSummaryChips items={serviceSummaryItems} />
          )}
        </div>
        <div role="row" aria-rowindex={1} className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {weekDays.map((day, index) => {
            const isToday = day.iso === todayIso;
            const isActive = day.iso === resolvedActiveIso;
            const dayItems = groupedItems.get(day.iso) ?? [];
            const ariaLabel = `${day.label}${isToday ? '（今日）' : ''} 予定${dayItems.length}件`;
            return (
              <div
                key={day.iso}
                role="gridcell"
                aria-colindex={index + 1}
                aria-selected={isActive}
                className="min-w-0"
              >
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
                        const normalizedServiceType = normalizeServiceType(item.serviceType as string | null);
                        const serviceTypeMeta = getServiceTypeMeta(normalizedServiceType);
                        const compactLabel = `${formatEventTimeRange(item.start, item.end)} ${serviceTypeMeta?.label ?? item.title}`.trim();
                        const label = isMobile ? compactLabel : showStatus ? `${item.title}（${statusMeta!.label}）` : item.title;
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
            const normalizedServiceType = normalizeServiceType(item.serviceType as string | null);
            const serviceTypeKey = mapServiceTypeToThemeKey(normalizedServiceType);
            const serviceTokens = getServiceTokens(serviceTypeKey);
            const timeRange = formatEventTimeRange(item.start, item.end);
            const serviceTypeMeta = getServiceTypeMeta(normalizedServiceType);
            const showServiceChip = Boolean(serviceTypeMeta && serviceTypeKey !== 'unset');
            const isAccepted = Boolean(item.acceptedOn || item.acceptedBy || item.acceptedNote);
            const ariaLabel = buildWeekEventAriaLabel(item, timeRange, statusLabel);
            const rawLocation = item.locationName ?? (item as Record<string, unknown>).location;
            const locationLabel = typeof rawLocation === 'string' && rawLocation.trim() ? rawLocation : null;
            const primaryTitle = isMobile
              ? item.personName?.trim() || serviceTypeMeta?.label || item.title
              : item.title;
            const metaLine = isMobile
              ? [timeRange]
              : [timeRange, locationLabel].filter(Boolean);

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
                  className="flex w-full flex-col gap-1.5 px-3 py-2 text-left sm:gap-2 sm:px-4 sm:py-3"
                  onClick={handleItemClick}
                  disabled={isDisabled}
                  style={{ opacity: buttonOpacity }}
                  aria-label={ariaLabel}
                  title={timeRange}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      {serviceTokens ? (
                        <span
                          aria-hidden="true"
                          className="inline-block h-4 w-1 rounded-full"
                          style={{ backgroundColor: serviceTokens.accent }}
                        />
                      ) : null}
                      <span>{primaryTitle}</span>
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
                    {!isMobile && (
                      <IconButton
                        aria-label="行の操作"
                        data-testid={TESTIDS['schedule-item-menu']}
                        size="small"
                        onClick={(event) => handleMenuOpen(event, item)}
                        component="span"
                        sx={{ ml: 0.5 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 flex flex-wrap gap-1.5 items-center">
                    {metaLine.map((text, index) => (
                      <span key={`${item.id}-meta-${index}`}>{text}</span>
                    ))}
                  </p>
                  {!isMobile && item.personName ? (
                    <p className="text-xs text-slate-500">{item.personName}</p>
                  ) : null}
                  {(showServiceChip && serviceTypeMeta) || isAccepted ? (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {showServiceChip && serviceTypeMeta ? (
                        <Chip size="small" label={serviceTypeMeta.label} color={serviceTypeMeta.color} variant="outlined" />
                      ) : null}
                      {isAccepted ? <Chip size="small" label="受け入れ済" color="success" variant="filled" /> : null}
                    </div>
                  ) : null}
                  {!isMobile && statusReason && (
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

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose} elevation={3}>
        <MenuItem onClick={handleMenuEdit}>編集</MenuItem>
        <MenuItem onClick={handleMenuAccept}>
          受け入れ登録
        </MenuItem>
      </Menu>
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

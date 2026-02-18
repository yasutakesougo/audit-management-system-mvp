import _Chip from '@mui/material/Chip';
import _IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import _MoreVertIcon from '@mui/icons-material/MoreVert';
import React, { useCallback, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';

import { TESTIDS } from '@/testids';

import type { SchedItem } from '../data';
import { SCHEDULES_DEBUG } from '../debug';
import { getScheduleStatusMeta as _getScheduleStatusMeta } from '../statusMetadata';
import { SERVICE_TYPE_COLOR, SERVICE_TYPE_META, normalizeServiceType, type ServiceTypeColor, type ServiceTypeKey } from '../serviceTypeMetadata';
import { getDayChipSx as _getDayChipSx } from '../theme/dateStyles';
import { type DateRange } from '../data';
import { makeRange, useSchedules } from '../hooks/useSchedules';
import type { ScheduleCategory as _ScheduleCategory } from '@/features/schedules/domain/types';
import { scheduleCategoryLabels as _scheduleCategoryLabels } from '@/features/schedules/domain/categoryLabels';
import {
  WeekServiceSummaryChips,
  type WeekServiceSummaryItem,
} from '../components/WeekServiceSummaryChips';
import { toDateKey } from '../lib/dateKey';

export type WeekViewProps = {
  items?: WeekSchedItem[];
  loading?: boolean;
  range?: DateRange;
  onDayClick?: (dayIso: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onTimeSlotClick?: (dayIso: string, time: string) => void;
  activeDateIso?: string | null;
  onItemSelect?: (item: WeekSchedItem) => void;
  onItemAccept?: (item: WeekSchedItem) => void;
  highlightId?: string | null;
  compact?: boolean;
};

type WeekSchedItem = SchedItem & {
  staffNames?: string[];
  location?: string;
  baseShiftWarnings?: { staffId?: string; staffName?: string }[];
};

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

const _formatEventTimeRange = (startIso: string, endIso?: string | null): string => {
  const start = formatTime(startIso);
  if (!endIso) {
    return start;
  }
  return `${start} – ${formatTime(endIso)}`;
};

const _buildWeekEventAriaLabel = (
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

// Time Grid Constants
const TIME_START = 6;      // 06:00
const TIME_END = 22;       // 22:00
const _SLOT_MINUTES = 30;

const _generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let h = TIME_START; h < TIME_END; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
};

const _getLocalTimeLabel = (iso: string): string => {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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
        onTimeSlotClick={props.onTimeSlotClick}
        activeDateIso={props.activeDateIso}
        onItemSelect={props.onItemSelect}
        onItemAccept={props.onItemAccept}
        highlightId={props.highlightId}
        compact={props.compact}
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
  onTimeSlotClick?: (dayIso: string, time: string) => void;
  activeDateIso?: string | null;
  onItemSelect?: (item: WeekSchedItem) => void;
  onItemAccept?: (item: WeekSchedItem) => void;
  highlightId?: string | null;
  compact?: boolean;
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
      onTimeSlotClick={props.onTimeSlotClick}
      activeDateIso={props.activeDateIso}
      onItemSelect={props.onItemSelect}
      onItemAccept={props.onItemAccept}
      highlightId={props.highlightId}
      compact={props.compact}
    />
  );
};

const WeekViewContent = ({ items, loading, onDayClick: _onDayClick, onTimeSlotClick, activeDateIso: _activeDateIso, range, onItemSelect, onItemAccept, highlightId: _highlightId, compact: _compact }: WeekViewContentProps) => {
  const theme = useTheme();
  const _isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuItem, setMenuItem] = useState<WeekSchedItem | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
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

  const todayIso = toDateKey(new Date());

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

  const serviceSummary: WeekServiceSummaryItem[] = useMemo(() => {
    const counts: Partial<Record<WeekServiceFilter, number>> = {};

    items.forEach((item) => {
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
  }, [getServiceTokens, items]);

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
    <div data-testid={TESTIDS.SCHEDULE_WEEK_ROOT}>
      <div data-testid={TESTIDS.SCHEDULE_WEEK_VIEW} className="space-y-3">
        <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          <span>今週の予定</span>
          <span>{rangeLabel}</span>
        </header>
        <div className="mb-2" data-testid={TESTIDS.SCHEDULES_WEEK_SERVICE_SUMMARY}>
          {serviceSummaryItems.length === 0 ? (
            <span className="text-xs text-slate-500">区分未設定 0件</span>
          ) : (
            <WeekServiceSummaryChips items={serviceSummaryItems} />
          )}
        </div>
        {/* Time Grid View */}
        <div
          aria-label="週ごとの時間割"
          role="grid"
          aria-rowcount={32}
          aria-colcount={8}
          data-testid={TESTIDS['schedules-week-grid']}
          className="w-full"
          style={{
            display: 'grid',
            gridTemplateColumns: '80px repeat(7, 1fr)',
            gap: 0,
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 8,
            backgroundColor: '#fff',
            overflow: 'hidden',
          }}
        >
          {/* Time Labels Header */}
          <div
            style={{
              gridColumn: 1,
              gridRow: '1 / span 1',
              padding: '8px 4px',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              borderRight: '1px solid rgba(15,23,42,0.08)',
              color: 'rgba(15,23,42,0.7)',
            }}
          >
            時刻
          </div>
          {weekDays.map((day, dayIndex) => (
            <div
              key={`header-${day.iso}`}
              style={{
                gridColumn: dayIndex + 2,
                gridRow: 1,
                padding: '8px 4px',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 700,
                borderRight: dayIndex < 6 ? '1px solid rgba(15,23,42,0.08)' : 'none',
                borderBottom: '1px solid rgba(15,23,42,0.08)',
                backgroundColor: day.iso === todayIso ? '#E3F2FD' : undefined,
              }}
            >
              <div>{day.label}</div>
              {day.iso === todayIso && (
                <span style={{ fontSize: 10, color: '#0D47A1', fontWeight: 600 }}>今日</span>
              )}
            </div>
          ))}

          {/* Time Slots Grid */}
          {_generateTimeSlots().map((timeStr, slotIndex) => {
            const isEvenSlot = slotIndex % 2 === 0;
            return (
              <React.Fragment key={`slot-${timeStr}`}>
                {/* Time Label */}
                <div
                  style={{
                    gridColumn: 1,
                    gridRow: slotIndex + 2,
                    padding: '4px',
                    textAlign: 'right',
                    fontSize: 10,
                    fontWeight: 500,
                    borderRight: '1px solid rgba(15,23,42,0.08)',
                    borderBottom: '1px solid rgba(15,23,42,0.08)',
                    color: 'rgba(15,23,42,0.6)',
                    backgroundColor: isEvenSlot ? 'rgba(15,23,42,0.01)' : 'transparent',
                    paddingRight: '6px',
                  }}
                >
                  {timeStr}
                </div>

                {/* Day Cells */}
                {weekDays.map((day, dayIndex) => {
                  const cellKey = `${day.iso}-${timeStr}`;
                  const cellItems = (groupedItems.get(day.iso) ?? []).filter((item) => {
                    // Simple time filtering: check if event start time matches slot
                    const itemStartHour = parseInt(item.start.slice(11, 13), 10);
                    const itemStartMin = parseInt(item.start.slice(14, 16), 10);
                    const [slotHour, slotMin] = timeStr.split(':').map(Number);
                    return itemStartHour === slotHour && itemStartMin === slotMin;
                  });

                  const handleCellClick = () => {
                    onTimeSlotClick?.(day.iso, timeStr);
                  };

                  return (
                    <div
                      key={cellKey}
                      role="gridcell"
                      aria-rowindex={slotIndex + 2}
                      aria-colindex={dayIndex + 2}
                      data-testid="schedules-week-slot"
                      data-day={day.iso}
                      data-time={timeStr}
                      onClick={handleCellClick}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCellClick();
                        }
                      }}
                      tabIndex={0}
                      style={{
                        gridColumn: dayIndex + 2,
                        gridRow: slotIndex + 2,
                        minHeight: '40px',
                        borderRight: dayIndex < 6 ? '1px solid rgba(15,23,42,0.08)' : 'none',
                        borderBottom: '1px solid rgba(15,23,42,0.08)',
                        backgroundColor: hoveredCell === cellKey ? 'rgba(59,130,246,0.1)' : isEvenSlot ? 'rgba(15,23,42,0.01)' : 'transparent',
                        padding: '2px 4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {cellItems.length > 0 && (
                        <div
                          style={{
                            fontSize: 10,
                            padding: '2px 4px',
                            backgroundColor: 'rgba(59,130,246,0.2)',
                            borderLeft: '3px solid rgb(59,130,246)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'rgba(0,0,0,0.8)',
                            position: 'relative',
                          }}
                          title={cellItems.map(item => item.title).join('; ')}
                        >
                          {cellItems[0]?.title}
                          {cellItems.length > 1 && (
                            <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.8 }}>
                              +{cellItems.length - 1}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        {loading ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500" aria-busy="true">
            予定を読み込み中…
          </p>
        ) : null}

        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose} elevation={3}>
          <MenuItem onClick={handleMenuEdit}>編集</MenuItem>
          <MenuItem onClick={handleMenuAccept}>
            受け入れ登録
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
};

const defaultWeekRange = (): DateRange => {
  const start = startOfWeek(new Date());
  return makeRange(start, endOfWeek(start));
};

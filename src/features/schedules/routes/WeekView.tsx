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

/**
 * Extract date key (YYYY-MM-DD) in site timezone
 * Fixes UTC offset bug: JST 07:00-08:59 schedules were appearing in previous day column
 */
const dayKeyInTz = (date: Date, tz = 'Asia/Tokyo'): string => {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(date);
};

/**
 * Parse ISO-like string to Date, handling both UTC (with Z) and local formats
 */
const parseAsDate = (isoLike: string): Date => {
  const t = Date.parse(isoLike);
  return Number.isNaN(t) ? new Date(isoLike) : new Date(t);
};

/**
 * Extract hour and minute in site timezone (for time slot filtering)
 * Fixes display bug: UTC 21:00 was showing as 21:00 instead of JST 06:00
 */
const getTimeInTz = (isoString: string, tz = 'Asia/Tokyo'): { hour: number; minute: number } => {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return { hour, minute };
};

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
    
    // Always log for debugging week view issues
    console.log('[WeekView] 🔍 Grouping logic:', {
      weekDays: weekDays.map(d => ({ iso: d.iso, label: d.label })),
      itemsCount: items.length,
      itemSamples: items.slice(0, 3).map(i => ({
        id: i.id,
        start: i.start,
        parsed: parseAsDate(i.start).toISOString(),
        dayKey: dayKeyInTz(parseAsDate(i.start)),
      })),
    });
    
    items.forEach((item) => {
      // Use JST date key instead of UTC slice to prevent wrong day column assignment
      const key = dayKeyInTz(parseAsDate(item.start));
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });
    
    console.log('[WeekView] 🔍 Grouped result:', {
      mapKeys: Array.from(map.keys()),
      itemsByKey: Object.fromEntries(
        Array.from(map.entries()).map(([k, v]) => [k, v.length])
      ),
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
            maxHeight: 'calc(100vh - 280px)',
            overflow: 'auto',
          }}
        >
          {/* Time Labels Header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              gridColumn: 1,
              gridRow: '1 / span 1',
              padding: '8px 4px',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              borderRight: '1px solid rgba(15,23,42,0.08)',
              borderBottom: '1px solid rgba(15,23,42,0.08)',
              color: 'rgba(15,23,42,0.7)',
              backgroundColor: '#fff',
            }}
          >
            時刻
          </div>
          {weekDays.map((day, dayIndex) => (
            <div
              key={`header-${day.iso}`}
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                gridColumn: dayIndex + 2,
                gridRow: 1,
                padding: '8px 4px',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 700,
                borderRight: dayIndex < 6 ? '1px solid rgba(15,23,42,0.08)' : 'none',
                borderBottom: '1px solid rgba(15,23,42,0.08)',
                backgroundColor: day.iso === todayIso ? '#E3F2FD' : '#fff',
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
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                    gridColumn: 1,
                    gridRow: slotIndex + 2,
                    padding: '4px',
                    textAlign: 'right',
                    fontSize: 10,
                    fontWeight: 500,
                    borderRight: '1px solid rgba(15,23,42,0.08)',
                    borderBottom: '1px solid rgba(15,23,42,0.08)',
                    color: 'rgba(15,23,42,0.6)',
                    backgroundColor: isEvenSlot ? 'rgba(15,23,42,0.01)' : '#fff',
                    paddingRight: '6px',
                  }}
                >
                  {timeStr}
                </div>

                {/* Day Cells */}
                {weekDays.map((day, dayIndex) => {
                  const cellKey = `${day.iso}-${timeStr}`;
                  const cellItems = (groupedItems.get(day.iso) ?? []).filter((item) => {
                    // Filter by time slot (JST timezone-aware)
                    const { hour: itemStartHour, minute: itemStartMin } = getTimeInTz(item.start);
                    const [slotHour, slotMin] = timeStr.split(':').map(Number);
                    return itemStartHour === slotHour && itemStartMin === slotMin;
                  });

                  const handleCellClick = () => {
                    onTimeSlotClick?.(day.iso, timeStr);
                  };

                  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleCellClick();
                  };

                  return (
                    <button
                      type="button"
                      key={cellKey}
                      role="gridcell"
                      aria-rowindex={slotIndex + 2}
                      aria-colindex={dayIndex + 2}
                      data-testid="schedules-week-slot"
                      data-day={day.iso}
                      data-time={timeStr}
                      onPointerUp={handlePointerUp}
                      onClick={(event) => {
                        if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
                        event.preventDefault();
                        event.stopPropagation();
                        handleCellClick();
                      }}
                      onFocus={(event) => {
                        event.currentTarget.style.boxShadow = '0 0 0 2px rgba(25,118,210,0.35)';
                      }}
                      onBlur={(event) => {
                        event.currentTarget.style.boxShadow = 'none';
                      }}
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        all: 'unset',
                        display: 'block',
                        gridColumn: dayIndex + 2,
                        gridRow: slotIndex + 2,
                        width: '100%',
                        minHeight: '40px',
                        outline: 'none',
                        borderRadius: 6,
                        borderRight: dayIndex < 6 ? '1px solid rgba(15,23,42,0.08)' : 'none',
                        borderBottom: '1px solid rgba(15,23,42,0.08)',
                        backgroundColor: hoveredCell === cellKey ? 'rgba(59,130,246,0.1)' : isEvenSlot ? 'rgba(15,23,42,0.01)' : 'transparent',
                        padding: '2px 4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {cellItems.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px' }}>
                          {cellItems.map((item, idx) => (
                            <button
                              key={item.id || idx}
                              type="button"
                              data-testid={TESTIDS.SCHEDULE_ITEM}
                              data-schedule-id={item.id}
                              data-id={item.id}
                              data-category={item.category ?? 'Org'}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onPointerUp={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation(); // Prevent bubbling to parent cell
                                onItemSelect?.(item); // Open the specific item clicked
                              }}
                              style={{
                                all: 'unset',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                width: '100%',
                                fontSize: 10,
                                padding: '2px 4px',
                                backgroundColor: 'rgba(59,130,246,0.2)',
                                borderLeft: '3px solid rgb(59,130,246)',
                                borderRadius: '2px',
                                overflow: 'hidden',
                                color: 'rgba(0,0,0,0.8)',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.2)';
                              }}
                              title={item.title}
                            >
                              <span style={{ flex: 1, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                {item.personName || item.title}
                              </span>
                              {item.baseShiftWarnings && item.baseShiftWarnings.length > 0 && (
                                <div
                                  data-testid="schedule-warning-indicator"
                                  title={`Shift warning: ${item.baseShiftWarnings.map(w => w.staffName).join(', ')}`}
                                  style={{
                                    flexShrink: 0,
                                    fontSize: 9,
                                    padding: '0 2px',
                                    borderRadius: 2,
                                    background: '#f57c00',
                                    color: '#fff',
                                    fontWeight: 700,
                                    minWidth: '16px',
                                    textAlign: 'center',
                                    lineHeight: 1,
                                  }}
                                >
                                  ⚠
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </button>
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

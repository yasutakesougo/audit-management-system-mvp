import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { MouseEvent } from 'react';
import React, { useCallback, useMemo, useState } from 'react';

import { TESTIDS } from '@/testids';

import {
    WeekServiceSummaryChips,
    type WeekServiceSummaryItem,
} from '../components/WeekServiceSummaryChips';
import type { SchedItem } from '../data';
import { type DateRange } from '../data';
import { SCHEDULES_DEBUG } from '../debug';
import { makeRange, useSchedules } from '../hooks/useSchedules';
import { toDateKey } from '../lib/dateKey';
import { SERVICE_TYPE_COLOR, SERVICE_TYPE_META, normalizeServiceType, type ServiceTypeColor, type ServiceTypeKey } from '../serviceTypeMetadata';

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

import {
    _generateTimeSlots,
    dayFormatter,
    dayKeyInTz,
    endOfWeek,
    getServiceTypeMeta,
    getTimeInTz,
    mapServiceTypeToThemeKey,
    parseAsDate,
    rangeFormatter,
    startOfWeek,
    toDateIsoLocal,
    type WeekServiceFilter,
} from './weekViewHelpers';


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

    if (SCHEDULES_DEBUG) {
      // eslint-disable-next-line no-console -- diagnostics for dev/E2E only
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
    }

    items.forEach((item) => {
      // Use JST date key instead of UTC slice to prevent wrong day column assignment
      const key = dayKeyInTz(parseAsDate(item.start));
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    if (SCHEDULES_DEBUG) {
      // eslint-disable-next-line no-console -- diagnostics for dev/E2E only
      console.log('[WeekView] 🔍 Grouped result:', {
        mapKeys: Array.from(map.keys()),
        itemsByKey: Object.fromEntries(
          Array.from(map.entries()).map(([k, v]) => [k, v.length])
        ),
      });
    }

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
                backgroundColor: day.iso === todayIso ? '#E8F0E4' : '#fff',
              }}
            >
              <div>{day.label}</div>
              {day.iso === todayIso && (
                <span style={{ fontSize: 10, color: '#3D6B3C', fontWeight: 600 }}>今日</span>
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
                      aria-label={`${day.label} ${timeStr}時間帯`}
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

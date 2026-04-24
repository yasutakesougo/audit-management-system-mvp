import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { MouseEvent } from 'react';
import { useMemo, useState } from 'react';


import {
    WeekServiceSummaryChips,
    type WeekServiceSummaryItem,
} from '../components/WeekServiceSummaryChips';
import type { SchedItem } from '../data';
import { type DateRange } from '../data';
import { SCHEDULES_DEBUG } from '../debug';
import { useSchedules } from '../hooks/legacy/useSchedules';
import { useWeekViewTokens } from '../hooks/useWeekViewTokens';
import { toDateKey } from '../lib/dateKey';
import { SERVICE_TYPE_META, normalizeServiceType } from '../serviceTypeMetadata';
import { WeekTimeGrid } from './WeekTimeGrid';
import {
    dayFormatter,
    dayKeyInTz,
    defaultWeekRange,
    getServiceTypeMeta,
    mapServiceTypeToThemeKey,
    parseAsDate,
    rangeFormatter,
    toDateIsoLocal,
    type WeekServiceFilter
} from './weekViewHelpers';

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
  const resolvedRange = useMemo(() => range ?? defaultWeekRange(), [range]);

  const { getServiceTokens } = useWeekViewTokens();

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
      testId: `schedules-week-service-summary-${entry.key}`,
    }));


  return (
    <div data-testid="schedule-week-root">
      <div data-testid="schedule-week-view" className="space-y-3">
        <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          <span>今週の予定</span>
          <span>{rangeLabel}</span>
        </header>
        <div className="mb-2" data-testid="schedules-week-service-summary">
          {serviceSummaryItems.length === 0 ? (
            <span className="text-xs text-slate-500">区分未設定 0件</span>
          ) : (
            <WeekServiceSummaryChips items={serviceSummaryItems} />
          )}
        </div>
        <WeekTimeGrid
          weekDays={weekDays}
          todayIso={todayIso}
          groupedItems={groupedItems}
          onTimeSlotClick={onTimeSlotClick}
          onItemSelect={onItemSelect}
        />

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

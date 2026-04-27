import Loading from '@/ui/components/Loading';
import { useId, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ScheduleEmptyHint from '../components/ScheduleEmptyHint';
import { TimelineItem } from '../components/timeline/TimelineItem';
import { SCHEDULE_TIMELINE_SPACING } from '../constants';
import type { SchedItem } from '../data';
import { type DateRange } from '../data';
import type { ScheduleCategory } from '../domain/types';
import { makeRange, useSchedules } from '../hooks/legacy/useSchedules';
import { endOfDay, formatDayLabel, formatTimeRange, startOfDay, toLocalDateIso } from './dayViewHelpers';

type ExtendedSchedItem = SchedItem &
  Partial<{
    location: string;
    resource: string;
    owner: string;
    baseShiftWarnings: { staffId?: string; staffName?: string }[];
  }>;


type DayViewProps = {
  items?: SchedItem[];
  loading?: boolean;
  range?: DateRange;
  categoryFilter?: 'All' | ScheduleCategory;
  emptyCtaLabel?: string;
  compact?: boolean;
  onItemClick?: (item: SchedItem) => void;
};

export default function DayView(props: DayViewProps = {}) {
  const hasExternalData = props.items !== undefined && props.loading !== undefined && props.range !== undefined;

  if (hasExternalData) {
    return (
      <DayViewContent
        items={props.items!}
        loading={props.loading!}
        range={props.range!}
        categoryFilter={props.categoryFilter}
        compact={props.compact}
        onItemClick={props.onItemClick}
      />
    );
  }

  return <DayViewWithData {...props} />;
}

const DayViewWithData = (props: DayViewProps) => {
  const resolvedRange = useMemo(() => {
    if (props.range) return props.range;
    const today = new Date();
    return makeRange(startOfDay(today), endOfDay(today));
  }, [props.range?.from, props.range?.to]);

  const { items, loading } = useSchedules(resolvedRange);

  return (
    <DayViewContent
      items={items}
      loading={loading}
      range={resolvedRange}
      categoryFilter={props.categoryFilter}
      compact={props.compact}
      onItemClick={props.onItemClick}
    />
  );
};

const DayViewContent = ({
  items,
  loading,
  range,
  categoryFilter,
  compact,
  onItemClick,
}: {
  items: SchedItem[];
  loading: boolean;
  range: DateRange;
  categoryFilter?: 'All' | ScheduleCategory;
  compact?: boolean;
  onItemClick?: (item: SchedItem) => void;
}) => {
  const headingId = useId();
  const listLabelId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const isCompact = Boolean(compact);

  const dayIso = toLocalDateIso(range.from);
  const filteredItems = useMemo(
    () => items.filter((item) => toLocalDateIso(item.start) === dayIso),
    [items, dayIso],
  );
  const typedItems = useMemo(
    () =>
      (filteredItems as ExtendedSchedItem[])
        .slice()
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [filteredItems],
  );
  const dayLabel = useMemo(() => formatDayLabel(range.from), [range.from]);

  return (
    <section
      id="panel-day"
      aria-labelledby={headingId}
      data-testid="schedules-day-page"
      style={{ padding: '0 0 16px' }}
    >
      <header
        style={{
          position: isCompact ? 'static' : 'sticky',
          top: 0,
          zIndex: 1,
          padding: isCompact ? '6px 10px 8px' : '8px 12px 12px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(6px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: isCompact ? 4 : 6,
          }}
        >
          <h2
            id={headingId}
            style={{
              margin: 0,
              fontSize: isCompact ? 18 : 22,
              fontWeight: 700,
            }}
          >
            日別スケジュール
          </h2>
          <span
            style={{
              margin: 0,
              fontSize: isCompact ? 12 : 14,
              color: 'rgba(0,0,0,0.65)',
            }}
            aria-live="polite"
          >
            表示日: {dayLabel}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: isCompact ? SCHEDULE_TIMELINE_SPACING.headerGapCompact : SCHEDULE_TIMELINE_SPACING.headerGapNormal,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(location.search);
              params.set('tab', 'week');
              navigate(`/schedules/week?${params.toString()}`);
            }}
            data-testid="schedules-link-week"
            style={{
              padding: isCompact ? '2px 8px' : '4px 10px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.18)',
              background: '#fff',
              fontSize: isCompact ? 12 : 13,
              cursor: 'pointer',
              minHeight: isCompact ? 28 : undefined,
            }}
          >
            週表示に戻る
          </button>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(location.search);
              params.set('tab', 'month');
              navigate(`/schedules/week?${params.toString()}`);
            }}
            data-testid="schedules-link-month"
            style={{
              padding: isCompact ? '2px 8px' : '4px 10px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.14)',
              background: 'rgba(0,0,0,0.03)',
              fontSize: isCompact ? 12 : 13,
              cursor: 'pointer',
              minHeight: isCompact ? 28 : undefined,
            }}
          >
            月表示に切り替え
          </button>
        </div>
      </header>

      <div
        aria-labelledby={listLabelId}
        role="group"
        style={{ marginTop: 0 }}
        data-testid="schedule-day-root"
      >
        <span
          id={listLabelId}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          この日の予定一覧
        </span>

        {loading ? (
          <div
            aria-busy="true"
            aria-live="polite"
            style={{ display: 'grid', gap: isCompact ? SCHEDULE_TIMELINE_SPACING.itemGridGapCompact : SCHEDULE_TIMELINE_SPACING.itemGridGapNormal, paddingTop: isCompact ? 4 : 8 }}
            data-testid="schedules-day-skeleton"
          >
            <Loading />
            <TimelineSkeleton />
            <TimelineSkeleton />
            <TimelineSkeleton />
          </div>
        ) : typedItems.length === 0 ? (
          <div style={{ display: 'grid', gap: isCompact ? SCHEDULE_TIMELINE_SPACING.itemGridGapCompact : SCHEDULE_TIMELINE_SPACING.itemGridGapNormal }}>
            <ScheduleEmptyHint view="day" compact={isCompact} categoryFilter={categoryFilter} />
          </div>
        ) : (
          <ol
            role="list"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: isCompact ? SCHEDULE_TIMELINE_SPACING.itemGapCompact : SCHEDULE_TIMELINE_SPACING.itemGapNormal,
            }}
            data-testid="schedules-day-list"
          >
            {typedItems.map((item) => {
              const timeLabel = formatTimeRange(item.start, item.end);
              const secondaryParts: string[] = [];

              if (item.locationName) secondaryParts.push(item.locationName);
              if (item.notes) secondaryParts.push(item.notes);
              const legacyNote = (item as { note?: string }).note;
              if (legacyNote) secondaryParts.push(legacyNote);

              if (secondaryParts.length === 0) {
                if (item.location) secondaryParts.push(item.location);
                if (item.resource) secondaryParts.push(item.resource);
                if (item.owner) secondaryParts.push(item.owner);
              }

              const secondary = secondaryParts.length > 0 ? secondaryParts.join(' / ') : undefined;
              const warningNames = Array.isArray(item.baseShiftWarnings)
                ? item.baseShiftWarnings
                    .map((w: { staffId?: string; staffName?: string } | undefined) => w?.staffName || w?.staffId)
                    .filter(Boolean)
                : [];
              const hasWarning = warningNames.length > 0;
              const warningLabel = hasWarning ? `担当重複: ${warningNames.join(', ')}` : undefined;

              return (
                <li
                  key={item.id}
                  role="listitem"
                  style={{ margin: 0, padding: 0 }}
                  data-testid="schedules-event-normal"
                  data-schedule-event="true"
                  data-category={item.category ?? 'Org'}
                  data-id={item.id}
                  data-status={item.status ?? undefined}
                >
                  <TimelineItem
                    title={item.title ?? '（タイトル未設定）'}
                    timeLabel={timeLabel}
                    secondary={secondary}
                    status={item.status}
                    statusReason={item.statusReason}
                    acceptedBy={item.acceptedBy}
                    acceptedOn={item.acceptedOn}
                    acceptedNote={item.acceptedNote}
                    hasWarning={hasWarning}
                    warningLabel={warningLabel}
                    compact={isCompact}
                    onClick={onItemClick ? () => onItemClick(item) : undefined}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}


function TimelineSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '80px minmax(0, 1fr)',
        columnGap: 12,
        alignItems: 'flex-start',
        opacity: 0.8,
      }}
    >
      <div
        style={{
          height: 12,
          borderRadius: 999,
          background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 37%, rgba(0,0,0,0.04) 63%)',
          animation: 'shine 1.4s ease infinite',
        }}
      />
      <div
        style={{
          height: 40,
          borderRadius: 12,
          background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.1) 37%, rgba(0,0,0,0.04) 63%)',
          animation: 'shine 1.4s ease infinite',
        }}
      />
    </div>
  );
}

import Loading from '@/ui/components/Loading';
import ScheduleEmptyHint from '../components/ScheduleEmptyHint';
import { TESTIDS } from '@/testids';
import { SCHEDULE_TIMELINE_SPACING } from '../constants';
import { useId, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SchedItem, ScheduleStatus } from '../data';
import { getScheduleStatusMeta } from '../statusMetadata';
import { type DateRange } from '../data';
import { makeRange, useSchedules } from '../hooks/useSchedules';
import type { ScheduleCategory } from '../domain/types';

type ExtendedSchedItem = SchedItem &
  Partial<{
    location: string;
    resource: string;
    owner: string;
    baseShiftWarnings: { staffId?: string; staffName?: string }[];
  }>;

type TimelineItemProps = {
  title: string;
  timeLabel: string;
  secondary?: string;
  status?: ScheduleStatus;
  statusReason?: string | null;
  acceptedBy?: string | null;
  acceptedOn?: string | null;
  acceptedNote?: string | null;
  hasWarning?: boolean;
  warningLabel?: string;
  compact?: boolean;
};

const toLocalDateIso = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDayLabel = (iso: string): string => {
  const date = new Date(iso);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()] ?? '';
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  return `${fmt.format(date)}（${weekday}）`;
};

const formatTimeRange = (fromIso: string, toIso?: string): string => {
  const from = new Date(fromIso);
  const to = toIso ? new Date(toIso) : null;
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!to) {
    return fmt.format(from);
  }

  return `${fmt.format(from)}〜${fmt.format(to)}`;
};

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(24, 0, 0, 0);
  return d;
};

type DayViewProps = {
  items?: SchedItem[];
  loading?: boolean;
  range?: DateRange;
  categoryFilter?: 'All' | ScheduleCategory;
  emptyCtaLabel?: string;
  compact?: boolean;
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
    />
  );
};

const DayViewContent = ({
  items,
  loading,
  range,
  categoryFilter,
  compact,
}: {
  items: SchedItem[];
  loading: boolean;
  range: DateRange;
  categoryFilter?: 'All' | ScheduleCategory;
  compact?: boolean;
}) => {
  const headingId = useId();
  const listLabelId = useId();
  const navigate = useNavigate();
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
      data-testid={TESTIDS['schedules-day-page']}
      style={{ padding: '8px 0 16px' }}
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
            onClick={() => navigate('/schedules/week')}
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
            onClick={() => navigate('/schedules/month')}
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
        style={{ marginTop: isCompact ? 8 : 12 }}
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
            data-testid={TESTIDS['schedules-day-skeleton']}
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
            data-testid={TESTIDS['schedules-day-list']}
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
                  data-testid={TESTIDS['schedules-event-normal']}
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

function TimelineItem({ title, timeLabel, secondary, status, statusReason, acceptedBy, acceptedOn, acceptedNote, hasWarning, warningLabel, compact }: TimelineItemProps) {
  const statusMeta = getScheduleStatusMeta(status);
  const dotColor = statusMeta?.dotColor ?? 'rgba(25,118,210,0.9)';
  const badgeLabel = status && status !== 'Planned' ? statusMeta?.label : undefined;
  const opacity = statusMeta?.opacity ?? 1;
  const reason = statusReason?.trim();
  const warningActive = Boolean(hasWarning);
  const warningText = warningLabel ?? '注意が必要な予定です';
  const hasAcceptance = Boolean(acceptedBy || acceptedOn || acceptedNote);
  const acceptedLabel = (() => {
    if (!hasAcceptance) return '';
    const dateText = (() => {
      if (!acceptedOn) return '';
      const date = new Date(acceptedOn);
      if (Number.isNaN(date.getTime())) return acceptedOn.slice(0, 16);
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    })();

    if (!acceptedBy && !dateText) return '';
    if (acceptedBy && dateText) return `受け入れ: ${acceptedBy} / ${dateText}`;
    if (acceptedBy) return `受け入れ: ${acceptedBy}`;
    return `受け入れ: ${dateText}`;
  })();

  const isCompact = Boolean(compact);
  const labelFontSize = isCompact ? 13 : 14;
  const metaFontSize = isCompact ? 11 : 12;
  const acceptFontSize = isCompact ? 10 : 11;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isCompact ? '68px minmax(0, 1fr)' : '80px minmax(0, 1fr)',
        columnGap: isCompact ? SCHEDULE_TIMELINE_SPACING.itemGridGapCompact : SCHEDULE_TIMELINE_SPACING.itemGridGapNormal,
        alignItems: 'flex-start',
        opacity,
      }}
    >
      <div
        style={{
          fontSize: isCompact ? 11 : 12,
          fontWeight: 600,
          color: 'rgba(0,0,0,0.65)',
          textAlign: 'right',
          paddingTop: isCompact ? 2 : 4,
        }}
      >
        {timeLabel}
      </div>

      <div
        style={{
          position: 'relative',
          paddingLeft: isCompact ? 14 : 18,
          paddingBottom: isCompact ? 6 : 8,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 7,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.06))',
          }}
        />
        {warningActive ? (
          <div
            data-testid="schedule-warning-indicator"
            title={warningText}
            style={{
              position: 'absolute',
              top: isCompact ? -2 : -4,
              right: 0,
              padding: isCompact ? '1px 4px' : '2px 6px',
              borderRadius: 999,
              background: '#f57c00',
              color: '#fff',
              fontSize: isCompact ? 10 : 11,
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
            aria-label={warningText}
          >
            ⚠
          </div>
        ) : null}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 2,
            top: 6,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: dotColor,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.9)',
          }}
        />
        <div
          style={{
            padding: isCompact ? SCHEDULE_TIMELINE_SPACING.itemPaddingCompact : SCHEDULE_TIMELINE_SPACING.itemPaddingNormal,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.02)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              fontSize: labelFontSize,
              fontWeight: 600,
              marginBottom: secondary || badgeLabel || reason ? (isCompact ? 1 : 2) : 0,
            }}
          >
            {title}
            {badgeLabel && (
              <span
                style={{
                  marginLeft: 8,
                  padding: isCompact ? '1px 4px' : '1px 6px',
                  borderRadius: 999,
                  background: statusMeta?.chipBg ?? 'rgba(0,0,0,0.08)',
                  color: statusMeta?.chipColor ?? 'rgba(0,0,0,0.7)',
                  fontSize: isCompact ? 10 : 11,
                  fontWeight: 600,
                }}
              >
                {badgeLabel}
              </span>
            )}
          </div>
          {(secondary || reason) && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: isCompact ? 4 : 6,
                fontSize: metaFontSize,
                color: 'rgba(0,0,0,0.6)',
              }}
            >
              {secondary && <span>{secondary}</span>}
              {reason && <span>{reason}</span>}
            </div>
          )}
          {hasAcceptance ? (
            <div
              style={{
                marginTop: isCompact ? 2 : 4,
                fontSize: acceptFontSize,
                color: 'rgba(0,0,0,0.55)',
              }}
              aria-label="受け入れ情報"
            >
              {acceptedLabel}
            </div>
          ) : (
            <div
              style={{
                marginTop: isCompact ? 2 : 4,
                fontSize: isCompact ? 9 : 10,
                color: 'rgba(0,0,0,0.38)',
                fontStyle: 'italic',
              }}
              aria-label="受け入れ情報（未登録）"
            >
              受け入れ: 未登録
            </div>
          )}
        </div>
      </div>
    </div>
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

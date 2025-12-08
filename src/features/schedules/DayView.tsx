import EmptyState from '@/ui/components/EmptyState';
import Loading from '@/ui/components/Loading';
import { TESTIDS } from '@/testids';
import { useId, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SchedItem, ScheduleStatus } from './data';
import { getScheduleStatusMeta } from './statusMetadata';
import { type DateRange } from './data';
import { makeRange, useSchedules } from './useSchedules';

type ExtendedSchedItem = SchedItem & Partial<{
  location: string;
  resource: string;
  owner: string;
}>;

type TimelineItemProps = {
  title: string;
  timeLabel: string;
  secondary?: string;
  status?: ScheduleStatus;
  statusReason?: string | null;
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
};

export default function DayView(props: DayViewProps = {}) {
  const hasExternalData = props.items !== undefined && props.loading !== undefined && props.range !== undefined;

  if (hasExternalData) {
    return (
      <DayViewContent items={props.items!} loading={props.loading!} range={props.range!} />
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

  return <DayViewContent items={items} loading={loading} range={resolvedRange} />;
};

const DayViewContent = ({ items, loading, range }: { items: SchedItem[]; loading: boolean; range: DateRange }) => {
  const headingId = useId();
  const listLabelId = useId();
  const navigate = useNavigate();

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
      aria-labelledby={headingId}
      data-testid={TESTIDS['schedules-day-page']}
      style={{ padding: '8px 0 16px' }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          padding: '8px 12px 12px',
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
            marginBottom: 6,
          }}
        >
          <h2
            id={headingId}
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            日別スケジュール
          </h2>
          <span
            style={{
              margin: 0,
              fontSize: 14,
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
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/schedules/week')}
            data-testid="schedules-link-week"
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.18)',
              background: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            週表示に戻る
          </button>
          <button
            type="button"
            onClick={() => navigate('/schedules/month')}
            data-testid="schedules-link-month"
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.14)',
              background: 'rgba(0,0,0,0.03)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            月表示に切り替え
          </button>
        </div>
      </header>

      <div
        aria-labelledby={listLabelId}
        role="group"
        style={{ marginTop: 12 }}
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
            style={{ display: 'grid', gap: 12, paddingTop: 8 }}
            data-testid={TESTIDS['schedules-day-skeleton']}
          >
            <Loading />
            <TimelineSkeleton />
            <TimelineSkeleton />
            <TimelineSkeleton />
          </div>
        ) : typedItems.length === 0 ? (
          <EmptyState
            title="この日に登録された予定はありません"
            description="別の日付や条件で再度お試しください。"
            data-testid="schedule-day-empty"
          />
        ) : (
          <ol
            role="list"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: 8,
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

              return (
                <li
                  key={item.id}
                  role="listitem"
                  style={{ margin: 0, padding: 0 }}
                  data-testid={TESTIDS['schedules-event-normal']}
                >
                  <TimelineItem
                    title={item.title ?? '（タイトル未設定）'}
                    timeLabel={timeLabel}
                    secondary={secondary}
                    status={item.status}
                    statusReason={item.statusReason}
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

function TimelineItem({ title, timeLabel, secondary, status, statusReason }: TimelineItemProps) {
  const statusMeta = getScheduleStatusMeta(status);
  const dotColor = statusMeta?.dotColor ?? 'rgba(25,118,210,0.9)';
  const badgeLabel = status && status !== 'Planned' ? statusMeta?.label : undefined;
  const opacity = statusMeta?.opacity ?? 1;
  const reason = statusReason?.trim();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '80px minmax(0, 1fr)',
        columnGap: 12,
        alignItems: 'flex-start',
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(0,0,0,0.65)',
          textAlign: 'right',
          paddingTop: 4,
        }}
      >
        {timeLabel}
      </div>

      <div
        style={{
          position: 'relative',
          paddingLeft: 18,
          paddingBottom: 8,
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
            padding: '6px 10px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.02)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: secondary || badgeLabel || reason ? 2 : 0,
            }}
          >
            {title}
            {badgeLabel && (
              <span
                style={{
                  marginLeft: 8,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: statusMeta?.chipBg ?? 'rgba(0,0,0,0.08)',
                  color: statusMeta?.chipColor ?? 'rgba(0,0,0,0.7)',
                  fontSize: 11,
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
                gap: 6,
                fontSize: 12,
                color: 'rgba(0,0,0,0.6)',
              }}
            >
              {secondary && <span>{secondary}</span>}
              {reason && <span>{reason}</span>}
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

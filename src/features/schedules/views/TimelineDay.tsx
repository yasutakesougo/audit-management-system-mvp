import EmptyState from '@/ui/components/EmptyState';
import Loading from '@/ui/components/Loading';
import { type CSSProperties, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SchedItem } from '../data';
import { getScheduleStatusMeta } from '../statusMetadata';
import { type DateRange, makeRange, useSchedules } from '../useSchedules';

const formatDateLabel = (iso: string): string => {
  const date = new Date(iso);
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  return fmt.format(date);
};

const formatTimeLabel = (iso: string): string => {
  const date = new Date(iso);
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return fmt.format(date);
};

type TimelineDayProps = {
  items?: SchedItem[];
  loading?: boolean;
  range?: DateRange;
};

export default function TimelineDay(props: TimelineDayProps = {}) {
  const hasExternalData = props.items !== undefined && props.loading !== undefined && props.range !== undefined;

  if (hasExternalData) {
    return (
      <TimelineDayContent items={props.items!} loading={props.loading!} range={props.range!} />
    );
  }

  return <TimelineDayWithData {...props} />;
}

const TimelineDayWithData = (props: TimelineDayProps) => {
  const resolvedRange = useMemo(() => {
    if (props.range) return props.range;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return makeRange(today, tomorrow);
  }, [props.range?.from, props.range?.to]);

  const { items, loading } = useSchedules(resolvedRange);

  return <TimelineDayContent items={items} loading={loading} range={resolvedRange} />;
};

const TimelineDayContent = ({ items, loading, range }: { items: SchedItem[]; loading: boolean; range: DateRange }) => {
  const dayIso = range.from.slice(0, 10);
  const navigate = useNavigate();

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.start) return false;
        return item.start.slice(0, 10) === dayIso;
      }),
    [items, dayIso],
  );

  const sortedItems = useMemo(
    () =>
      [...filteredItems].sort((a, b) => {
        const aTime = new Date(a.start).getTime();
        const bTime = new Date(b.start).getTime();
        return aTime - bTime;
      }),
    [filteredItems],
  );

  const dateLabel = useMemo(() => formatDateLabel(range.from), [range.from]);
  const isLoading = loading;

  return (
    <section aria-label="今日の予定タイムライン" data-testid="schedules-timeline-day" style={sectionStyle}>
      <div style={headerContainerStyle}>
        <div style={headerInnerStyle}>
          <h2 style={headingStyle}>タイムライン</h2>
          <p style={subheadingStyle}>対象日: {dateLabel}</p>
        </div>
        <div style={navRowStyle}>
          <button
            type="button"
            onClick={() => navigate('/schedules/week')}
            data-testid="schedules-link-week"
            style={navButtonStyle}
          >
            週表示に戻る
          </button>
          <button
            type="button"
            onClick={() => navigate('/schedules/month')}
            data-testid="schedules-link-month"
            style={{ ...navButtonStyle, borderColor: 'rgba(0,0,0,0.14)', background: 'rgba(0,0,0,0.03)' }}
          >
            月表示に切り替え
          </button>
        </div>
      </div>

      {isLoading ? (
        <div aria-busy="true" aria-live="polite" style={loadingContainerStyle}>
          <Loading />
          <div style={skeletonStyle} />
          <div style={skeletonStyle} />
          <div style={skeletonStyle} />
        </div>
      ) : sortedItems.length === 0 ? (
        <EmptyState
          title="本日の予定はありません"
          description="別の日付や条件で再度お試しください。"
          data-testid="schedules-timeline-empty"
        />
      ) : (
        <ol style={listStyle} aria-label="本日の予定">
          {sortedItems.map((item, index) => {
            const time = formatTimeLabel(item.start ?? range.from);
            const statusMeta = getScheduleStatusMeta(item.status);
            const statusLabel = item.status && item.status !== 'Planned' ? statusMeta?.label : undefined;
            const statusReason = item.statusReason?.trim();
            const details: string[] = [];
            if (item.personName) details.push(item.personName);
            const location = item.locationName ?? item.location;
            if (location) details.push(location);
            if (statusLabel) details.push(statusLabel);
            if (statusReason) details.push(`理由: ${statusReason}`);
            const description = (item.notes)?.trim();
            const detailText = details.join(' / ');

            return (
              <li key={item.id ?? index} style={listItemStyle} role="listitem">
                <div style={timeColumnStyle}>
                  <span style={timeTextStyle}>{time}</span>
                </div>
                <div style={timelineColumnStyle}>
                  <div style={lineWrapperStyle}>
                    <span
                      aria-hidden="true"
                      style={{
                        ...dotStyle,
                        backgroundColor: index === 0 ? '#1976d2' : '#9c27b0',
                      }}
                    />
                    {index < sortedItems.length - 1 && <span style={lineStyle} />}
                  </div>
                  <article
                    style={cardStyle}
                    aria-label={`${time} の予定: ${item.title}`}
                    data-testid="schedules-timeline-item"
                  >
                    <h3 style={cardTitleStyle}>{item.title}</h3>
                    {(description || detailText) && (
                      <p style={cardBodyStyle}>
                        {description}
                        {description && detailText ? ' — ' : ''}
                        {detailText}
                      </p>
                    )}
                  </article>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

const sectionStyle: CSSProperties = {
  paddingTop: 8,
  paddingBottom: 16,
};

const headerContainerStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  padding: '8px 0 12px',
  background: 'linear-gradient(to bottom, rgba(255,255,255,0.96), rgba(255,255,255,0.9))',
  backdropFilter: 'blur(6px)',
  borderBottom: '1px solid rgba(0,0,0,0.08)',
};

const headerInnerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
};

const subheadingStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: 'rgba(0,0,0,0.6)',
};

const navRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 6,
};

const navButtonStyle: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  border: '1px solid rgba(0,0,0,0.18)',
  background: '#fff',
  fontSize: 13,
  cursor: 'pointer',
};

const loadingContainerStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  paddingTop: 12,
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '12px 0 0',
  display: 'grid',
  gap: 12,
};

const listItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '80px 1fr',
  columnGap: 12,
  alignItems: 'flex-start',
};

const timeColumnStyle: CSSProperties = {
  textAlign: 'right',
  paddingTop: 4,
};

const timeTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(0,0,0,0.7)',
};

const timelineColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr)',
  columnGap: 8,
  alignItems: 'stretch',
};

const lineWrapperStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const dotStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '2px solid #fff',
  boxShadow: '0 0 0 2px rgba(0,0,0,0.08)',
  marginBottom: 2,
};

const lineStyle: CSSProperties = {
  flex: 1,
  width: 2,
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.05))',
};

const cardStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.06)',
  background: 'rgba(255,255,255,0.95)',
  padding: '8px 12px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
};

const cardBodyStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 13,
  color: 'rgba(0,0,0,0.7)',
};

const skeletonStyle: CSSProperties = {
  height: 18,
  borderRadius: 9,
  background:
    'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 37%, rgba(0,0,0,0.04) 63%)',
  animation: 'shine 1.4s ease infinite',
};

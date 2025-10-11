import { type CSSProperties, useId, useMemo, useState } from 'react';
import WeekView from './WeekView';
import DayView from './DayView';
import TimelineDay from './views/TimelineDay';
import Loading from '@/ui/components/Loading';
import EmptyState from '@/ui/components/EmptyState';
import { makeRange, useSchedules } from './useSchedules';

type ScheduleTab = 'week' | 'day' | 'timeline';

const TAB_LABELS: Record<ScheduleTab, string> = {
  week: '週',
  day: '日',
  timeline: 'タイムライン',
};

const startOfWeek = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  return next;
};

const endOfWeek = (start: Date): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
};

const formatRangeLabel = (fromIso: string, toIso: string): string => {
  const start = new Date(fromIso);
  const end = new Date(toIso);
  end.setDate(end.getDate() - 1);
  const fmt = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' });
  return `${fmt.format(start)} 〜 ${fmt.format(end)}`;
};

export default function WeekPage() {
  const [tab, setTab] = useState<ScheduleTab>('week');
  const headingId = useId();
  const tablistId = useId();
  const weekRange = useMemo(() => {
    const start = startOfWeek(new Date());
    return makeRange(start, endOfWeek(start));
  }, []);
  const { items, loading: isLoading } = useSchedules(weekRange);
  const weekLabel = useMemo(
    () => formatRangeLabel(weekRange.from, weekRange.to),
    [weekRange.from, weekRange.to],
  );

  const tabButtonIds: Record<ScheduleTab, string> = {
    week: `${tablistId}-tab-week`,
    day: `${tablistId}-tab-day`,
    timeline: `${tablistId}-tab-timeline`,
  };

  return (
    <section aria-labelledby={headingId} data-testid="schedule-week-page">
      <div
        className="schedule-sticky"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: 'white',
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <h1 id={headingId} style={{ margin: '8px 0 4px', fontSize: 28, fontWeight: 700 }}>
          マスター スケジュール
        </h1>
        <p style={{ margin: '0 0 12px', color: 'rgba(0,0,0,0.55)' }}>表示期間: {weekLabel}</p>

        <div
          id={tablistId}
          role="tablist"
          aria-label="スケジュール表示切替タブ"
          style={{ display: 'flex', gap: 8, marginBottom: 12 }}
        >
          {(Object.keys(TAB_LABELS) as ScheduleTab[]).map((key) => (
            <button
              key={key}
              id={tabButtonIds[key]}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              data-testid={`tab-${key}`}
              onClick={() => setTab(key)}
              style={tabButtonStyle(tab === key)}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div>
        {isLoading ? (
          <div aria-busy="true" aria-live="polite" style={{ display: 'grid', gap: 12 }}>
            <Loading />
            <div style={skeletonStyle} />
            <div style={skeletonStyle} />
            <div style={skeletonStyle} />
          </div>
        ) : items.length > 0 ? (
          <>
            <div
              id="panel-week"
              role="tabpanel"
              aria-labelledby={tabButtonIds.week}
              hidden={tab !== 'week'}
            >
              <WeekView />
            </div>
            <div
              id="panel-day"
              role="tabpanel"
              aria-labelledby={tabButtonIds.day}
              hidden={tab !== 'day'}
            >
              <DayView />
            </div>
            <div
              id="panel-timeline"
              role="tabpanel"
              aria-labelledby={tabButtonIds.timeline}
              hidden={tab !== 'timeline'}
            >
              <TimelineDay />
            </div>
          </>
        ) : (
          <EmptyState
            title="今週の予定はありません"
            description="別の日付や条件で再度お試しください。"
            data-testid="schedule-empty"
          />
        )}
      </div>
    </section>
  );
}

const tabButtonStyle = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.12)',
  background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
  fontWeight: active ? 700 : 500,
  color: active ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.7)',
});

const skeletonStyle: CSSProperties = {
  height: 16,
  borderRadius: 8,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.1) 37%, rgba(0,0,0,0.06) 63%)',
  animation: 'shine 1.4s ease infinite',
};

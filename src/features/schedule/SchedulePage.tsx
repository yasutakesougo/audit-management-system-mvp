import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import FilterToolbar from '@/ui/filters/FilterToolbar';
import { formatRangeLocal } from '@/utils/datetime';
import { cn } from '@/utils/cn';
import UserTab from '@/features/schedule/views/UserTab';
import OrgTab from '@/features/schedule/views/OrgTab';
import StaffTab from '@/features/schedule/views/StaffTab';
import BriefingPanel from '@/features/schedule/components/BriefingPanel';
import TimelineWeek, { type EventMovePayload } from '@/features/schedule/views/TimelineWeek';
import TimelineDay from '@/features/schedule/views/TimelineDay';
import ScheduleListView from '@/features/schedule/views/ListView';
import type { Schedule } from '@/features/schedule/types';
import { useSP } from '@/lib/spClient';
import { assignLocalDateKey } from '@/features/schedule/dateutils.local';
import { moveScheduleToDay } from '@/features/schedule/move';
import { getUserCareSchedules } from './spClient.schedule';
import { getOrgSchedules } from './spClient.schedule.org';
import { getStaffSchedules } from './spClient.schedule.staff';
import { useEnsureScheduleList } from './ensureScheduleList';
import { useStaff } from '@/stores/useStaff';
import { buildStaffPatternIndex, collectBaseShiftWarnings } from './workPattern';

type ViewMode = 'week' | 'day' | 'list' | 'userCare';

type RangeState = {
  start: Date;
  end: Date;
};

export default function SchedulePage() {
  const sp = useSP();
  useEnsureScheduleList(sp);
  const { data: staffData } = useStaff();
  const [view, setView] = useState<ViewMode>('week');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<RangeState>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  });
  const [timelineEvents, setTimelineEvents] = useState<Schedule[]>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
  const [timelineError, setTimelineError] = useState<Error | null>(null);

  const staffPatterns = useMemo(() => buildStaffPatternIndex(staffData), [staffData]);

  const annotatedTimelineEvents = useMemo(() => {
    if (!staffPatterns) {
      return timelineEvents;
    }
    return timelineEvents.map((event) => {
      const warnings = collectBaseShiftWarnings(event, staffPatterns);
      return warnings.length ? { ...event, baseShiftWarnings: warnings } : event;
    });
  }, [timelineEvents, staffPatterns]);

  const rangeLabel = useMemo(() => {
    return formatRangeLocal(range.start.toISOString(), range.end.toISOString());
  }, [range.end, range.start]);
  const loadTimeline = useCallback(async () => {
    const startIso = range.start.toISOString();
    const endIso = range.end.toISOString();
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const [userRows, orgRows, staffRows] = await Promise.all([
        getUserCareSchedules(sp, { start: startIso, end: endIso }),
        getOrgSchedules(sp, { start: startIso, end: endIso }),
        getStaffSchedules(sp, { start: startIso, end: endIso }),
      ]);
      const combined: Schedule[] = [...userRows, ...orgRows, ...staffRows]
        .map((event) => assignLocalDateKey({ ...event }))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      setTimelineEvents(combined);
    } catch (cause) {
      const err = cause instanceof Error ? cause : new Error('予定の取得に失敗しました');
      setTimelineError(err);
    } finally {
      setTimelineLoading(false);
    }
  }, [range.end, range.start, sp]);

  useEffect(() => {
    loadTimeline().catch(() => {
      /* handled via state */
    });
  }, [loadTimeline]);

  const dayViewDate = useMemo(() => new Date(range.start.getTime()), [range.start]);

  const handleEventMove = useCallback(({ id, to }: EventMovePayload) => {
    setTimelineEvents((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) {
        return prev;
      }
      const original = prev[index];
      if (original.category !== to.category) {
        return prev;
      }
      const updated = moveScheduleToDay(original, to.dayKey);
      const next = [...prev];
      next.splice(index, 1, updated);
      next.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-semibold text-gray-900">スケジュール</h1>
        <p className="text-sm text-gray-600">{rangeLabel || '期間未設定'}</p>
      </div>

      <div className="px-4">
        <FilterToolbar
          toolbarLabel="スケジュールの検索とフィルタ"
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="予定名、メモ、担当など"
          scope="schedule"
          extraControls={(
            <div className="flex items-center gap-1">
              {view !== 'userCare' ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    setRange((prev) => {
                      const span = prev.end.getTime() - prev.start.getTime();
                      const nextStart = new Date(prev.start.getTime() + span);
                      const nextEnd = new Date(prev.end.getTime() + span);
                      return { start: nextStart, end: nextEnd };
                    })
                  }
                  type="button"
                >
                  期間を進める
                </Button>
              ) : null}
              <nav aria-label="ビュー切替" className="flex items-center gap-1">
                {(['week', 'day', 'list', 'userCare'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      'rounded-md border px-3 py-1 text-sm transition',
                      view === mode
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                    )}
                    onClick={() => setView(mode)}
                    aria-pressed={view === mode}
                  >
                    {mode === 'week'
                      ? '週'
                      : mode === 'day'
                        ? '日'
                        : mode === 'list'
                          ? 'リスト'
                          : '利用者'}
                  </button>
                ))}
              </nav>
            </div>
          )}
        />
      </div>

      <section className="p-4" role="region" aria-labelledby="schedule-view-heading">
        <h2 id="schedule-view-heading" className="sr-only">
          スケジュールビュー
        </h2>
        {timelineError ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {timelineError.message}
          </div>
        ) : null}
        {view === 'week' && (
          <TimelineWeek events={annotatedTimelineEvents} startDate={range.start} onEventMove={handleEventMove} />
        )}
        {view === 'day' && <TimelineDay events={annotatedTimelineEvents} date={dayViewDate} />}
        {view === 'list' && <ScheduleListView />}
        {view === 'userCare' && (
          <section className="space-y-6">
            <BriefingPanel />
            <UserTab />
            <OrgTab />
            <StaffTab />
          </section>
        )}
        {timelineLoading && (
          <div className="mt-4 text-sm text-gray-500" aria-live="polite">
            予定を読み込んでいます…
          </div>
        )}
      </section>
    </div>
  );
}

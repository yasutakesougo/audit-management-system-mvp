import { useCallback, useEffect, useMemo, useState } from 'react';
// import { startOfWeek } from 'date-fns';
import { assignLocalDateKey } from '@/features/schedule/dateutils.local';
import { getAppConfig } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { useStaff } from '@/stores/useStaff';
import { getUserCareSchedules } from '../spClient.schedule';
import { getOrgSchedules } from '../spClient.schedule.org';
import { getStaffSchedules } from '../spClient.schedule.staff';
import type { Schedule } from '../types';
import { buildStaffPatternIndex, collectBaseShiftWarnings } from '../workPattern';

export function useTimelineDaySchedules(date: Date) {
  const sp = useSP();
  const { data: staffDataRaw } = useStaff();
  const staffPatterns = useMemo(() => buildStaffPatternIndex(staffDataRaw ?? []), [staffDataRaw]);
  const [timelineEvents, setTimelineEvents] = useState<Schedule[]>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
  const [timelineError, setTimelineError] = useState<Error | null>(null);
  const dayKey = date.getTime();

  const annotatedTimelineEvents = useMemo(() => {
    if (!staffPatterns) {
      return timelineEvents;
    }
    return timelineEvents.map((event) => {
      const warnings = collectBaseShiftWarnings(event, staffPatterns);
      return warnings.length ? { ...event, baseShiftWarnings: warnings } : event;
    });
  }, [timelineEvents, staffPatterns]);


  const fetchTimeline = useCallback(async () => {
    const start = new Date(dayKey);
    const end = new Date(dayKey + 24 * 60 * 60 * 1000);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    setTimelineLoading(true);
    setTimelineError(null);
    const { isDev: isDevelopment } = getAppConfig();
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
      if (isDevelopment) {
        setTimelineEvents([]);
        setTimelineError(null);
      } else {
        setTimelineError(err);
      }
    } finally {
      setTimelineLoading(false);
    }
  }, [dayKey, sp]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return {
    events: annotatedTimelineEvents,
    loading: timelineLoading,
    error: timelineError,
    reload: fetchTimeline,
  };
}

import { useState, useCallback, useEffect } from 'react';
import { useUsers } from '@/features/users/useUsers';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { isDemoModeEnabled } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { DAILY_ATTENDANCE_LIST_TITLE } from '@/sharepoint/fields/dailyAttendanceFields';
import { HOLIDAY_MASTER_LIST_TITLE } from '@/sharepoint/fields/holidayFields';
import { HOLIDAYS } from '@/sharepoint/holidays';
import { mockMonthlySummaries } from '../monthlyRecordSeedData';
import { executeKioskMonthlyAggregation } from '../kioskMonthlyAggregationUseCase';
import { convertJapaneseWeekdaysToNumbers } from '../utils/weekdayConverter';
import { getTotalDaysInMonth } from '../aggregate';
import type { MonthlySummary, YearMonth } from '../types';

/**
 * Hook to fetch and aggregate monthly summaries for all active users.
 * Supports both demo (mock) and production (SharePoint) data sources.
 */
export function useMonthlySummaries(yearMonth: YearMonth) {
  const { users, isLoading: loadingUsers } = useUsers();
  const repository = useExecutionData();
  const { listItems } = useSP();
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // 1. Handle Demo Mode
    if (isDemoModeEnabled()) {
      // Filter mocks by yearMonth if needed, but for now we just return them
      // as they are primarily for UI demonstration.
      setSummaries(mockMonthlySummaries);
      setLoading(false);
      return;
    }

    // 2. Handle Production Mode (requires repository and users)
    if (loadingUsers) return;
    
    if (!repository) {
      setError('Repository not initialized');
      setLoading(false);
      return;
    }

    if (users.length === 0) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const totalDays = getTotalDaysInMonth(yearMonth);
      const from = `${yearMonth}-01`;
      const to = `${yearMonth}-${totalDays}`;

      // A. Fetch Absences for all users in one batch
      // Use the internal names defined in the registry (UserID, Date, Status)
      const absenceRows = await listItems<any>(DAILY_ATTENDANCE_LIST_TITLE, {
        select: ['UserID', 'UserCode', 'Date', 'RecordDate', 'Status'],
        filter: `(Date ge '${from}T00:00:00Z' and Date le '${to}T23:59:59Z') or (RecordDate ge '${from}T00:00:00Z' and RecordDate le '${to}T23:59:59Z')`,
        top: 2000,
      }).catch((err) => {
        console.warn('[useMonthlySummaries] Absence fetch failed, continuing without absences:', err);
        return [];
      });

      // Group absences by userId (normalized to UserID or UserCode)
      const absencesByUserId: Record<string, string[]> = {};
      absenceRows.forEach((row) => {
        const status = row.Status || '';
        const isAbsent = ['欠席', '当日欠席', 'absent'].includes(status);
        if (!isAbsent) return;

        const uid = row.UserID || row.UserCode;
        if (!uid) return;
        if (!absencesByUserId[uid]) absencesByUserId[uid] = [];
        // Extract YYYY-MM-DD from Date or RecordDate
        const datePart = (row.Date || row.RecordDate)?.split('T')[0];
        if (datePart) absencesByUserId[uid].push(datePart);
      });

      // B. Fetch Dynamic Holidays (Optional, fallback to static HOLIDAYS)
      const holidayRows = await listItems<any>(HOLIDAY_MASTER_LIST_TITLE, {
        select: ['Date'],
        filter: `Date ge '${from}T00:00:00Z' and Date le '${to}T23:59:59Z'`,
      }).catch(() => []);

      const dynamicHolidayDates = holidayRows.map(h => h.Date?.split('T')[0]).filter(Boolean);
      const staticHolidayDates = Object.keys(HOLIDAYS).filter(d => d.startsWith(yearMonth));
      const holidays = Array.from(new Set([...staticHolidayDates, ...dynamicHolidayDates]));

      // C. Aggregate data for each user in parallel
      const results = await Promise.all(
        users.map((user) => {
          const userAbsences = absencesByUserId[user.UserID] || [];
          const contractWeekdays = user.AttendanceDays 
            ? convertJapaneseWeekdaysToNumbers(user.AttendanceDays)
            : undefined;

          return executeKioskMonthlyAggregation(repository, {
            userId: user.UserID,
            displayName: user.FullName,
            yearMonth,
            contractWeekdays,
            holidays,
            absences: userAbsences,
            useWorkingDays: true,
          });
        })
      );
      
      setSummaries(results.map((r) => r.summary));
      setError(null);
    } catch (err) {
      console.error('[useMonthlySummaries] Aggregation failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repository, users, yearMonth, loadingUsers, listItems]);

  // Initial load and re-fetch when month changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    summaries,
    loading: loading || loadingUsers,
    error,
    refresh,
    isDemo: isDemoModeEnabled()
  };
}

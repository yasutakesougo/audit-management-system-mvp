import { useDailyRecordRepository } from '@/features/daily/repositories/repositoryFactory';
import { useUserRepository } from '@/features/users/repositoryFactory';
import type { IUserMaster } from '@/features/users/types';
import { getAppConfig, readEnv } from '@/lib/env';
import {
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    parseISO,
    startOfMonth
} from 'date-fns';
import { useCallback, useState } from 'react';
import type { AchievementRecordRow } from './AchievementRecordPDF';

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

export const resolveAchievementFacilityInfo = () => ({
  facilityName: getAppConfig().facilityName.trim(),
  facilityNumber: readEnv('VITE_FACILITY_NUMBER', '').trim(),
});

/**
 * Hook to prepare data for the Service Provision Achievement Record (PDF)
 */
export function useAchievementPDF() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRepository = useUserRepository();
  const dailyRepository = useDailyRecordRepository();

  /**
   * Fetch data and prepare for PDF rendering
   */
  const prepareData = useCallback(async (userId: string, targetMonth: string) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch User Data
      const users: IUserMaster[] = await userRepository.getAll();
      const user = users.find((u: IUserMaster) => u.UserID === userId);

      if (!user) {
        throw new Error('利用者が見つかりませんでした。');
      }

      const facility = resolveAchievementFacilityInfo();

      // 2. Fetch Daily Records for the month
      const start = startOfMonth(parseISO(`${targetMonth}-01`));
      const end = endOfMonth(start);

      const records = await dailyRepository.list({
        range: {
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        }
      });

      // 3. Map to AchievementRecordRow[]
      const interval = eachDayOfInterval({ start, end });
      const rows: AchievementRecordRow[] = interval.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        // DailyRecordItem is structured as TableDailyRecordData which has userRows
        // We need to find the specific user row in the daily records
        const record = records.find(r => r.date === dateStr);
        const userRow = record?.userRows.find(ur => ur.userId === userId);

        const hasContent = userRow && (
          userRow.amActivity.trim() ||
          userRow.pmActivity.trim() ||
          userRow.specialNotes.trim()
        );

        return {
          date: format(date, 'd'),
          dayOfWeek: DAYS_JP[getDay(date)],
          status: hasContent ? '通所' : '-',
          serviceType: user.severeFlag ? '重度' : '通常',
          startTime: null,
          endTime: null,
          notes: userRow?.specialNotes || '',
        };
      });

      setLoading(false);
      return {
        month: targetMonth,
        userName: user.FullName,
        userCertNumber: user.RecipientCertNumber || '',
        facilityName: facility.facilityName,
        facilityNumber: facility.facilityNumber,
        rows,
      };
    } catch (err) {
      console.error('Failed to prepare achievement PDF data:', err);
      setError(err instanceof Error ? err.message : 'データの準備に失敗しました。');
      setLoading(false);
      return null;
    }
  }, [userRepository, dailyRepository]);

  return { prepareData, loading, error };
}

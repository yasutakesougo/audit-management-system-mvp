/**
 * useAttendanceCounts — 指定日の出席カウントを取得するカスタムフック
 *
 * DashboardPage からの抽出。出勤・外出・欠席・合計の集計を返す。
 */

import { useEffect, useState } from 'react';

import type { AttendanceCounts } from './port';
import { getStaffAttendancePort } from './storage';

export const useAttendanceCounts = (recordDate: string): AttendanceCounts => {
  const [counts, setCounts] = useState<AttendanceCounts>({
    onDuty: 0,
    out: 0,
    absent: 0,
    total: 0,
  });

  useEffect(() => {
    let active = true;

    (async () => {
      const port = getStaffAttendancePort();
      const res = await port.countByDate(recordDate);
      if (!active) return;

      if (res.isOk) {
        setCounts(res.value);
      } else {
        console.warn('[attendance] countByDate failed', res.error);
        setCounts({ onDuty: 0, out: 0, absent: 0, total: 0 });
      }
    })();

    return () => {
      active = false;
    };
  }, [recordDate]);

  return counts;
};

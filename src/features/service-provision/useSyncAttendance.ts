/**
 * useSyncAttendance — 通園データ → サービス提供実績 同期 Hook
 *
 * 通園管理（AttendanceRepository）のデータを読み取り、
 * サービス提供実績（ServiceProvisionRepository）に upsert する。
 */
import { useCallback, useState } from 'react';

import { useAttendanceRepository } from '@/features/attendance/repositoryFactory';
import type { UpsertProvisionInput } from './domain/types';
import { useServiceProvisionRepository } from './repositoryFactory';

export type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

export interface UseSyncAttendanceReturn {
  syncStatus: SyncStatus;
  syncedCount: number;
  syncError: string | null;
  /** 指定日の通園データを同期 */
  syncDate: (dateISO: string) => Promise<number>;
  /** 指定月の全日を同期 */
  syncMonth: (yearMonth: string) => Promise<number>;
}

export function useSyncAttendance(): UseSyncAttendanceReturn {
  const attendanceRepo = useAttendanceRepository();
  const provisionRepo = useServiceProvisionRepository();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncedCount, setSyncedCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncDate = useCallback(async (dateISO: string): Promise<number> => {
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      // 通園データ取得
      const attendanceRows = await attendanceRepo.getDailyByDate({ recordDate: dateISO });

      // AttendanceDailyItem → AttendanceRowVM 相当の変換は不要
      // getDailyByDate は生のSPアイテムを返すので、直接マッピング
      const inputs: UpsertProvisionInput[] = [];

      for (const item of attendanceRows) {
        const status = item.Status as string;
        if (!status || status === '未') continue;

        const isPresent = status === '通所中' || status === '退所済';
        const isAbsent = status === '当日欠席';
        if (!isPresent && !isAbsent) continue;

        const startHHMM = isPresent ? isoToHHMM(item.CheckInAt ?? undefined) : null;
        const endHHMM = isPresent ? isoToHHMM(item.CheckOutAt ?? undefined) : null;

        inputs.push({
          userCode: item.UserCode,
          recordDateISO: dateISO,
          status: isPresent ? '提供' : '欠席',
          startHHMM,
          endHHMM,
          hasTransport: Boolean(item.TransportTo) || Boolean(item.TransportFrom),
          hasTransportPickup: Boolean(item.TransportTo),
          hasTransportDropoff: Boolean(item.TransportFrom),
          hasAbsentSupport: isAbsent ? Boolean(item.IsAbsenceAddonClaimable) : false,
          note: isAbsent && item.EveningNote ? String(item.EveningNote) : undefined,
          source: 'Attendance',
        });
      }

      // 一括 upsert
      let count = 0;
      for (const input of inputs) {
        await provisionRepo.upsertByEntryKey(input);
        count++;
      }

      setSyncedCount(count);
      setSyncStatus('done');
      return count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncError(msg);
      setSyncStatus('error');
      return 0;
    }
  }, [attendanceRepo, provisionRepo]);

  const syncMonth = useCallback(async (yearMonth: string): Promise<number> => {
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const [y, m] = yearMonth.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      let totalCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateISO = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const count = await syncDate(dateISO);
        totalCount += count;
      }

      setSyncedCount(totalCount);
      setSyncStatus('done');
      return totalCount;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncError(msg);
      setSyncStatus('error');
      return 0;
    }
  }, [syncDate]);

  return { syncStatus, syncedCount, syncError, syncDate, syncMonth };
}

// ── ヘルパー ────────────────────────────────────────────
function isoToHHMM(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const jstH = (d.getUTCHours() + 9) % 24;
  const jstM = d.getUTCMinutes();
  return jstH * 100 + jstM;
}

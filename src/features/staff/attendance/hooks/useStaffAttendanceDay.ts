import { useCallback, useEffect, useState } from 'react';
import { getStaffAttendancePort, getStaffAttendanceStorageKind } from '../storage';
import type { StaffAttendance } from '../types';

/**
 * Classify ResultError.kind → user-facing message (ja)
 */
const classifyError = (error: { kind: string; message?: string }): string => {
  switch (error.kind) {
    case 'forbidden':
      return error.message || 'アクセス権限がありません。管理者に連絡してください。';
    case 'not_found':
      return error.message || 'データが見つかりません。';
    case 'validation':
      return error.message || '入力データに問題があります。';
    case 'network':
      return error.message || 'ネットワーク接続に問題があります。再試行してください。';
    default:
      return error.message || '予期しないエラーが発生しました。';
  }
};

export type UseStaffAttendanceDayReturn = {
  items: StaffAttendance[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  storageKind: string;
};

/**
 * Read-only hook: fetch staff attendance records for a given date.
 *
 * Uses `getStaffAttendancePort().listByDate()` — the storage factory
 * delegates to local or SharePoint adapter based on
 * `VITE_STAFF_ATTENDANCE_STORAGE` env var.
 *
 * This hook does NOT call any write operations (upsert / remove / finalize).
 */
export function useStaffAttendanceDay(date: string): UseStaffAttendanceDayReturn {
  const storageKind = getStaffAttendanceStorageKind();
  const [items, setItems] = useState<StaffAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const port = getStaffAttendancePort();
      const res = await port.listByDate(date);

      if (res.isOk) {
        setItems(res.value);
      } else {
        setItems([]);
        setError(classifyError(res.error));
      }
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : '予期しないエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    items,
    isLoading,
    error,
    reload: fetchData,
    storageKind,
  };
}

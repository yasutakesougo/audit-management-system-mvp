/**
 * useStaffAttendanceWrite
 *
 * Read + Write façade for staff attendance.
 * - Read side: port.listByDate() (same pattern as useStaffAttendanceDay)
 * - Write side: port.upsert() → auto-reload
 *
 * UI は port を直接触らず、この hook 経由で全 CRUD を行う。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { StaffAttendancePort } from '../port';
import { getStaffAttendancePort, getStaffAttendanceStorageKind, getStaffAttendanceWriteEnabled } from '../storage';
import type { StaffAttendance } from '../types';

export type UseStaffAttendanceWriteReturn = {
  items: StaffAttendance[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  storageKind: string;

  saving: boolean;
  upsertOne: (next: StaffAttendance) => Promise<void>;

  writeEnabled: boolean;
  readOnlyReason: string | null;

  /** Port instance — useStaffAttendanceBulk が直接必要とする */
  port: StaffAttendancePort;
};

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

export function useStaffAttendanceWrite(date: string): UseStaffAttendanceWriteReturn {
  const storageKind = getStaffAttendanceStorageKind();
  const port = useMemo(() => getStaffAttendancePort(), []);

  const writeEnabled = useMemo(() => getStaffAttendanceWriteEnabled(), []);
  const readOnlyReason = useMemo(() => {
    if (writeEnabled) return null;
    return '書き込みが無効です（環境設定 / 権限 / 機能フラグをご確認ください）';
  }, [writeEnabled]);

  // ── Read state ──
  const [items, setItems] = useState<StaffAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
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
  }, [date, port]);

  // 初回 + date 変更時に自動取得
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Saving state ──
  const inflight = useRef(0);
  const [saving, setSaving] = useState(false);

  const bumpSaving = useCallback((delta: 1 | -1) => {
    inflight.current += delta;
    setSaving(inflight.current > 0);
  }, []);

  // ── Write ──
  const upsertOne = useCallback(
    async (next: StaffAttendance) => {
      if (!writeEnabled) return;

      bumpSaving(1);
      try {
        const res = await port.upsert(next);
        if (!res.isOk) {
          setError(classifyError(res.error));
          return;
        }
        // 書き込み成功 → 再取得
        await fetchData();
      } catch (e) {
        setError(e instanceof Error ? e.message : '保存中にエラーが発生しました。');
      } finally {
        bumpSaving(-1);
      }
    },
    [bumpSaving, fetchData, port, writeEnabled],
  );

  return {
    items,
    isLoading,
    error,
    reload: fetchData,
    storageKind,

    saving,
    upsertOne,

    writeEnabled,
    readOnlyReason,

    port,
  };
}

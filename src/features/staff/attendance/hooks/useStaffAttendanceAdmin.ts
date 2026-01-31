import * as React from 'react';
import { useAuth } from '@/auth/useAuth';
import { toSafeError } from '@/lib/errors';
import { skipSharePoint } from '@/lib/env';
import { ensureConfig } from '@/lib/spClient';
import { result } from '@/shared/result';
import { createSharePointStaffAttendanceAdapter } from '../adapters';
import type { StaffAttendancePort } from '../port';
import { getStaffAttendancePort, getStaffAttendanceStorageKind, getStaffAttendanceWriteEnabled } from '../storage';
import type { StaffAttendance } from '../types';

type State = {
  items: StaffAttendance[];
  loading: boolean;
  error: string | null;
  saving: boolean;
};

const createBlockedPort = (message: string): StaffAttendancePort => ({
  upsert: async () => result.forbidden(message),
  remove: async () => result.forbidden(message),
  getByKey: async () => result.forbidden(message),
  listByDate: async () => result.forbidden(message),
  countByDate: async () => result.forbidden(message),
});

export function useStaffAttendanceAdmin(recordDate: string) {
  const storageKind = React.useMemo(() => getStaffAttendanceStorageKind(), []);
  const writeEnabledEnv = React.useMemo(() => getStaffAttendanceWriteEnabled(), []);
  const { acquireToken } = useAuth();
  const [readOnlyReason, setReadOnlyReason] = React.useState<string | null>(null);
  const [spReady, setSpReady] = React.useState<boolean>(storageKind !== 'sharepoint');
  const [state, setState] = React.useState<State>({
    items: [],
    loading: false,
    error: null,
    saving: false,
  });

  React.useEffect(() => {
    if (storageKind !== 'sharepoint') {
      setSpReady(true);
      setReadOnlyReason(null);
      return;
    }

    if (skipSharePoint()) {
      setSpReady(false);
      setReadOnlyReason('SharePoint が設定で無効化されています。');
      return;
    }

    try {
      const { baseUrl } = ensureConfig();
      if (!baseUrl) {
        setSpReady(false);
        setReadOnlyReason('SharePoint 接続が無効です（デモ/スキップ設定）。');
        return;
      }
      setSpReady(true);
      setReadOnlyReason(null);
    } catch (err) {
      const safe = toSafeError(err);
      setSpReady(false);
      setReadOnlyReason(safe.message || 'SharePoint 接続設定が未完了です。');
    }
  }, [storageKind]);

  const port = React.useMemo(() => {
    if (storageKind !== 'sharepoint') return getStaffAttendancePort();
    if (!spReady) return createBlockedPort(readOnlyReason ?? 'SharePoint 接続が無効です。');
    return createSharePointStaffAttendanceAdapter({ acquireToken });
  }, [acquireToken, readOnlyReason, spReady, storageKind]);

  const effectiveReadOnlyReason = readOnlyReason ?? (!writeEnabledEnv ? '書き込みが無効です（設定）。' : null);
  const writeEnabled = writeEnabledEnv && !readOnlyReason;
  const readOnly = !writeEnabled;

  const refetch = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await port.listByDate(recordDate);
    if (res.isOk) {
      setState((s) => ({ ...s, items: res.value, loading: false }));
      return;
    }

    if (res.error.kind === 'forbidden') {
      const message = res.error.message || 'SharePoint にアクセスできません（権限不足）。';
      setReadOnlyReason(message);
      setState((s) => ({ ...s, loading: false, error: null }));
      return;
    }

    setState((s) => ({
      ...s,
      loading: false,
      error: res.error.message || res.error.kind || 'unknown',
    }));
  }, [port, recordDate]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = React.useCallback(
    async (next: StaffAttendance) => {
      if (!writeEnabled) {
        setState((s) => ({
          ...s,
          saving: false,
          error: effectiveReadOnlyReason ?? '書き込みが無効です（読み取り専用）。',
        }));
        return;
      }

      setState((s) => ({ ...s, saving: true, error: null }));
      const res = await port.upsert(next);
      if (!res.isOk) {
        if (res.error.kind === 'forbidden') {
          const message = res.error.message || 'SharePoint にアクセスできません（権限不足）。';
          setReadOnlyReason(message);
          setState((s) => ({ ...s, saving: false, error: null }));
          return;
        }
        setState((s) => ({
          ...s,
          saving: false,
          error: res.error.message || res.error.kind || 'unknown',
        }));
        return;
      }
      // 安定最優先：再取得
      await refetch();
      setState((s) => ({ ...s, saving: false }));
    },
    [port, refetch, writeEnabled]
  );

  return {
    ...state,
    writeEnabled,
    canWrite: writeEnabled,
    readOnly,
    readOnlyReason: effectiveReadOnlyReason,
    isSharePointReady: spReady,
    refetch,
    save,
    // ✅ Bulk 用に公開（挙動は変えない）
    port,
    recordDate,
    storageKind,
  };
}

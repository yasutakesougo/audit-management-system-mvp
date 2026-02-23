import * as React from 'react';
import { useAuth } from '@/auth/useAuth';
import { skipSharePoint } from '@/lib/env';
import { result } from '@/shared/result';
import { createSharePointStaffAttendanceAdapter } from '../adapters';
import type { StaffAttendancePort } from '../port';
import { preflightStaffAttendanceList, resolveStaffAttendanceListTitle } from '../preflight';
import { getStaffAttendancePort, getStaffAttendanceStorageKind, getStaffAttendanceWriteEnabled } from '../storage';
import type { StaffAttendance } from '../types';

type State = {
  items: StaffAttendance[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  listItems?: StaffAttendance[] | undefined;
  listLoading?: boolean;
  listError?: string | null;
  listDateRange?: { from: string; to: string };
};

type SpCheckState = 'idle' | 'checking' | 'connected' | 'blocked';

const createBlockedPort = (message: string): StaffAttendancePort => ({
  upsert: async () => result.forbidden(message),
  remove: async () => result.forbidden(message),
  getByKey: async () => result.forbidden(message),
  listByDate: async () => result.forbidden(message),
  listByDateRange: async () => result.forbidden(message),
  countByDate: async () => result.forbidden(message),
  finalizeDay: async () => result.forbidden(message),
  unfinalizeDay: async () => result.forbidden(message),
  getDayFinalizedState: async () => result.forbidden(message),
});

export function useStaffAttendanceAdmin(recordDate: string) {
  const storageKind = React.useMemo(() => getStaffAttendanceStorageKind(), []);
  const writeEnabledEnv = React.useMemo(() => getStaffAttendanceWriteEnabled(), []);
  const { acquireToken, account } = useAuth();
  const [readOnlyReason, setReadOnlyReason] = React.useState<string | null>(null);
  const [spReady, setSpReady] = React.useState<boolean>(storageKind !== 'sharepoint');
  const [spCheckState, setSpCheckState] = React.useState<SpCheckState>(storageKind !== 'sharepoint' ? 'connected' : 'idle');
  const listTitle = React.useMemo(() => resolveStaffAttendanceListTitle(), []);
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
      setSpCheckState('blocked');
      setReadOnlyReason('SharePoint が設定で無効化されています。');
      return;
    }

    setSpReady(false);
    setSpCheckState('checking');
    setReadOnlyReason(null);
  }, [storageKind]);

  React.useEffect(() => {
    if (storageKind !== 'sharepoint') return;
    if (skipSharePoint()) return;
    if (spCheckState !== 'checking') return;

    let alive = true;

    const run = async () => {
      const result = await preflightStaffAttendanceList({ acquireToken, listTitle });
      if (!alive) return;

      if (result.status === 'connected') {
        setSpReady(true);
        setSpCheckState('connected');
        setReadOnlyReason(null);
        return;
      }

      setSpReady(false);
      setSpCheckState('blocked');
      setReadOnlyReason(result.reason);
    };

    void run();

    return () => {
      alive = false;
    };
  }, [acquireToken, listTitle, spCheckState, storageKind]);

  const port = React.useMemo(() => {
    if (storageKind !== 'sharepoint') return getStaffAttendancePort();
    if (!spReady) return createBlockedPort(readOnlyReason ?? 'SharePoint 接続が無効です。');
    return createSharePointStaffAttendanceAdapter({ acquireToken });
  }, [acquireToken, readOnlyReason, spReady, storageKind]);

  const effectiveReadOnlyReason = readOnlyReason ?? (!writeEnabledEnv ? '書き込みが無効です（設定）。' : null);
  const writeEnabled = writeEnabledEnv && !readOnlyReason;
  const readOnly = !writeEnabled;
  const connectionStatus = storageKind !== 'sharepoint'
    ? 'local'
    : (effectiveReadOnlyReason ? 'readonly' : (spCheckState === 'checking' ? 'checking' : 'connected'));
  const connectionLabel = storageKind !== 'sharepoint'
    ? 'Connected: Local'
    : (effectiveReadOnlyReason
      ? `Read-only: ${effectiveReadOnlyReason}`
      : (spCheckState === 'checking' ? 'Connecting: SharePoint' : 'Connected: SharePoint'));

  const refetch = React.useCallback(async () => {
    if (storageKind === 'sharepoint' && !spReady) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
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
  }, [port, recordDate, spReady, storageKind]);

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
    [effectiveReadOnlyReason, port, refetch, writeEnabled]
  );

  const fetchListByDateRange = React.useCallback(
    async (from: string, to: string) => {
      if (storageKind === 'sharepoint' && !spReady) {
        setState((s) => ({ ...s, listLoading: false, listError: readOnlyReason ?? '接続不可' }));
        return [];
      }

      setState((s) => ({ ...s, listLoading: true, listError: null, listDateRange: { from, to } }));

      // listByDateRange メソッドが存在するか確認して呼び出し
      const portWithRange = port as unknown as Record<string, unknown>;
      if (typeof portWithRange.listByDateRange !== 'function') {
        setState((s) => ({ ...s, listLoading: false, listError: 'List query not supported' }));
        return [];
      }

      const res = await (portWithRange.listByDateRange as (from: string, to: string) => Promise<{ isOk: boolean; value?: StaffAttendance[]; error?: { kind: string; message: string } }>)(from, to);
      if (res.isOk) {
        setState((s) => ({ ...s, listItems: res.value ?? [], listLoading: false }));
        return res.value ?? [];
      }

      if (res.error && res.error.kind === 'forbidden') {
        const message = res.error.message || 'SharePoint にアクセスできません（権限不足）。';
        setReadOnlyReason(message);
        setState((s) => ({ ...s, listLoading: false, listError: null }));
        return [];
      }

      setState((s) => ({
        ...s,
        listLoading: false,
        listError: res.error?.message || res.error?.kind || 'unknown',
      }));
      return [];
    },
    [port, spReady, readOnlyReason, storageKind]
  );

  const finalizeDay = React.useCallback(async () => {
    if (!writeEnabled) {
      setState((s) => ({
        ...s,
        saving: false,
        error: effectiveReadOnlyReason ?? '書き込みが無効です（読み取り専用）。',
      }));
      return;
    }
    setState((s) => ({ ...s, saving: true, error: null }));
    const actor = account?.username?.trim() || account?.homeAccountId?.trim() || 'unknown';
    const res = await port.finalizeDay({ recordDate, finalizedBy: actor });
    if (!res.isOk) {
      setState((s) => ({
        ...s,
        saving: false,
        error: res.error.message || res.error.kind || 'unknown',
      }));
      return;
    }
    await refetch();
    setState((s) => ({ ...s, saving: false }));
  }, [account?.homeAccountId, account?.username, effectiveReadOnlyReason, port, recordDate, refetch, writeEnabled]);

  const unfinalizeDay = React.useCallback(async () => {
    if (!writeEnabled) {
      setState((s) => ({
        ...s,
        saving: false,
        error: effectiveReadOnlyReason ?? '書き込みが無効です（読み取り専用）。',
      }));
      return;
    }
    setState((s) => ({ ...s, saving: true, error: null }));
    const res = await port.unfinalizeDay({ recordDate });
    if (!res.isOk) {
      setState((s) => ({
        ...s,
        saving: false,
        error: res.error.message || res.error.kind || 'unknown',
      }));
      return;
    }
    await refetch();
    setState((s) => ({ ...s, saving: false }));
  }, [effectiveReadOnlyReason, port, recordDate, refetch, writeEnabled]);

  return {
    ...state,
    writeEnabled,
    canWrite: writeEnabled,
    readOnly,
    readOnlyReason: effectiveReadOnlyReason,
    isSharePointReady: spReady,
    connectionStatus,
    connectionLabel,
    refetch,
    save,
    finalizeDay,
    unfinalizeDay,
    fetchListByDateRange,
    // ✅ Bulk 用に公開（挙動は変えない）
    port,
    recordDate,
    storageKind,
  };
}

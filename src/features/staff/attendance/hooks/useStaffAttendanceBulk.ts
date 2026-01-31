import * as React from 'react';
import type { StaffAttendance, StaffAttendanceStatus } from '../types';
import type { StaffAttendancePort } from '../port';

type BulkValue = {
  status: StaffAttendanceStatus;
  checkInAtHHmm: string; // "" OK
  note: string;          // "" => keep existing
};

type State = {
  bulkMode: boolean;
  selectedIds: Set<string>;
  drawerOpen: boolean;

  value: BulkValue;

  saving: boolean;
  error: string | null;
};

function toIsoFromDateAndHHmm(recordDate: string, hhmm: string): string | undefined {
  if (!hhmm) return undefined;
  // recordDate: "2026-01-31"
  // hhmm: "09:10"
  // ローカル日時として組み立て（ISOにするがTZは実装方針に合わせて後で統一可能）
  const iso = new Date(`${recordDate}T${hhmm}:00`).toISOString();
  return iso;
}

export function useStaffAttendanceBulk(args: {
  port: StaffAttendancePort;
  recordDate: string; // YYYY-MM-DD
  items: StaffAttendance[]; // その日の一覧（既存/空含む）
  refetch: () => Promise<void>;
  writeEnabled: boolean;
  readOnlyReason?: string | null;
}) {
  const { port, recordDate, items, refetch, writeEnabled, readOnlyReason } = args;

  const [state, setState] = React.useState<State>(() => ({
    bulkMode: false,
    selectedIds: new Set<string>(),
    drawerOpen: false,
    value: { status: '出勤', checkInAtHHmm: '', note: '' },
    saving: false,
    error: null,
  }));

  const toggleBulkMode = React.useCallback(() => {
    setState((s) => ({
      ...s,
      bulkMode: !s.bulkMode,
      selectedIds: new Set<string>(),
      drawerOpen: false,
      error: null,
    }));
  }, []);

  const toggleSelect = React.useCallback((staffId: string) => {
    setState((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return { ...s, selectedIds: next };
    });
  }, []);

  const openDrawer = React.useCallback(() => {
    setState((s) => ({ ...s, drawerOpen: true, error: null }));
  }, []);

  const closeDrawer = React.useCallback(() => {
    setState((s) => ({ ...s, drawerOpen: false, error: null }));
  }, []);

  const setValue = React.useCallback((next: State['value']) => {
    setState((s) => ({ ...s, value: next }));
  }, []);

  const selectedCount = state.selectedIds.size;

  const bulkSave = React.useCallback(async () => {
    if (state.selectedIds.size === 0) return;

    if (!writeEnabled) {
      setState((s) => ({
        ...s,
        error: readOnlyReason ?? '書き込みが無効です（読み取り専用）',
      }));
      return;
    }

    setState((s) => ({ ...s, saving: true, error: null }));

    const checkInAtIso = toIsoFromDateAndHHmm(recordDate, state.value.checkInAtHHmm);

    // 選択 staffId → 既存の行（あれば）をベースに "必須上書き" する
    const targets = items
      .filter((it) => state.selectedIds.has(it.staffId))
      .map((it) => {
        const next: StaffAttendance = {
          ...it,
          recordDate,
          status: state.value.status, // 必ず上書き
          checkInAt: checkInAtIso,    // 必ず上書き（undefined OK）
          // note は空なら維持
          note: state.value.note.trim() === '' ? it.note ?? '' : state.value.note,
        };
        return next;
      });

    const settled = await Promise.allSettled(targets.map((r) => port.upsert(r)));

    const failed = settled
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.status === 'fulfilled' && !s.value.isOk);

    if (failed.length > 0) {
      setState((s) => ({
        ...s,
        saving: false,
        error: `${failed.length}件の保存に失敗しました`,
      }));
      return;
    }

    // upsert 自体が throw したケース（想定外）も拾う
    const thrown = settled.filter((s) => s.status === 'rejected');
    if (thrown.length > 0) {
      setState((s) => ({
        ...s,
        saving: false,
        error: `${thrown.length}件の保存で例外が発生しました`,
      }));
      return;
    }

    await refetch();

    setState((s) => ({
      ...s,
      saving: false,
      drawerOpen: false,
      // 選択解除して戻す
      selectedIds: new Set<string>(),
      error: null,
    }));
  }, [items, port, recordDate, refetch, state.selectedIds, state.value, writeEnabled, readOnlyReason]);

  return {
    bulkMode: state.bulkMode,
    selectedIds: state.selectedIds,
    selectedCount,
    drawerOpen: state.drawerOpen,

    value: state.value,
    saving: state.saving,
    error: state.error,

    toggleBulkMode,
    toggleSelect,
    openDrawer,
    closeDrawer,
    setValue,
    bulkSave,
  };
}

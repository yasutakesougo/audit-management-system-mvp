import * as React from 'react';
import { getStaffAttendancePort } from '../storage';
import type { StaffAttendance } from '../types';

type State = {
  items: StaffAttendance[];
  loading: boolean;
  error: string | null;
  saving: boolean;
};

export function useStaffAttendanceAdmin(recordDate: string) {
  const port = React.useMemo(() => getStaffAttendancePort(), []);
  const [state, setState] = React.useState<State>({
    items: [],
    loading: false,
    error: null,
    saving: false,
  });

  const refetch = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await port.listByDate(recordDate);
    if (res.isOk) {
      setState((s) => ({ ...s, items: res.value, loading: false }));
    } else {
      setState((s) => ({
        ...s,
        loading: false,
        error: res.error.message || res.error.kind || 'unknown',
      }));
    }
  }, [port, recordDate]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = React.useCallback(
    async (next: StaffAttendance) => {
      setState((s) => ({ ...s, saving: true, error: null }));
      const res = await port.upsert(next);
      if (!res.isOk) {
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
    [port, refetch]
  );

  return {
    ...state,
    refetch,
    save,
    // ✅ Bulk 用に公開（挙動は変えない）
    port,
    recordDate,
  };
}

/**
 * useAlertActionState — Hook for managing alert action completion state
 *
 * Uses localStorage repository scoped to date + login user.
 * loginUserKey: account.username from MSAL (email), fallback 'anonymous'.
 *
 * @skill @observability-engineer — prevStatus tracking for event logging
 */
import { useAuth } from '@/auth/useAuth';
import { useCallback, useMemo, useState } from 'react';
import { createLocalStorageRepo } from './alertActions.storage';
import type { ActionStatus, AlertActionState } from './alertActions.types';

/** JST-safe local date (UTC toISOString is wrong during JST 00:00–08:59) */
function getLocalYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useAlertActionState() {
  const { account } = useAuth();
  const loginUserKey = account?.username ?? 'anonymous';
  const ymd = getLocalYmd();

  const repo = useMemo(
    () => createLocalStorageRepo(ymd, loginUserKey),
    [ymd, loginUserKey],
  );

  // Load initial state from localStorage
  const [states, setStates] = useState<AlertActionState>(() => repo.load());

  const setState = useCallback(
    (alertKey: string, status: ActionStatus) => {
      const prevStatus = states[alertKey] ?? 'todo';
      const persisted = repo.setState(alertKey, status);
      setStates((prev) => ({ ...prev, [alertKey]: status }));
      return { prevStatus, persisted };
    },
    [repo, states],
  );

  const getState = useCallback(
    (alertKey: string): ActionStatus => states[alertKey] ?? 'todo',
    [states],
  );

  /** 完了率を計算（totalKeys 中の done 件数） */
  const completionStats = useCallback(
    (alertKeys: string[]) => {
      const done = alertKeys.filter((k) => states[k] === 'done').length;
      return { done, total: alertKeys.length };
    },
    [states],
  );

  return { states, setState, getState, completionStats, ymd };
}

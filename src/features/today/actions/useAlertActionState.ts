/**
 * useAlertActionState — Hook for managing alert action completion state
 *
 * Uses localStorage repository scoped to date + login user.
 * loginUserKey: account.username from MSAL (email), fallback 'anonymous'.
 */
import { useAuth } from '@/auth/useAuth';
import { useCallback, useMemo, useState } from 'react';
import { createLocalStorageRepo } from './alertActions.storage';
import type { ActionStatus, AlertActionState } from './alertActions.types';

export function useAlertActionState() {
  const { account } = useAuth();
  const loginUserKey = account?.username ?? 'anonymous';
  const ymd = new Date().toISOString().split('T')[0];

  const repo = useMemo(
    () => createLocalStorageRepo(ymd, loginUserKey),
    [ymd, loginUserKey],
  );

  // Load initial state from localStorage
  const [states, setStates] = useState<AlertActionState>(() => repo.load());

  const setState = useCallback(
    (alertKey: string, status: ActionStatus) => {
      repo.setState(alertKey, status);
      setStates((prev) => ({ ...prev, [alertKey]: status }));
    },
    [repo],
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

  return { states, setState, getState, completionStats };
}

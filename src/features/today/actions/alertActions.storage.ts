/**
 * Alert Action State Repository (v1: localStorage)
 *
 * 永続先を将来 SP に差し替え可能な Repository pattern。
 * スコープ: 端末 × 日付 × ログインユーザー
 *
 * Key format: today-alert-actions.v1:{ymd}:{loginUserKey}
 *
 * @skill @observability-engineer — error classification on persist failure
 */
import { classifyStorageError, logBriefingActionError } from './alertActions.logger';
import type { ActionStatus, AlertActionState } from './alertActions.types';

const STORAGE_PREFIX = 'today-alert-actions.v1';

/** localStorage キーを生成 */
export function buildStorageKey(ymd: string, loginUserKey: string): string {
  return `${STORAGE_PREFIX}:${ymd}:${loginUserKey}`;
}

/** Repository Interface (将来 SP 実装に差し替え可能) */
export interface AlertActionRepository {
  load(): AlertActionState;
  /** Returns true on success, false on persist failure */
  setState(alertKey: string, status: ActionStatus): boolean;
  getState(alertKey: string): ActionStatus;
  clear(): void;
}

/** v1: localStorage Implementation */
export function createLocalStorageRepo(ymd: string, loginUserKey: string): AlertActionRepository {
  const key = buildStorageKey(ymd, loginUserKey);

  return {
    load(): AlertActionState {
      if (typeof window === 'undefined') return {};
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as AlertActionState) : {};
      } catch {
        return {};
      }
    },

    setState(alertKey: string, status: ActionStatus): boolean {
      if (typeof window === 'undefined') return false;
      try {
        const current = this.load();
        current[alertKey] = status;
        window.localStorage.setItem(key, JSON.stringify(current));
        return true;
      } catch (err) {
        // Classify and log — don't throw (UI stays alive)
        const parts = alertKey.split(':');
        logBriefingActionError({
          ymd,
          alertType: parts[0] ?? 'unknown',
          userId: parts[1] ?? 'unknown',
          actionId: status,
          errorClass: classifyStorageError(err),
          message: err instanceof Error ? err.message : String(err),
        });
        return false;
      }
    },

    getState(alertKey: string): ActionStatus {
      const current = this.load();
      return current[alertKey] ?? 'todo';
    },

    clear(): void {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    },
  };
}

/**
 * Alert Action State Repository (v1: localStorage)
 *
 * 永続先を将来 SP に差し替え可能な Repository pattern。
 * スコープ: 端末 × 日付 × ログインユーザー
 *
 * Key format: today-alert-actions.v1:{ymd}:{loginUserKey}
 */
import type { ActionStatus, AlertActionState } from './alertActions.types';

const STORAGE_PREFIX = 'today-alert-actions.v1';

/** localStorage キーを生成 */
export function buildStorageKey(ymd: string, loginUserKey: string): string {
  return `${STORAGE_PREFIX}:${ymd}:${loginUserKey}`;
}

/** Repository Interface (将来 SP 実装に差し替え可能) */
export interface AlertActionRepository {
  load(): AlertActionState;
  setState(alertKey: string, status: ActionStatus): void;
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

    setState(alertKey: string, status: ActionStatus): void {
      if (typeof window === 'undefined') return;
      const current = this.load();
      current[alertKey] = status;
      window.localStorage.setItem(key, JSON.stringify(current));
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

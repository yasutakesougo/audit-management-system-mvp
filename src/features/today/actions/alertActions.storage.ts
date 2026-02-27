/**
 * Alert Action State Repository (v1: localStorage)
 *
 * 永続先を将来 SP に差し替え可能な Repository pattern。
 * スコープ: 端末 × 日付 × ログインユーザー
 *
 * Key format: today-alert-actions.v1:{ymd}:{loginUserKey}
 */
import { classifyStorageError, logBriefingActionError } from './alertActions.logger';
import type { ActionStatus, AlertActionState } from './alertActions.types';

const STORAGE_PREFIX = 'today-alert-actions.v1';

/** localStorage キーを生成 */
export function buildStorageKey(ymd: string, loginUserKey: string): string {
  return `${STORAGE_PREFIX}:${ymd}:${loginUserKey}`;
}

/** alertKey から alertType / userId を抽出 (例: "absent:user-001:2026-02-28") */
function parseAlertKey(alertKey: string): { alertType: string; userId: string } {
  const parts = alertKey.split(':');
  return { alertType: parts[0] ?? 'unknown', userId: parts[1] ?? 'unknown' };
}

/** Repository Interface (将来 SP 実装に差し替え可能) */
export interface AlertActionRepository {
  load(): AlertActionState;
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
      } catch (err: unknown) {
        const { alertType, userId } = parseAlertKey(alertKey);
        const errorClass = classifyStorageError(err);
        logBriefingActionError({
          ymd,
          alertType,
          userId,
          actionId: alertKey,
          errorClass,
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

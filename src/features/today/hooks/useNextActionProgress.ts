/**
 * useNextActionProgress — NextAction の Start/Done 状態永続化
 *
 * localStorage + React useState で「同一端末1日使い切り」パターンに対応。
 * QuickRecord の autoNextEnabled と同じ永続化方式。
 *
 * キー形式: today.nextAction.v1:{date}:{eventId}
 * 保存: { startedAt?: string, doneAt?: string }
 */
import { useCallback, useState } from 'react';

const STORAGE_PREFIX = 'today.nextAction.v1';

export type NextActionProgress = {
  startedAt: string | null;  // ISO string
  doneAt: string | null;     // ISO string
};

type ProgressStore = Record<string, NextActionProgress>;

/**
 * Build a stable key for a next-action event
 */
export function buildProgressKey(dateKey: string, eventId: string): string {
  return `${STORAGE_PREFIX}:${dateKey}:${eventId}`;
}

/**
 * Build a stable event ID from schedule item fields (fallback when no id)
 */
export function buildStableEventId(id: string, time: string, title: string): string {
  return `${id}|${time}|${title}`;
}

function loadFromStorage(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(store: ProgressStore): void {
  try {
    localStorage.setItem(STORAGE_PREFIX, JSON.stringify(store));
  } catch {
    // Ignore quota/access errors
  }
}

export type NextActionProgressActions = {
  start: (key: string) => void;
  done: (key: string) => void;
  reset: (key: string) => void;
  getProgress: (key: string) => NextActionProgress | null;
};

export function useNextActionProgress(): NextActionProgressActions {
  const [store, setStore] = useState<ProgressStore>(loadFromStorage);

  const updateStore = useCallback((updater: (prev: ProgressStore) => ProgressStore) => {
    setStore(prev => {
      const next = updater(prev);
      saveToStorage(next);
      return next;
    });
  }, []);

  const start = useCallback((key: string) => {
    updateStore(prev => ({
      ...prev,
      [key]: {
        startedAt: new Date().toISOString(),
        doneAt: null,
      },
    }));
  }, [updateStore]);

  const done = useCallback((key: string) => {
    updateStore(prev => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          startedAt: existing?.startedAt ?? new Date().toISOString(),
          doneAt: new Date().toISOString(),
        },
      };
    });
  }, [updateStore]);

  const reset = useCallback((key: string) => {
    updateStore(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [updateStore]);

  const getProgress = useCallback((key: string): NextActionProgress | null => {
    return store[key] ?? null;
  }, [store]);

  return { start, done, reset, getProgress };
}

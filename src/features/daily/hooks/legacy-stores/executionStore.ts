// ---------------------------------------------------------------------------
// executionStore — 実施記録の永続化ストア
//
// Zustand ベースのリアクティブストア + localStorage 永続化
// デバイスローカル永続化（MVP段階）
// ---------------------------------------------------------------------------
import { useCallback } from 'react';
import { create } from 'zustand';

import {
    EXECUTION_RECORD_KEY,
    executionStoreSchema,
    makeDailyUserKey,
    type DailyUserRecords,
    type ExecutionRecord,
} from '@/features/daily/domain/legacy/executionRecordTypes';

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = EXECUTION_RECORD_KEY;
const DEBOUNCE_MS = 600;

function loadFromStorage(): Record<string, DailyUserRecords> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = executionStoreSchema.parse(JSON.parse(raw));
    return parsed.data;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function persistToStorage() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const { store } = useExecutionStoreBase.getState();
    const payload = { version: 1 as const, data: store };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, DEBOUNCE_MS);
}

/** テスト用: debounce を即座にフラッシュ */
export function __flushPersist() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const { store } = useExecutionStoreBase.getState();
  const payload = { version: 1 as const, data: store };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface ExecutionStoreState {
  store: Record<string, DailyUserRecords>;
}

const useExecutionStoreBase = create<ExecutionStoreState>()(() => ({
  store: loadFromStorage(),
}));

function saveDailyRecords(date: string, userId: string, records: ExecutionRecord[]) {
  const key = makeDailyUserKey(date, userId);
  useExecutionStoreBase.setState((s) => ({
    store: {
      ...s.store,
      [key]: {
        date,
        userId,
        records,
        updatedAt: new Date().toISOString(),
      },
    },
  }));
  persistToStorage();
}

/** テスト用: store をリセット */
export function __resetStore() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  useExecutionStoreBase.setState({ store: loadFromStorage() });
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useExecutionStore() {
  const snapshot = useExecutionStoreBase((s) => s.store);

  /** 日付×ユーザーの全記録を取得 */
  const getRecords = useCallback(
    (date: string, userId: string): ExecutionRecord[] => {
      const key = makeDailyUserKey(date, userId);
      return snapshot[key]?.records ?? [];
    },
    [snapshot],
  );

  /** scheduleItemId で特定の1レコードを取得 */
  const getRecord = useCallback(
    (date: string, userId: string, scheduleItemId: string): ExecutionRecord | undefined => {
      const records = getRecords(date, userId);
      return records.find((r) => r.scheduleItemId === scheduleItemId);
    },
    [getRecords],
  );

  /** 記録を追加/更新 (upsert) */
  const upsertRecord = useCallback(
    (record: ExecutionRecord) => {
      const existing = getRecords(record.date, record.userId);
      const index = existing.findIndex((r) => r.scheduleItemId === record.scheduleItemId);

      const updated =
        index >= 0
          ? existing.map((r, i) => (i === index ? record : r))
          : [...existing, record];

      saveDailyRecords(record.date, record.userId, updated);
    },
    [getRecords],
  );

  /** 完了率を計算（completed / total） */
  const getCompletionRate = useCallback(
    (date: string, userId: string, totalSlots: number): { completed: number; triggered: number; rate: number } => {
      const records = getRecords(date, userId);
      const completed = records.filter((r) => r.status === 'completed').length;
      const triggered = records.filter((r) => r.status === 'triggered').length;
      const recorded = records.filter((r) => r.status !== 'unrecorded').length;
      return {
        completed,
        triggered,
        rate: totalSlots > 0 ? recorded / totalSlots : 0,
      };
    },
    [getRecords],
  );

  return {
    getRecords,
    getRecord,
    upsertRecord,
    getCompletionRate,
  } as const;
}

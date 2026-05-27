// ---------------------------------------------------------------------------
// executionStore — 実施記録の永続化ストア
//
// Zustand ベースのリアクティブストア + localStorage 永続化
// デバイスローカル永続化（MVP段階）
// ---------------------------------------------------------------------------
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';

import {
    EXECUTION_RECORD_KEY,
    executionStoreSchema,
    makeDailyUserKey,
    type DailyUserRecords,
    type ExecutionRecord,
} from '@/features/daily/domain/executionRecordTypes';
import type { ExecutionRecordUpsertOptions } from '@/features/daily/domain/ExecutionRecordRepository';
import {
  normalizeExecutionDate,
  normalizeExecutionUserId,
  normalizeScheduleItemId,
} from '@/features/daily/utils/normalizeExecutionLookup';

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
      const normalizedDate = normalizeExecutionDate(date);
      const normalizedUserId = normalizeExecutionUserId(userId);
      const key = makeDailyUserKey(normalizedDate, normalizedUserId);
      const direct = snapshot[key]?.records;
      if (direct) return direct;

      // Legacy fallback: scan keys and compare normalized date/userId
      for (const daily of Object.values(snapshot)) {
        if (
          normalizeExecutionDate(daily.date) === normalizedDate &&
          normalizeExecutionUserId(daily.userId) === normalizedUserId
        ) {
          return daily.records;
        }
      }
      return [];
    },
    [snapshot],
  );

  /** scheduleItemId で特定の1レコードを取得 */
  const getRecord = useCallback(
    (date: string, userId: string, scheduleItemId: string): ExecutionRecord | undefined => {
      const records = getRecords(date, userId);
      const normalizedScheduleItemId = normalizeScheduleItemId(scheduleItemId);
      return records.find((r) => normalizeScheduleItemId(r.scheduleItemId) === normalizedScheduleItemId);
    },
    [getRecords],
  );

  /** 記録を追加/更新 (upsert) */
  const upsertRecord = useCallback(
    (record: ExecutionRecord, options?: ExecutionRecordUpsertOptions) => {
      const normalizedDate = normalizeExecutionDate(record.date);
      const normalizedUserId = normalizeExecutionUserId(record.userId);
      const normalizedScheduleItemId = normalizeScheduleItemId(record.scheduleItemId);
      const normalizedRecord: ExecutionRecord = {
        ...record,
        date: normalizedDate,
        userId: normalizedUserId,
        scheduleItemId: normalizedScheduleItemId,
      };
      const existingRecords = getRecords(normalizedDate, normalizedUserId);
      const index = existingRecords.findIndex((r) => normalizeScheduleItemId(r.scheduleItemId) === normalizedScheduleItemId);
      const existing = index >= 0 ? existingRecords[index] : undefined;

      // Concurrency Protection: Merge memos if existing record has a different memo.
      let finalMemo = normalizedRecord.memo;
      if (
        options?.memoMode !== 'overwrite' &&
        existing &&
        existing.memo &&
        normalizedRecord.memo &&
        existing.memo !== normalizedRecord.memo
      ) {
        if (!existing.memo.includes(normalizedRecord.memo)) {
          const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          const staffName = normalizedRecord.recordedBy || '職員';
          finalMemo = `${existing.memo}\n[${timeStr} ${staffName}] ${normalizedRecord.memo}`;
        } else {
          finalMemo = existing.memo;
        }
      } else if (existing && existing.memo && !normalizedRecord.memo) {
        finalMemo = existing.memo;
      }

      const mergedRecord: ExecutionRecord = {
        ...normalizedRecord,
        memo: finalMemo,
      };

      const updated =
        index >= 0
          ? existingRecords.map((r, i) => (i === index ? mergedRecord : r))
          : [...existingRecords, mergedRecord];

      saveDailyRecords(normalizedDate, normalizedUserId, updated);
    },
    [getRecords],
  );

  /** 記録を削除 */
  const deleteRecord = useCallback(
    (date: string, userId: string, scheduleItemId: string) => {
      const normalizedDate = normalizeExecutionDate(date);
      const normalizedUserId = normalizeExecutionUserId(userId);
      const normalizedScheduleItemId = normalizeScheduleItemId(scheduleItemId);
      const existing = getRecords(normalizedDate, normalizedUserId);
      const updated = existing.filter((r) => normalizeScheduleItemId(r.scheduleItemId) !== normalizedScheduleItemId);

      saveDailyRecords(normalizedDate, normalizedUserId, updated);
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

  /** 期間指定でユーザーの全記録を取得 */
  const getRecordsInRange = useCallback(
    (userId: string, from: string, to: string): ExecutionRecord[] => {
      const normalizedUserId = normalizeExecutionUserId(userId);
      const normalizedFrom = normalizeExecutionDate(from);
      const normalizedTo = normalizeExecutionDate(to);
      const results: ExecutionRecord[] = [];

      for (const daily of Object.values(snapshot)) {
        if (normalizeExecutionUserId(daily.userId) === normalizedUserId) {
          const date = normalizeExecutionDate(daily.date);
          if (date >= normalizedFrom && date <= normalizedTo) {
            results.push(...daily.records);
          }
        }
      }
      return results;
    },
    [snapshot],
  );

  return useMemo(() => ({
    getRecords,
    getRecord,
    upsertRecord,
    deleteRecord,
    getCompletionRate,
    getRecordsInRange,
  }), [getRecords, getRecord, upsertRecord, deleteRecord, getCompletionRate, getRecordsInRange]);
}

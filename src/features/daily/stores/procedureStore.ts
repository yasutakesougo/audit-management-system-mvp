// ---------------------------------------------------------------------------
// procedureStore — 支援手順（時間割）ストア
//
// Zustand ベースのリアクティブストア + localStorage 永続化
// CSVインポートで登録されたデータがリロード後も維持される。
// ---------------------------------------------------------------------------
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { PROCEDURE_ROWS } from '@/features/planning-sheet/constants/procedureRows';
import { useCallback } from 'react';
import { create } from 'zustand';

export type ProcedureItem = ScheduleItem;

// ---------------------------------------------------------------------------
// デフォルト時間割（フォールバック用）
// ---------------------------------------------------------------------------

const BASE_STEPS: ProcedureItem[] = PROCEDURE_ROWS.map(row => ({
  id: `base-${row.rowNo}`,
  rowNo: row.rowNo,
  time: row.timeLabel,
  activity: row.activity,
  instruction: row.instructionDetail || '',
  activityDetail: row.activityDetail,
  instructionDetail: row.instructionDetail,
  isKey: [1, 5, 7, 10, 12, 14, 15].includes(row.rowNo), // 主要なステップをKey設定
  block: row.category === 'external' ? 'outing' : (row.rowNo <= 5 ? 'morning' : 'afternoon')
}));

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'procedureStore.v1';
const DEBOUNCE_MS = 600;

function loadFromStorage(): Record<string, ProcedureItem[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    // v1 envelope: { version: 1, data: Record<string, ProcedureItem[]> }
    if (parsed.version === 1 && typeof parsed.data === 'object') {
      return parsed.data as Record<string, ProcedureItem[]>;
    }
    return {};
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function persistToStorage() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const { store } = useProcedureStoreBase.getState();
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
  const { store } = useProcedureStoreBase.getState();
  const payload = { version: 1 as const, data: store };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface ProcedureStoreState {
  store: Record<string, ProcedureItem[]>;
}

const useProcedureStoreBase = create<ProcedureStoreState>()(() => ({
  store: loadFromStorage(),
}));

/** テスト用: store をリセット（localStorage から再読み込み） */
export function __resetStore() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  useProcedureStoreBase.setState({ store: loadFromStorage() });
}

/** テスト用: store を完全クリア */
export function __clearStore() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  useProcedureStoreBase.setState({ store: {} });
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useProcedureStore() {
  const snapshot = useProcedureStoreBase((s) => s.store);

  /**
   * ユーザーの時間割を取得する。
   *
   * - store にデータがあればそれを返す（CSVインポート済み）
   * - store にデータがなければ BASE_STEPS をフォールバックとして返す
   *
   * ※ ユーザーが明示的にデータを持っているかどうかは hasUserData() で確認可能
   */
  const getByUser = useCallback((userId: string) => {
    if (!userId) return BASE_STEPS;
    return snapshot[userId] ?? BASE_STEPS;
  }, [snapshot]);

  /**
   * ユーザーの時間割を保存する（localStorage に永続化）
   */
  const save = useCallback((userId: string, items: ProcedureItem[]) => {
    if (!userId) return;
    useProcedureStoreBase.setState((s) => ({
      store: { ...s.store, [userId]: items },
    }));
    persistToStorage();
  }, []);

  /**
   * ユーザーが明示的に登録されたデータを持っているか確認する。
   * false の場合は BASE_STEPS フォールバックが使われている。
   */
  const hasUserData = useCallback((userId: string): boolean => {
    if (!userId) return false;
    return userId in snapshot;
  }, [snapshot]);

  /**
   * 登録済みのすべてのユーザーIDを取得する。
   */
  const registeredUserIds = useCallback((): string[] => {
    return Object.keys(snapshot);
  }, [snapshot]);

  return {
    getByUser,
    save,
    hasUserData,
    registeredUserIds,
  } as const;
}

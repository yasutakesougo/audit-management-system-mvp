// ---------------------------------------------------------------------------
// procedureStore — 支援手順（時間割）ストア
//
// executionStore と同じパターン: useSyncExternalStore + localStorage
// CSVインポートで登録されたデータがリロード後も維持される。
// ---------------------------------------------------------------------------
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { useCallback, useSyncExternalStore } from 'react';

export type ProcedureItem = ScheduleItem;

// ---------------------------------------------------------------------------
// デフォルト時間割（フォールバック用）
// ---------------------------------------------------------------------------

const BASE_STEPS: ProcedureItem[] = [
  { id: 'base-0900', time: '09:00', activity: '朝の受け入れ', instruction: '視線を合わせて挨拶。体調チェックシート記入。', isKey: true },
  { id: 'base-0915', time: '09:15', activity: '持ち物整理', instruction: 'ロッカーへの収納を支援。手順書を提示。', isKey: false },
  { id: 'base-1000', time: '10:00', activity: '作業活動', instruction: '作業手順の提示。失敗時は新しい部材を渡す。', isKey: true },
  { id: 'base-1130', time: '11:30', activity: '昼食準備', instruction: '手洗い場へ誘導。', isKey: false },
  { id: 'base-1200', time: '12:00', activity: '昼食', instruction: '誤嚥に注意して見守り。', isKey: true },
  { id: 'base-1300', time: '13:00', activity: '休憩', instruction: 'リラックスできる環境を提供。', isKey: false },
  { id: 'base-1500', time: '15:00', activity: '掃除', instruction: '担当箇所の清掃を一緒に行う。', isKey: false },
  { id: 'base-1545', time: '15:45', activity: '帰りの会', instruction: '一日の振り返り。ポジティブなフィードバック。', isKey: true },
];

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
  const payload = { version: 1 as const, data: store };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

let store: Record<string, ProcedureItem[]> = loadFromStorage();
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => store;

/** テスト用: store をリセット（localStorage から再読み込み） */
export function __resetStore() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  store = loadFromStorage();
  emit();
}

/** テスト用: store を完全クリア */
export function __clearStore() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  store = {};
  localStorage.removeItem(STORAGE_KEY);
  emit();
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useProcedureStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

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
    store = { ...store, [userId]: items };
    emit();
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

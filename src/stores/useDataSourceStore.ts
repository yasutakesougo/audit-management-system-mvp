/**
 * useDataSourceStore — 各データソースの状態を一元管理する Zustand ストア
 *
 * アプリ全体で「今どのデータソースが本番 / デモ / エラー」かを追跡し、
 * DataSourceBanner 等の UI で表示するための状態基盤。
 *
 * ## 設計方針
 * - report() をデータ取得フックから呼ぶだけで状態が更新される
 * - 各データソースは一意の key で識別（例: 'holidays', 'schedules', 'users'）
 * - 'live' = 本番 SP データ、'fallback' = デモ/静的フォールバック
 */
import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataSourceStatus = 'live' | 'fallback' | 'loading' | 'error';

export interface DataSourceEntry {
  /** 表示用ラベル (例: '祝日マスタ', 'スケジュール') */
  label: string;
  /** 現在の状態 */
  status: DataSourceStatus;
  /** 最終更新時刻 (ISO) */
  updatedAt: string;
  /** フォールバック時の理由（任意） */
  reason?: string;
}

interface DataSourceState {
  /** key → entry マップ */
  sources: Record<string, DataSourceEntry>;

  /** データソースの状態を報告する */
  report: (key: string, entry: Omit<DataSourceEntry, 'updatedAt'>) => void;

  /** 特定のデータソースをクリア */
  clear: (key: string) => void;

  /** 全クリア */
  clearAll: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDataSourceStore = create<DataSourceState>((set) => ({
  sources: {},

  report: (key, entry) =>
    set((state) => ({
      sources: {
        ...state.sources,
        [key]: {
          ...entry,
          updatedAt: new Date().toISOString(),
        },
      },
    })),

  clear: (key) =>
    set((state) => {
      const next = { ...state.sources };
      delete next[key];
      return { sources: next };
    }),

  clearAll: () => set({ sources: {} }),
}));

// ─── Derived selectors ───────────────────────────────────────────────────────

/** fallback 状態のデータソースがあるか */
export const selectHasFallback = (state: DataSourceState): boolean =>
  Object.values(state.sources).some((s) => s.status === 'fallback');

/** fallback 状態のデータソース一覧 */
export const selectFallbackSources = (state: DataSourceState): DataSourceEntry[] =>
  Object.values(state.sources).filter((s) => s.status === 'fallback');

/** 全データソースの件数サマリ */
export const selectSummary = (state: DataSourceState) => {
  const entries = Object.values(state.sources);
  return {
    total: entries.length,
    live: entries.filter((s) => s.status === 'live').length,
    fallback: entries.filter((s) => s.status === 'fallback').length,
    loading: entries.filter((s) => s.status === 'loading').length,
    error: entries.filter((s) => s.status === 'error').length,
  };
};

import { create } from 'zustand';
import type { FlushSummary } from './useNurseSync';

export type SyncSource = 'manual' | 'online' | 'auto';
export type SyncStatus = 'idle' | 'pending' | 'success' | 'error';

export type SyncSummary = FlushSummary;
export type SyncSummaryEntry = SyncSummary['entries'][number];

export type LastSyncState = {
  status: SyncStatus;
  source: SyncSource;
  sent: number;
  remaining: number;
  summary?: SyncSummary;
  error?: unknown;
  updatedAt?: string;
};

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

const stamp = () => new Date().toISOString();

const initialState: LastSyncState = {
  status: 'idle',
  source: 'manual',
  sent: 0,
  remaining: 0,
};

const useLastSyncStore = create<LastSyncState>()(() => ({ ...initialState }));

const assignState = (partial: Partial<LastSyncState>) => {
  useLastSyncStore.setState((prev) => ({
    ...prev,
    ...partial,
    updatedAt: partial.updatedAt ?? stamp(),
  }));
};

// ---------------------------------------------------------------------------
// Actions (backward-compatible)
// ---------------------------------------------------------------------------

export const markSyncPending = (source: SyncSource) => {
  assignState({
    status: 'pending',
    source,
    error: undefined,
    summary: undefined,
  });
};

export const markSyncResult = (input: {
  sent: number;
  remaining: number;
  source: SyncSource;
  summary: SyncSummary;
}) => {
  assignState({
    status: 'success',
    source: input.source,
    sent: input.sent,
    remaining: input.remaining,
    summary: input.summary,
    error: undefined,
  });
};

export const markSyncFailure = (input: { source: SyncSource; error: unknown }) => {
  assignState({
    status: 'error',
    source: input.source,
    error: input.error,
    summary: undefined,
  });
};

export const resetLastSync = () => {
  assignState({
    status: 'idle',
    source: 'manual',
    sent: 0,
    remaining: 0,
    summary: undefined,
    error: undefined,
  });
};

// ---------------------------------------------------------------------------
// React Hook (backward-compatible)
// ---------------------------------------------------------------------------

export const useLastSync = (): LastSyncState => useLastSyncStore();

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export const formatLastSyncCaption = (snapshot: LastSyncState): string => {
  switch (snapshot.status) {
    case 'pending':
      return '同期中...';
    case 'success':
      return `同期済み ${snapshot.sent}件`;
    case 'error':
      return '同期に失敗しました';
    default:
      return '未同期';
  }
};

// Test exports
export const __resetLastSyncStoreForTests = () => {
  useLastSyncStore.setState({ ...initialState, updatedAt: stamp() });
};

export const getLastSyncSnapshot = (): LastSyncState => useLastSyncStore.getState();

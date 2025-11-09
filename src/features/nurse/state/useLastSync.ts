import { useSyncExternalStore } from 'react';

export type SyncSource = 'manual' | 'online' | 'auto';
export type SyncStatus = 'idle' | 'pending' | 'success' | 'error';

export type SyncSummaryEntry = {
  userId: string;
  status: 'ok' | 'partial' | 'error';
  kind: string;
  error?: unknown;
};

export type SyncSummary = {
  sent: number;
  remaining: number;
  okCount: number;
  errorCount: number;
  partialCount: number;
  totalCount: number;
  entries: SyncSummaryEntry[];
  source: SyncSource;
  bpSent?: number;
};

export type LastSyncState = {
  status: SyncStatus;
  source: SyncSource;
  sent: number;
  remaining: number;
  summary?: SyncSummary;
  error?: unknown;
  updatedAt?: string;
};

type Listener = () => void;

const listeners = new Set<Listener>();

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

let state: LastSyncState = {
  status: 'idle',
  source: 'manual',
  sent: 0,
  remaining: 0,
};

const getSnapshot = () => state;

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

const stamp = () => new Date().toISOString();

const assignState = (partial: Partial<LastSyncState>) => {
  state = {
    ...state,
    ...partial,
    updatedAt: partial.updatedAt ?? stamp(),
  };
  notify();
};

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

export const useLastSync = (): LastSyncState => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

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

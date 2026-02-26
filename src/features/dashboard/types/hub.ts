import type { SafeError } from '@/lib/errors';
import { type SpSyncErrorKind } from '../logic/classifySpSyncError';

export type LaneState = 'disabled' | 'idle' | 'active' | 'error';
export type SpLaneSource = 'seed' | 'sp' | 'polling' | 'demo';

export const sourceLabelMap: Record<SpLaneSource, string> = {
  seed: 'シードデータ',
  sp: 'SharePoint 同期',
  polling: 'ポーリング更新',
  demo: 'デモデータ',
};

export const HUB_CONTRACT_VERSION = 1 as const;

export interface HubLaneModel {
  version: number;
  state: LaneState;
  title: string;
  subtitle?: string;
  lastSyncAt?: string;
  itemCount?: number;
  reason?: string;
  source?: SpLaneSource;
  busy?: boolean;
  onRetry?: () => void;
  canRetry?: boolean;
  cooldownUntil?: number;
  failureCount?: number;
  retryAfter?: number;
  details?: {
    state: LaneState;
    source?: SpLaneSource;
    lastSyncAt?: string;
    itemCount?: number;
    error?: string;
    reason?: string;
    errorKind?: SpSyncErrorKind;
    hint?: string;
  };
}

export type SpLaneModel = HubLaneModel;

export interface HubSyncStatus {
  loading: boolean;
  error: SafeError | null;
  itemCount: number;
  source?: SpLaneSource | string;
  lastSyncAt?: string;
  isFetching?: boolean;
  onRetry?: () => void;
  cooldownUntil?: number;
  failureCount?: number;
  retryAfter?: number;
  errorKind?: SpSyncErrorKind;
  hint?: string;
  canRetry?: boolean;
}

export type SpSyncStatus = HubSyncStatus;

// Global ambient type declarations for debug metrics to avoid pervasive any casts
// These are only populated in DEV / test environments.

/**
 * 監査バッチ処理のメトリクス情報
 * DEV環境での処理状況追跡に使用
 */
type AuditBatchMetrics = {
  total: number;
  success: number;
  duplicates: number;
  newItems: number;
  failed: number;
  retryMax: number;
  categories: Record<string, number>;
  durationMs: number;
  timestamp: string;
  parserFallbackCount?: number;
};

/**
 * E2Eバッチ同期処理の結果サマリー
 */
type BatchSyncSummary = {
  total: number;
  success: number;
  failed?: number;
  duplicates?: number;
  errors?: { contentId: number; status: number; statusText: string }[];
  durationMs?: number;
  categories?: Record<string, number>;
};

/**
 * バッチ同期処理の戻り値（正常系またはエラー）
 */
type BatchSyncResult = BatchSyncSummary | { error: string };

declare global {
  interface Window {
    __AUDIT_BATCH_METRICS__?: AuditBatchMetrics;
    // E2E testing hooks
    __E2E_FORCE_BATCH__?: (chunk: unknown[]) => Promise<{ body: string } | null>;
    __E2E_LAST_PARSED__?: unknown;
    __TEST_BATCH_DONE__?: () => void;
    // E2E batch synchronization hook (DEV only)
    __E2E_INVOKE_SYNC_BATCH__?: (size?: number) => Promise<BatchSyncResult>;
    // Route hydration error boundary control (E2E/TEST only)
    __suppressRouteReset__?: boolean;
  }
}

export { };

declare module 'react-router' {
  interface FutureConfig {
    v7_startTransition?: boolean;
    v7_relativeSplatPath?: boolean;
  }
}
// Global ambient type declarations for debug metrics to avoid pervasive any casts
// These are only populated in DEV / test environments.

interface AuditBatchMetricsWindow {
  __AUDIT_BATCH_METRICS__?: {
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
}

declare global {
  interface Window extends AuditBatchMetricsWindow {}
}

export {};
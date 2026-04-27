import { auditLog } from '@/lib/debugLogger';
import { SP_TELEMETRY_THRESHOLDS } from '@/shared/api/spQueryLimits';
import type { GuardedQueryParams, SharePointQueryRiskLevel } from './queryGuard';

export interface SpTelemetryMetrics {
  listName?: string;
  queryKind?: string;
  sanitizedTop: number;
  selectCount?: number;
  expandCount?: number;
  riskLevel: SharePointQueryRiskLevel;
  warningCodes: string[];
  durationMs: number;
  resultCount?: number;
  retryCount: number;
  statusCode?: number;
  throttled: boolean;
  hasFilter: boolean;
  hasOrderBy: boolean;
  isError: boolean;
  errorMessage?: string;
}

export interface QueryTelemetryPayload {
  guardedParams: GuardedQueryParams;
  riskLevel: SharePointQueryRiskLevel;
  warningCodes: string[];
  startTimeMs: number;
}

/**
 * Extensible sink for telemetry data.
 * Currently relays to auditLog, but structured to support external sinks
 * (e.g., Application Insights, Datadog, or custom analytics endpoints) in the future.
 */
export const telemetrySink = {
  recordQuery(metrics: SpTelemetryMetrics) {
    if (metrics.isError) {
      auditLog.warn('sp:telemetry', 'Failed query recorded', metrics);
    } else if (metrics.riskLevel === 'high') {
      auditLog.warn('sp:telemetry', 'High risk query recorded', metrics);
    } else if (metrics.durationMs > SP_TELEMETRY_THRESHOLDS.slowQueryMs) {
      auditLog.warn('sp:telemetry', 'Slow query recorded', metrics);
    } else {
      auditLog.info('sp:telemetry', 'Query recorded', metrics);
    }
    // TODO (Phase 2): Send structured event to real telemetry endpoint
  }
};

/**
 * Begins a telemetry recording session for a SharePoint query.
 * Returns a payload that should be passed to `endSpQueryTelemetry` when the fetch completes.
 */
export function beginSpQueryTelemetry(
  guardedParams: GuardedQueryParams, 
  riskLevel: SharePointQueryRiskLevel, 
  warningCodes: string[]
): QueryTelemetryPayload {
  return {
    guardedParams,
    riskLevel,
    warningCodes,
    startTimeMs: performance.now()
  };
}

export interface EndSpQueryTelemetryOptions {
  payload: QueryTelemetryPayload;
  response?: Response | null;
  error?: Error | unknown;
  retryCount: number;
  resultCount?: number;
}

/**
 * Calculates duration and records the complete telemetry event.
 */
export function endSpQueryTelemetry(options: EndSpQueryTelemetryOptions): SpTelemetryMetrics {
  const { payload, response, error, retryCount, resultCount } = options;
  const durationMs = Math.round(performance.now() - payload.startTimeMs);
  const p = payload.guardedParams;
  
  const statusCode = response?.status;
  const throttled = statusCode === 429;
  const isError = !!error || (statusCode !== undefined && statusCode >= 400);
  
  const errorMessage = error instanceof Error ? error.message : (isError && !error ? `HTTP ${statusCode}` : undefined);

  const metrics: SpTelemetryMetrics = {
    listName: p.listName || undefined,
    queryKind: p.queryKind || undefined,
    sanitizedTop: p.top ?? 0,
    selectCount: p.select?.length,
    expandCount: p.expand?.length,
    hasFilter: !!p.filter,
    hasOrderBy: !!p.orderBy,
    riskLevel: payload.riskLevel,
    warningCodes: payload.warningCodes,
    durationMs,
    resultCount,
    retryCount,
    statusCode,
    throttled,
    isError,
    errorMessage
  };
  telemetrySink.recordQuery(metrics);

  return metrics;
}

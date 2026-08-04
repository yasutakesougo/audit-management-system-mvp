import { readBool, type EnvRecord } from '@/lib/env';

export type SpProxyCorrelationEvent =
  | 'request_start'
  | 'http_response'
  | 'retry'
  | 'non_http_failure'
  | 'health_signal';

export type SpProxyFailureClass =
  | 'http'
  | 'network'
  | 'abort'
  | 'cors_redirect'
  | 'throttle_redirect'
  | 'unknown';

export type SpProxyRetryClass = 'none' | 'timeout' | 'throttle' | 'server' | 'network';

export interface SpProxyCorrelationRecord {
  diagnosticId?: string;
  event: SpProxyCorrelationEvent;
  occurredAt: string;
  method?: string;
  targetPath?: string;
  targetList?: string;
  route?: string;
  status?: number;
  statusClass?: string;
  safeErrorCode?: string;
  failureClass?: SpProxyFailureClass;
  retryClass?: SpProxyRetryClass;
  retryable?: boolean;
  durationMs?: number;
  reasonCode?: string;
  listName?: string;
  severity?: string;
  source?: string;
  occurrenceCount?: number;
  firstOccurredAt?: string;
  lastOccurredAt?: string;
  signalAgeMs?: number;
}

const MAX_RECORDS = 300;
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

let records: SpProxyCorrelationRecord[] = [];

export const isSpProxyCorrelationEnabled = (envOverride?: EnvRecord): boolean =>
  readBool('VITE_SP_PROXY_CORRELATION', false, envOverride);

export const createSpProxyDiagnosticId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `sp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

export const statusClassFor = (status?: number): string | undefined => {
  if (status === undefined || !Number.isFinite(status)) return undefined;
  return `${Math.floor(status / 100)}xx`;
};

const sanitizePath = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value, 'https://app.invalid');
    return url.pathname
      .replace(/\/items\([^/)]*\)/gi, '/items(?)')
      .replace(/\/attachments\([^/)]*\)/gi, '/attachments(?)')
      .slice(0, 512);
  } catch {
    return value.split('?')[0].slice(0, 512);
  }
};

const sanitizeListName = (value: string | undefined): string | undefined =>
  value?.replace(/[\r\n]/g, ' ').slice(0, 128);

const sanitizeDiagnosticId = (value: string | undefined): string | undefined => {
  if (!value || !SAFE_ID_PATTERN.test(value)) return undefined;
  return value;
};

const sanitizeRecord = (record: SpProxyCorrelationRecord): SpProxyCorrelationRecord => {
  const status = typeof record.status === 'number' && Number.isFinite(record.status)
    ? Math.trunc(record.status)
    : undefined;
  return {
    diagnosticId: sanitizeDiagnosticId(record.diagnosticId),
    event: record.event,
    occurredAt: record.occurredAt,
    method: record.method?.toUpperCase().slice(0, 12),
    targetPath: sanitizePath(record.targetPath),
    targetList: sanitizeListName(record.targetList),
    route: sanitizePath(record.route),
    status,
    statusClass: record.statusClass ?? statusClassFor(status),
    safeErrorCode: record.safeErrorCode?.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80),
    failureClass: record.failureClass,
    retryClass: record.retryClass,
    retryable: record.retryable,
    durationMs: typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
      ? Math.max(0, Math.trunc(record.durationMs))
      : undefined,
    reasonCode: record.reasonCode?.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80),
    listName: sanitizeListName(record.listName),
    severity: record.severity?.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 32),
    source: record.source?.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 32),
    occurrenceCount: typeof record.occurrenceCount === 'number' && Number.isFinite(record.occurrenceCount)
      ? Math.max(0, Math.trunc(record.occurrenceCount))
      : undefined,
    firstOccurredAt: record.firstOccurredAt,
    lastOccurredAt: record.lastOccurredAt,
    signalAgeMs: typeof record.signalAgeMs === 'number' && Number.isFinite(record.signalAgeMs)
      ? Math.max(0, Math.trunc(record.signalAgeMs))
      : undefined,
  };
};

export const recordSpProxyCorrelation = (
  record: SpProxyCorrelationRecord,
  envOverride?: EnvRecord,
): void => {
  if (!isSpProxyCorrelationEnabled(envOverride)) return;
  records = [...records, sanitizeRecord(record)].slice(-MAX_RECORDS);
};

export const getSpProxyCorrelationSnapshot = () => ({
  records: records.map((record) => ({ ...record })),
  generatedAt: new Date().toISOString(),
});

export const clearSpProxyCorrelation = (): void => {
  records = [];
};

if (typeof window !== 'undefined' && isSpProxyCorrelationEnabled()) {
  (window as typeof window & {
    spProxyCorrelation?: typeof getSpProxyCorrelationSnapshot;
  }).spProxyCorrelation = getSpProxyCorrelationSnapshot;
}

import { emitTelemetry } from '@/features/nurse/telemetry/telemetry';
import { formatFlushSummaryToast } from '@/features/nurse/toast/formatFlushSummaryToast';
import { NURSE_USERS } from '@/features/nurse/users';
import { isDevMode } from '@/lib/env';
import { TESTIDS } from '@/testids';
import { makeSharePointListApi, type SharePointListApi } from '../sp/client';
import { NURSE_LISTS } from '../sp/constants';
import { toObservationItem } from '../sp/map';
import { batchUpsertObservations, type ObservationUpsertEnvelope, type ObservationUpsertResult } from '../sp/upsert';
import { BACKOFF_SECONDS, queue, type NurseQueueItem } from './offlineQueue';
import {
    markSyncFailure,
    markSyncPending,
    markSyncResult,
    type SyncSource,
} from './useLastSync';

export type FlushEntrySummary = {
  userId: string;
  status: 'ok' | 'error' | 'partial';
  kind: NurseQueueItem['type'];
  error?: unknown;
};

export type FlushFailureSample = {
  userId: string;
  error?: string;
  status?: number;
  key: string;
};

export type FlushSummary = {
  sent: number;
  remaining: number;
  okCount: number;
  errorCount: number;
  partialCount: number;
  entries: FlushEntrySummary[];
  totalCount: number;
  source: SyncSource;
  bpSent?: number;
  durationMs: number;
  attempts: number;
  failureSamples: FlushFailureSample[];
};

type FlushJob = {
  queueItem: NurseQueueItem;
  envelope: ObservationUpsertEnvelope;
  offlineDurationMs: number;
  isBpObservation: boolean;
};

export type FlushOptions = {
  source?: SyncSource;
  suppressToast?: boolean;
};

type MockSummaryMode = 'ok' | 'partial' | 'error';

type SummaryOverride = Partial<Omit<FlushSummary, 'source' | 'entries'>> & {
  entries?: FlushEntrySummary[];
};

const ensureSharePointApi = (sp?: SharePointListApi) => sp ?? makeSharePointListApi();

const resolveUserId = (codeOrId: string): number => {
  const numeric = Number(codeOrId);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return numeric;
  }
  const match = codeOrId.match(/\d+/);
  if (match) {
    const derived = Number(match[0]);
    if (!Number.isNaN(derived)) {
      return derived;
    }
  }
  return 0;
};

const scheduleNext = (item: NurseQueueItem, referenceMs: number): NurseQueueItem => {
  const attempts = Math.min(item.retryCount ?? 0, BACKOFF_SECONDS.length - 1);
  const delaySec = BACKOFF_SECONDS[attempts];
  const nextAttemptAt = new Date(referenceMs + delaySec * 1000).toISOString();
  return {
    ...item,
    retryCount: (item.retryCount ?? 0) + 1,
    nextAttemptAt,
  };
};

const isDue = (item: NurseQueueItem, nowIso: string) => !item.nextAttemptAt || item.nextAttemptAt <= nowIso;

const findUserName = (userId: string): string => {
  const record = NURSE_USERS.find((entry) => entry.id === userId);
  return record?.name ?? userId;
};

const formatSeizureTime = (timestampUtc: string, timeZone = 'Asia/Tokyo') => {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(new Date(timestampUtc));
  } catch {
    return '';
  }
};

const MOCK_SUMMARY_ENTRIES: Record<MockSummaryMode, FlushEntrySummary[]> = {
  ok: [
    { userId: 'I015', status: 'ok', kind: 'observation' },
    { userId: 'I022', status: 'ok', kind: 'observation' },
  ],
  partial: [
    { userId: 'I015', status: 'partial', kind: 'observation' },
    { userId: 'I022', status: 'ok', kind: 'observation' },
    { userId: 'I031', status: 'ok', kind: 'observation' },
    { userId: 'I044', status: 'partial', kind: 'observation' },
  ],
  error: [
    { userId: 'I015', status: 'error', kind: 'observation' },
    { userId: 'I022', status: 'error', kind: 'observation' },
  ],
};

const deriveMetrics = (entries: FlushEntrySummary[]) => {
  const okCount = entries.filter((entry) => entry.status === 'ok').length;
  const partialCount = entries.filter((entry) => entry.status === 'partial').length;
  const errorCount = entries.filter((entry) => entry.status === 'error').length;
  const totalCount = entries.length;
  const sent = okCount;
  const remaining = errorCount + partialCount;
  return { okCount, partialCount, errorCount, totalCount, sent, remaining };
};

const buildSummary = (entries: FlushEntrySummary[], source: SyncSource, override?: SummaryOverride): FlushSummary => {
  const metrics = deriveMetrics(entries);
  return {
    sent: override?.sent ?? metrics.sent,
    remaining: override?.remaining ?? metrics.remaining,
    okCount: override?.okCount ?? metrics.okCount,
    errorCount: override?.errorCount ?? metrics.errorCount,
    partialCount: override?.partialCount ?? metrics.partialCount,
    entries,
    totalCount: override?.totalCount ?? metrics.totalCount,
    source,
    bpSent: override?.bpSent ?? 0,
    durationMs: override?.durationMs ?? 0,
    attempts: override?.attempts ?? 0,
    failureSamples: override?.failureSamples ?? [],
  };
};

const resolveSummaryOverride = (source: SyncSource): FlushSummary | null => {
  if (typeof window === 'undefined' || !isDevMode()) {
    return null;
  }
  const mswHost = window as typeof window & {
    __MSW__?: Record<string, unknown>;
    __MSW_NURSE_MODE__?: MockSummaryMode;
    __MSW_NURSE_SUMMARY__?: SummaryOverride;
  };
  mswHost.__MSW__ = mswHost.__MSW__ ?? {};
  const mode = mswHost.__MSW_NURSE_MODE__;
  const customEntries = mswHost.__MSW_NURSE_SUMMARY__;
  if (customEntries?.entries && Array.isArray(customEntries.entries)) {
    return buildSummary(customEntries.entries as FlushEntrySummary[], source, customEntries);
  }
  if (mode === 'ok' || mode === 'partial' || mode === 'error') {
    const typedMode: MockSummaryMode = mode;
    return buildSummary(MOCK_SUMMARY_ENTRIES[typedMode], source);
  }
  return null;
};

const perfNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

export async function flushNurseQueue(sp?: SharePointListApi, options: FlushOptions = {}): Promise<FlushSummary> {
  const api = ensureSharePointApi(sp);
  const { source = 'manual', suppressToast = false } = options;
  markSyncPending(source);
  const flushStartedMs = Date.now();
  const perfStartedAt = perfNow();
  try {
    const nowIso = new Date(flushStartedMs).toISOString();
    const pending = queue.all();
    const due: NurseQueueItem[] = [];
    const hold: NurseQueueItem[] = [];
    for (const item of pending) {
      if (isDue(item, nowIso)) {
        due.push(item);
      } else {
        hold.push(item);
      }
    }

    const jobs: FlushJob[] = due.map((item) => {
      const itemTimestampMs = new Date(item.timestampUtc).getTime();
      const offlineDurationMs = Number.isFinite(itemTimestampMs)
        ? Math.max(0, flushStartedMs - itemTimestampMs)
        : 0;
      const payload = toObservationItem({
        userLookupId: resolveUserId(item.userId),
        atISO: item.timestampUtc,
        vitals: item.type === 'observation' ? item.vitals : {},
        memo: item.memo,
        tags: item.tags,
        idempotencyKey: item.idempotencyKey,
        source: item.source,
        localTz: item.localTz,
        createdBy: item.createdBy,
        deviceId: item.deviceId,
      });
      const envelope: ObservationUpsertEnvelope = {
        key: item.idempotencyKey,
        item: payload,
      };
      return {
        queueItem: item,
        envelope,
        offlineDurationMs,
        isBpObservation: item.type === 'observation' && item.tags?.includes('bp-panel'),
      };
    });

    const envelopes = jobs.map((job) => job.envelope);
    const upsertResults = envelopes.length > 0
      ? await batchUpsertObservations(api, NURSE_LISTS.observation, envelopes)
      : [];
    const durationMs = Math.max(0, Math.round(perfNow() - perfStartedAt));
    const resultByKey = new Map<string, ObservationUpsertResult>();
    for (const result of upsertResults) {
      resultByKey.set(result.key, result);
    }

    const entries: FlushEntrySummary[] = [];
    const retries: NurseQueueItem[] = [];
    const failureSamples: FlushFailureSample[] = [];
    const seizureSuccesses: Array<{ userId: string; timestampUtc: string; localTz?: string }> = [];
    const seizureFailures: Array<{ userId: string; timestampUtc: string; localTz?: string }> = [];
    let sent = 0;
    let bpSent = 0;
    let totalAttempts = 0;
    let lastFailureError: string | undefined;

    for (const job of jobs) {
      const result = resultByKey.get(job.envelope.key);
      const attempts = result?.attempts ?? 0;
      totalAttempts += attempts;
      const queueItem = job.queueItem;
      if (result?.ok) {
        entries.push({ userId: queueItem.userId, status: 'ok', kind: queueItem.type });
        sent += 1;
        if (job.isBpObservation) {
          bpSent += 1;
        }
        if (queueItem.type === 'seizure') {
          seizureSuccesses.push({ userId: queueItem.userId, timestampUtc: queueItem.timestampUtc, localTz: queueItem.localTz });
          emitTelemetry('nurse_seizure_saved_total', {
            userId: queueItem.userId,
            observedAtUtc: queueItem.timestampUtc,
            retried: (queueItem.retryCount ?? 0) > 0,
            offlineDurationMs: job.offlineDurationMs,
            attempts,
          });
        }
      } else {
        const errorMessage = result?.error ?? 'upsert failed';
        entries.push({ userId: queueItem.userId, status: 'error', kind: queueItem.type, error: errorMessage });
        if (failureSamples.length < 5) {
          failureSamples.push({ userId: queueItem.userId, error: errorMessage, status: result?.status, key: job.envelope.key });
        }
        const scheduled = scheduleNext({ ...queueItem, lastError: errorMessage }, Date.now());
        retries.push(scheduled);
        if (queueItem.type === 'seizure') {
          seizureFailures.push({ userId: queueItem.userId, timestampUtc: queueItem.timestampUtc, localTz: queueItem.localTz });
        }
        lastFailureError = errorMessage;
      }
    }

    const nextQueue = [...hold, ...retries];
    queue.replace(nextQueue);

    const failedCount = retries.length;
    const totalProcessed = sent + failedCount;
    if (totalProcessed > 0) {
      emitTelemetry('nurse_queue_flushed_total', {
        sent,
        failed: failedCount,
        remaining: nextQueue.length,
        durationMs,
        attempts: totalAttempts,
      });
    }
    if (failedCount > 0) {
      emitTelemetry('nurse_queue_failed_total', {
        count: failedCount,
        lastError: lastFailureError ?? retries[retries.length - 1]?.lastError ?? 'unknown',
        sampleKeys: failureSamples.slice(0, 3).map((sample) => sample.key),
      });
    }

    const summary = buildSummary(entries, source, {
      sent,
      remaining: nextQueue.length,
      bpSent,
      durationMs,
      attempts: totalAttempts,
      failureSamples,
    });
    const overrideSummary = resolveSummaryOverride(source);
    const finalSummary = overrideSummary
      ? {
          ...summary,
          ...overrideSummary,
          bpSent: overrideSummary.bpSent ?? summary.bpSent,
          durationMs: overrideSummary.durationMs ?? summary.durationMs,
          attempts: overrideSummary.attempts ?? summary.attempts,
          failureSamples: overrideSummary.failureSamples ?? summary.failureSamples,
        }
      : summary;

    if (typeof window !== 'undefined' && !suppressToast) {
      let toastDispatched = false;
      if (seizureFailures.length > 0) {
        const { userId } = seizureFailures[0];
        const userName = findUserName(userId);
        window.dispatchEvent(new CustomEvent('nurse:toast', {
          detail: {
            severity: 'error',
            message: `${userName} の発作記録を保存できませんでした — 再試行`,
            retry: 'flush',
            testId: TESTIDS.NURSE_SYNC_TOAST,
          },
        }));
        toastDispatched = true;
      } else if (seizureSuccesses.length > 0) {
        const { userId, timestampUtc, localTz } = seizureSuccesses[0];
        const userName = findUserName(userId);
        const timeLabel = formatSeizureTime(timestampUtc, localTz ?? 'Asia/Tokyo');
        window.dispatchEvent(new CustomEvent('nurse:toast', {
          detail: {
            severity: 'success',
            message: `${userName} の発作記録を保存しました（${timeLabel}）`,
            testId: TESTIDS.NURSE_SYNC_TOAST,
          },
        }));
        toastDispatched = true;
      }

      if (!toastDispatched && finalSummary.totalCount > 0) {
        const payload = formatFlushSummaryToast(finalSummary);
        window.dispatchEvent(new CustomEvent('nurse:toast', {
          detail: {
            severity: payload.severity,
            message: payload.message,
            testId: TESTIDS.NURSE_SYNC_TOAST,
          },
        }));
      }
    }

    markSyncResult({ sent: finalSummary.sent, remaining: finalSummary.remaining, source, summary: finalSummary });
    return finalSummary;
  } catch (error) {
    markSyncFailure({ source, error });
    throw error;
  }
}

export const nurseSync = {
  flush: flushNurseQueue,
  queue,
};

// Re-export types and functions that are used by tests
export type { SharePointListApi } from '../sp/client';
export { upsertObservation } from '../sp/upsert';
export type { NurseQueueItem } from './offlineQueue';

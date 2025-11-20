import type { SharePointListApi } from '@/features/nurse/sp/client';
import type { NurseQueueItem } from '@/features/nurse/state/offlineQueue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queueState = vi.hoisted(() => [] as NurseQueueItem[]);

vi.mock('@/features/nurse/state/offlineQueue', async () => {
  const actual = await vi.importActual<typeof import('@/features/nurse/state/offlineQueue')>(
    '@/features/nurse/state/offlineQueue',
  );
  return {
    ...actual,
    queue: {
      all: () => [...queueState],
      replace: (items: NurseQueueItem[]) => {
        queueState.length = 0;
        queueState.push(...items);
      },
      add: vi.fn(),
    },
  };
});

const upsertObservationMock = vi.hoisted(() => vi.fn());
const batchUpsertObservationsMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/nurse/sp/upsert', () => ({
  upsertObservation: upsertObservationMock,
  batchUpsertObservations: batchUpsertObservationsMock,
}));

import { flushNurseQueue } from '@/features/nurse/state/useNurseSync';

describe('flushNurseQueue idempotent observation flow', () => {
  const fakeSp = { kind: 'stub' } as unknown as SharePointListApi;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-07T09:00:00Z'));
    queueState.length = 0;
    upsertObservationMock.mockReset();
    batchUpsertObservationsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes a queued observation successfully', async () => {
    const item: NurseQueueItem = {
      idempotencyKey: 'I021:observation:2025-11-07T09:00:00.000Z:client',
      type: 'observation',
      userId: 'I021',
      vitals: { temp: 36.6 },
      memo: 'OK',
      tags: [],
      timestampUtc: '2025-11-07T09:00:00.000Z',
      localTz: 'Asia/Tokyo',
      source: 'observation.form',
    };
    queueState.push(item);
    batchUpsertObservationsMock.mockResolvedValueOnce([{ key: item.idempotencyKey, ok: true, id: 1, created: false, attempts: 1 }]);

    const summary = await flushNurseQueue(fakeSp);

    expect(summary.sent).toBe(1);
    expect(summary.errorCount).toBe(0);
    expect(queueState).toHaveLength(0);
    expect(batchUpsertObservationsMock).toHaveBeenCalledTimes(1);
  });

  it('treats duplicate/idempotent errors as success', async () => {
    const item: NurseQueueItem = {
      idempotencyKey: 'I030:observation:2025-11-07T09:01:00.000Z:dupe',
      type: 'observation',
      userId: 'I030',
      vitals: { temp: 36.8 },
      memo: '',
      tags: ['tag'],
      timestampUtc: '2025-11-07T09:01:00.000Z',
      localTz: 'Asia/Tokyo',
      source: 'observation.form',
    };
    queueState.push(item);
    batchUpsertObservationsMock.mockResolvedValueOnce([{ key: item.idempotencyKey, ok: true, id: 2, created: false, attempts: 1 }]);

    const summary = await flushNurseQueue(fakeSp);

    expect(summary.sent).toBe(1);
    expect(summary.errorCount).toBe(0);
    expect(summary.entries).toEqual([
      { userId: 'I030', status: 'ok', kind: 'observation' },
    ]);
    expect(queueState).toHaveLength(0);
  });

  it('schedules retry with backoff and only retries when due', async () => {
    const item: NurseQueueItem = {
      idempotencyKey: 'I099:observation:2025-11-07T09:02:00.000Z:retry',
      type: 'observation',
      userId: 'I099',
      vitals: { temp: 37.1 },
      memo: '',
      tags: [],
      timestampUtc: '2025-11-07T09:02:00.000Z',
      localTz: 'Asia/Tokyo',
      source: 'observation.form',
    };
    queueState.push(item);
    batchUpsertObservationsMock
      .mockResolvedValueOnce([{ key: item.idempotencyKey, ok: false, error: 'network unavailable', attempts: 1 }])
      .mockResolvedValueOnce([{ key: item.idempotencyKey, ok: true, id: 3, created: false, attempts: 1 }]);

    const firstSummary = await flushNurseQueue(fakeSp);
    expect(firstSummary.errorCount).toBe(1);
    expect(queueState).toHaveLength(1);

    const [scheduled] = queueState;
    expect(scheduled.retryCount).toBe(1);
    expect(scheduled.lastError).toContain('network unavailable');
    const firstDelay = Date.parse(scheduled.nextAttemptAt ?? '') - Date.now();
    expect(firstDelay).toBeGreaterThanOrEqual(2000);
    expect(firstDelay).toBeLessThanOrEqual(2050);

    const secondSummary = await flushNurseQueue(fakeSp);
    expect(secondSummary.totalCount).toBe(0);
    expect(batchUpsertObservationsMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);

    const finalSummary = await flushNurseQueue(fakeSp);
    expect(finalSummary.sent).toBe(1);
    expect(finalSummary.errorCount).toBe(0);
    expect(queueState).toHaveLength(0);
    expect(batchUpsertObservationsMock).toHaveBeenCalledTimes(2);
  });

  it('escalates retry delays to 2s, 4s, then 8s on repeated failures', async () => {
    const baseItem: NurseQueueItem = {
      idempotencyKey: 'I077:observation:2025-11-07T09:03:00.000Z:retry-chain',
      type: 'observation',
      userId: 'I077',
      vitals: { temp: 37.4 },
      memo: '',
      tags: [],
      timestampUtc: '2025-11-07T09:03:00.000Z',
      localTz: 'Asia/Tokyo',
      source: 'observation.form',
    };
    queueState.push(baseItem);
    batchUpsertObservationsMock.mockResolvedValue([{ key: baseItem.idempotencyKey, ok: false, error: 'service unavailable', attempts: 1 }]);

    const expectedDelays = [2000, 4000, 8000];
    const observedDelays: number[] = [];

    for (const delay of expectedDelays) {
      const summary = await flushNurseQueue(fakeSp);
      expect(summary.errorCount).toBeGreaterThan(0);
      expect(queueState).toHaveLength(1);
      const scheduled = queueState[0];
      expect(scheduled.retryCount).toBeGreaterThanOrEqual(1);
      observedDelays.push(Date.parse(scheduled.nextAttemptAt ?? '') - Date.now());
      vi.advanceTimersByTime(delay);
    }

    expect(observedDelays[0]).toBeGreaterThanOrEqual(2000);
    expect(observedDelays[0]).toBeLessThanOrEqual(2050);
    expect(observedDelays[1]).toBeGreaterThanOrEqual(4000);
    expect(observedDelays[1]).toBeLessThanOrEqual(4050);
    expect(observedDelays[2]).toBeGreaterThanOrEqual(8000);
    expect(observedDelays[2]).toBeLessThanOrEqual(8050);
  expect(queueState[0]?.retryCount).toBe(3);
  });

  it('upserts the same minute twice and preserves memo changes', async () => {
    const first: NurseQueueItem = {
      idempotencyKey: 'I022:observation:2025-11-04T01:23:07Z:test',
      type: 'observation',
      userId: 'I022',
      vitals: { temp: 36.6, weight: 58.2 },
      memo: 'ok',
      tags: ['顔色良好'],
      timestampUtc: '2025-11-04T01:23:07Z',
      localTz: 'Asia/Tokyo',
      source: 'observation.form',
      retryCount: 0,
    };
    const second: NurseQueueItem = {
      ...first,
      idempotencyKey: 'I022:observation:2025-11-04T01:23:58Z:test',
      memo: 'update',
      timestampUtc: '2025-11-04T01:23:58Z',
    };

    batchUpsertObservationsMock
      .mockResolvedValueOnce([{ key: first.idempotencyKey, ok: true, id: 1, created: false, attempts: 1 }])
      .mockResolvedValueOnce([{ key: second.idempotencyKey, ok: true, id: 1, created: false, attempts: 1 }]);

    queueState.push(first);
    const firstResult = await flushNurseQueue(fakeSp);
    expect(firstResult.sent).toBe(1);
    expect(firstResult.remaining).toBe(0);
    expect(queueState).toHaveLength(0);

    queueState.push(second);
    const secondResult = await flushNurseQueue(fakeSp);
    expect(secondResult.sent).toBe(1);
    expect(secondResult.remaining).toBe(0);
    expect(queueState).toHaveLength(0);

    expect(batchUpsertObservationsMock).toHaveBeenCalledTimes(2);
    const calls = batchUpsertObservationsMock.mock.calls;
    const payloads = calls.map(([, , envelopes]) => envelopes[0].item);
    expect(String(payloads[0].ObservedAt).startsWith('2025-11-04T01:23')).toBe(true);
    expect(String(payloads[1].ObservedAt).startsWith('2025-11-04T01:23')).toBe(true);
    expect(payloads[0].Memo).toBe('ok');
    expect(payloads[1].Memo).toBe('update');
    expect(payloads[0].IdempotencyKey).toBe(first.idempotencyKey);
    expect(payloads[1].IdempotencyKey).toBe(second.idempotencyKey);
    expect(payloads[0]).not.toHaveProperty('Vital_Pulse');
    expect(payloads[0]).not.toHaveProperty('Vital_Sys');
    expect(payloads[0]).not.toHaveProperty('Vital_Dia');
    expect(payloads[0]).not.toHaveProperty('Vital_SpO2');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  setTelemetryTransport,
} from '@/features/nurse/telemetry/telemetry';
import { emitSkippedFieldTelemetry } from '@/lib/dataIntegrity/skippedFieldTelemetry';

describe('emitSkippedFieldTelemetry', () => {
  afterEach(() => {
    setTelemetryTransport(null);
  });

  it('does not emit when skippedFields is empty', () => {
    const transport = vi.fn();
    setTelemetryTransport(transport);

    emitSkippedFieldTelemetry({ listKey: 'users', skippedFields: [], count: 33, requestId: 'req-1' });

    expect(transport).not.toHaveBeenCalled();
  });

  it('emits one event per unique field', () => {
    const transport = vi.fn();
    setTelemetryTransport(transport);

    emitSkippedFieldTelemetry({ listKey: 'users', skippedFields: ['UserID'], count: 33, requestId: 'req-2' });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith('sp:field_skipped', expect.objectContaining({
      listKey: 'users',
      fieldName: 'UserID',
      screen: 'data-integrity',
      count: 33,
      requestId: 'req-2',
    }));
  });

  it('deduplicates repeated field names — emits once for ["UserID","UserID"]', () => {
    const transport = vi.fn();
    setTelemetryTransport(transport);

    emitSkippedFieldTelemetry({
      listKey: 'users',
      skippedFields: ['UserID', 'UserID'],
      count: 10,
      requestId: 'req-3',
    });

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('emits one event per distinct field when multiple unique fields are skipped', () => {
    const transport = vi.fn();
    setTelemetryTransport(transport);

    emitSkippedFieldTelemetry({
      listKey: 'daily',
      skippedFields: ['FieldA', 'FieldB', 'FieldA'],
      count: 5,
      requestId: 'req-4',
    });

    expect(transport).toHaveBeenCalledTimes(2);
    const calledFields = transport.mock.calls.map((c) => (c[1] as Record<string, unknown>).fieldName);
    expect(calledFields).toEqual(expect.arrayContaining(['FieldA', 'FieldB']));
  });

  it('payload includes listKey, fieldName, count, requestId, and ts', () => {
    const transport = vi.fn();
    setTelemetryTransport(transport);

    const before = Date.now();
    emitSkippedFieldTelemetry({ listKey: 'schedules', skippedFields: ['Status'], count: 7, requestId: 'req-5' });
    const after = Date.now();

    const payload = transport.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.listKey).toBe('schedules');
    expect(payload.fieldName).toBe('Status');
    expect(payload.count).toBe(7);
    expect(payload.requestId).toBe('req-5');
    expect(typeof payload.ts).toBe('number');
    expect(payload.ts as number).toBeGreaterThanOrEqual(before);
    expect(payload.ts as number).toBeLessThanOrEqual(after);
  });

  it('does not throw when emitTelemetry transport throws — main flow is protected', () => {
    setTelemetryTransport(() => { throw new Error('transport failure'); });

    expect(() =>
      emitSkippedFieldTelemetry({ listKey: 'users', skippedFields: ['UserID'], count: 1, requestId: 'req-6' }),
    ).not.toThrow();
  });
});

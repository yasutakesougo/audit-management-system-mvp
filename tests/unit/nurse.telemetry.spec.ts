import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  emitTelemetry,
  setTelemetryTransport,
  type NurseTelemetryEvent,
} from '@/features/nurse/telemetry/telemetry';

describe('nurse telemetry', () => {
  afterEach(() => {
    setTelemetryTransport(null);
  });

  it('forwards events to the configured transport', () => {
    const handler = vi.fn();
    const payload = { flushed: 4 };

    setTelemetryTransport(handler);
    emitTelemetry('nurse_queue_flushed_total', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('nurse_queue_flushed_total', payload);
  });

  it('logs for visibility when no transport is configured in non-production environments', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const event: NurseTelemetryEvent = 'nurse_queue_failed_total';
    const payload = { reason: 'network' };
    emitTelemetry(event, payload);

    expect(debugSpy).toHaveBeenCalledWith(`[telemetry:nurse] ${event}`, payload);

    debugSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});

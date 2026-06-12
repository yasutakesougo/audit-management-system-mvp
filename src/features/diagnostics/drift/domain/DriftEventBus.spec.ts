import { describe, expect, it, vi } from 'vitest';
import { driftEventBus } from './DriftEventBus';

describe('drift event bus', () => {
  it('subscribes and unsubscribes listeners', () => {
    const received: string[] = [];

    const unsubscribe = driftEventBus.subscribe((event) => {
      received.push(event.driftType ?? '');
    });

    driftEventBus.emit({
      listName: 'Daily_Attendance',
      fieldName: 'Status',
      detectedAt: '2026-06-12T00:00:00.000Z',
      severity: 'warn',
      resolutionType: 'fuzzy_match',
      driftType: 'fuzzy_match',
      resolved: false,
    });

    expect(received).toEqual(['fuzzy_match']);

    unsubscribe();

    driftEventBus.emit({
      listName: 'Daily_Attendance',
      fieldName: 'Status',
      detectedAt: '2026-06-12T00:00:01.000Z',
      severity: 'warn',
      resolutionType: 'manual',
      driftType: 'unknown',
      resolved: true,
    });

    expect(received).toEqual(['fuzzy_match']);
  });

  it('continues when a listener throws and logs error', () => {
    const received: string[] = [];
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const unsubscribeThrowing = driftEventBus.subscribe(() => {
      throw new Error('listener failure');
    });
    const unsubscribeHealthy = driftEventBus.subscribe((event) => {
      received.push(event.fieldName);
    });

    driftEventBus.emit({
      listName: 'SupportCase',
      fieldName: 'BillingField',
      detectedAt: '2026-06-12T00:00:02.000Z',
      severity: 'info',
      resolutionType: 'manual',
      driftType: 'case_mismatch',
      resolved: true,
      remediationSource: 'ui',
    });

    unsubscribeThrowing();
    unsubscribeHealthy();

    expect(received).toEqual(['BillingField']);
    expect(consoleSpy).toHaveBeenCalledWith(
      'DriftEventBus: Error in listener',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});

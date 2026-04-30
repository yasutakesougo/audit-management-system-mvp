import { afterEach, describe, expect, it, vi } from 'vitest';
import { DriftObserver } from '../DriftObserver';
import { driftEventBus } from '../../domain/DriftEventBus';

describe('DriftObserver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps fail-open behavior even if repository.logEvent rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const repository = {
      logEvent: vi.fn(async () => {
        throw new Error('write failed');
      }),
    };

    const observer = new DriftObserver(repository);
    observer.start();

    driftEventBus.emit({
      listName: 'Daily_Attendance',
      fieldName: 'Status',
      detectedAt: '2026-04-30T00:00:00.000Z',
      severity: 'warn',
      resolutionType: 'fallback',
      driftType: 'suffix_mismatch',
      resolved: false,
    });

    await Promise.resolve();

    expect(repository.logEvent).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'DriftObserver: drift logging skipped due to repository failure.',
      expect.any(Error),
    );

    observer.stop();
  });
});

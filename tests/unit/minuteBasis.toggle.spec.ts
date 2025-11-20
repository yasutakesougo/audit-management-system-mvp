import { minuteLabel, minuteWindow } from '@/features/nurse/sp/minuteWindow';
import { formatLastSyncCaption, type LastSyncState } from '@/features/nurse/state/useLastSync';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ISO_SAMPLE = '2025-11-05T00:12:34Z';

const buildState = (overrides: Partial<LastSyncState>): LastSyncState => ({
  status: 'idle',
  source: 'manual',
  sent: 0,
  remaining: 0,
  summary: undefined,
  ...overrides,
});

describe('minute-basis toggle', () => {
  afterEach(() => {
    vi.useRealTimers();
    if (typeof vi.unstubAllEnvs === 'function') {
      vi.unstubAllEnvs();
    }
  });

  it('UTC basis: window boundaries and caption stay aligned', () => {
    vi.stubEnv('VITE_NURSE_MINUTE_BASIS', 'utc');
    const [startIso, endIso] = minuteWindow(ISO_SAMPLE);
    expect(startIso).toBe('2025-11-05T00:12:00.000Z');
    expect(endIso).toBe('2025-11-05T00:13:00.000Z');

    const state = buildState({
      status: 'idle',
      updatedAt: new Date(ISO_SAMPLE).toISOString(),
      source: 'manual',
    });
    const caption = formatLastSyncCaption(state);
    expect(caption).toBe('未同期');
  });

  it('Local basis: exclusive range and caption use local time label', () => {
    vi.stubEnv('VITE_NURSE_MINUTE_BASIS', 'local');
    const [startIso, endIso] = minuteWindow(ISO_SAMPLE);
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    expect(end - start).toBe(60_000);
    const label = minuteLabel(ISO_SAMPLE, 'local');
    expect(label.endsWith('T09:12')).toBe(true);

    const state = buildState({
      status: 'success',
      updatedAt: new Date(ISO_SAMPLE).toISOString(),
      source: 'online',
      sent: 1,
      remaining: 2,
    });
    const caption = formatLastSyncCaption(state);
    expect(caption).toBe('同期済み 1件');
  });
});

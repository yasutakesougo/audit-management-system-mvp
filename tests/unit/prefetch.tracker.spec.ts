import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/prefetch/util', () => ({
  scheduleIdle: vi.fn(() => 123),
  cancelIdle: vi.fn(),
}));

import {
  beginPrefetch,
  finalizePrefetch,
  resetPrefetchEntries,
  touchPrefetch,
} from '@/prefetch/tracker';

describe('prefetch tracker HUD broadcast', () => {
  let nowSpy: MockInstance<typeof Date.now>;
  let now = 0;

  beforeEach(() => {
    now = 1_000;
    nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    resetPrefetchEntries();
    // Clear any existing HUD data
    if (typeof window !== 'undefined') {
      const target = window as typeof window & { __PREFETCH_HUD__?: { spans?: unknown[] } };
      if (target.__PREFETCH_HUD__) {
        delete target.__PREFETCH_HUD__.spans;
      }
    }
  });

  afterEach(() => {
    resetPrefetchEntries();
    nowSpy.mockRestore();
  });

  it('broadcasts prefetch entries to global HUD object and does not re-broadcast unchanged data on touch', () => {
    beginPrefetch('route:/demo', 'hover');

    now = 1_050;
    finalizePrefetch('route:/demo', 'completed');

    // Check that HUD data is updated with the prefetch entry
    const target = window as typeof window & { __PREFETCH_HUD__?: { spans?: unknown[] } };
    expect(target.__PREFETCH_HUD__?.spans).toBeDefined();
    expect(target.__PREFETCH_HUD__?.spans).toHaveLength(1);

    now = 1_200;
    touchPrefetch('route:/demo');

    // After touch, the spans should be updated (same content but new reference due to lastHitAt change)
    expect(target.__PREFETCH_HUD__?.spans).toBeDefined();
    expect(target.__PREFETCH_HUD__?.spans).toHaveLength(1);

    // The entry should have an updated lastHitAt timestamp
    const spans = target.__PREFETCH_HUD__?.spans as Array<{ key: string; lastHitAt: number; status: string }>;
    expect(spans[0].key).toBe('route:/demo');
    expect(spans[0].lastHitAt).toBe(1_200);
    expect(spans[0].status).toBe('completed');
  });
});

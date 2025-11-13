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
  let dispatchSpy: MockInstance<typeof window.dispatchEvent>;
  let nowSpy: MockInstance<typeof Date.now>;
  let now = 0;

  beforeEach(() => {
    now = 1_000;
  nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
  dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    resetPrefetchEntries();
    dispatchSpy.mockClear();
  });

  afterEach(() => {
    resetPrefetchEntries();
    dispatchSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('does not re-dispatch navshell HUD show events when the broadcast token is unchanged', () => {
    beginPrefetch('route:/demo', 'hover');

    now = 1_050;
    finalizePrefetch('route:/demo', 'completed');

    const countHudShowEvents = (): number =>
      dispatchSpy.mock.calls.reduce((count, [evt]) => (evt.type === 'navshell:hud:show' ? count + 1 : count), 0);

    const initialShowCount = countHudShowEvents();
    expect(initialShowCount).toBeGreaterThan(0);

    dispatchSpy.mockClear();

    now = 1_200;
    touchPrefetch('route:/demo');

    const repeatShowCount = countHudShowEvents();
    expect(repeatShowCount).toBe(0);
  });
});

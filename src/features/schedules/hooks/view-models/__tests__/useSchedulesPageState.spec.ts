import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildNextSlot } from '../useSchedulesPageState';

describe('buildNextSlot', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to the default slot when the next hour would cross midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 22, 58));

    const slot = buildNextSlot('2026-07-13');

    expect(slot.start.getHours()).toBe(10);
    expect(slot.start.getMinutes()).toBe(0);
    expect(slot.end.getHours()).toBe(11);
    expect(slot.end.getMinutes()).toBe(0);
    expect(slot.end.getDate()).toBe(slot.start.getDate());
  });

  it('keeps a rounded same-day slot before the midnight boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 21, 58));

    const slot = buildNextSlot('2026-07-13');

    expect(slot.start.getHours()).toBe(22);
    expect(slot.start.getMinutes()).toBe(0);
    expect(slot.end.getHours()).toBe(23);
    expect(slot.end.getMinutes()).toBe(0);
    expect(slot.end.getDate()).toBe(slot.start.getDate());
  });
});

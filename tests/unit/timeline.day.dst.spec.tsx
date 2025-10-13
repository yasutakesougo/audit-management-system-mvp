import type { Schedule } from '@/features/schedule/types';
import { cleanup, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const ORIGINAL_SCHEDULES_TZ = process.env.VITE_SCHEDULES_TZ;
const ORIGINAL_TZ = process.env.TZ;

let TimelineDay: typeof import('@/features/schedule/views/TimelineDay').default;

describe('TimelineDay hour slots across DST', () => {
  beforeAll(async () => {
    process.env.VITE_SCHEDULES_TZ = 'America/Los_Angeles';
    process.env.TZ = 'America/Los_Angeles';
    vi.resetModules();
    const envMod = await import('@/lib/env');
    envMod.__resetAppConfigForTests();
    ({ default: TimelineDay } = await import('@/features/schedule/views/TimelineDay'));
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(async () => {
    if (ORIGINAL_SCHEDULES_TZ === undefined) {
      delete process.env.VITE_SCHEDULES_TZ;
    } else {
      process.env.VITE_SCHEDULES_TZ = ORIGINAL_SCHEDULES_TZ;
    }
    if (ORIGINAL_TZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = ORIGINAL_TZ;
    }
    vi.resetModules();
    const envMod = await import('@/lib/env');
    envMod.__resetAppConfigForTests();
  });

  it('renders repeated 03:00 slot when DST skips 02:00 locally', () => {
    const events: Schedule[] = [];
    const { getAllByTestId } = render(
      <TimelineDay events={events} date={new Date('2025-03-09T10:15:00-08:00')} />
    );

    const slots = getAllByTestId('hour-slot');
    expect(slots).toHaveLength(18);
    const labels = slots.map((slot) => slot.getAttribute('data-hour'));
    expect(labels[0]).toBe('06:00');
    expect(labels[labels.length - 1]).toBe('23:00');
    expect(new Set(labels).size).toBe(labels.length);
  });
});

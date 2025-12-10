import { minuteLabel, minuteWindow } from '@/features/nurse/sp/minuteWindow';
import { describe, expect, it } from 'vitest';

describe('minuteWindow helpers', () => {
  it('derives the same UTC window for any timestamp inside the minute', () => {
    const [startA, endA] = minuteWindow('2025-03-10T01:23:07.123Z', 'utc');
    const [startB, endB] = minuteWindow('2025-03-10T01:23:59.999Z', 'utc');

    expect(startA).toBe(startB);
    expect(endA).toBe(endB);
    expect(startA.endsWith(':23:00.000Z')).toBe(true);
  expect(endA.endsWith(':24:00.000Z')).toBe(true);
  });

  it('mirrors the local clock when requested', () => {
    const [start] = minuteWindow('2025-11-04T09:15:22+09:00', 'local');
    expect(minuteLabel(start, 'local')).toBe('2025-11-04T09:15');
  });

  it('provides minute labels for logging and metrics', () => {
    const labelUtc = minuteLabel('2025-11-04T00:45:00Z', 'utc');
    const labelLocal = minuteLabel('2025-11-04T09:45:00+09:00', 'local');

    expect(labelUtc).toBe('2025-11-04T00:45');
    expect(labelLocal).toBe('2025-11-04T09:45');
  });
});

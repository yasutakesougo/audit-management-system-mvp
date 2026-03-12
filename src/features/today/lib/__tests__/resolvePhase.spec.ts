import { describe, it, expect } from 'vitest';
import { resolvePhase } from '../resolvePhase';

describe('resolvePhase', () => {
  it.each([
    // 深夜・早朝 → morning
    [0, 'morning'],
    [3, 'morning'],
    [6, 'morning'],

    // 朝の運用
    [7, 'morning'],
    [10, 'morning'],

    // 境界: midday 開始
    [11, 'midday'],
    [13, 'midday'],
    [15, 'midday'],

    // 境界: evening 開始
    [16, 'evening'],
    [19, 'evening'],
    [23, 'evening'],
  ] as const)('resolvePhase(%i) → %s', (hour, expected) => {
    expect(resolvePhase(hour)).toBe(expected);
  });
});

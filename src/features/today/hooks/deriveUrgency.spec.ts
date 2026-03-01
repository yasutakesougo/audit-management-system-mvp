import { describe, expect, it } from 'vitest';
import { deriveUrgency } from './useNextAction';

describe('deriveUrgency', () => {
  // Boundary: exactly 10 → high
  it('returns high when minutesUntil <= 10', () => {
    expect(deriveUrgency(0)).toBe('high');
    expect(deriveUrgency(5)).toBe('high');
    expect(deriveUrgency(10)).toBe('high');
  });

  // Boundary: 11 → medium
  it('returns medium when minutesUntil is 11-30', () => {
    expect(deriveUrgency(11)).toBe('medium');
    expect(deriveUrgency(20)).toBe('medium');
    expect(deriveUrgency(30)).toBe('medium');
  });

  // Boundary: 31 → low
  it('returns low when minutesUntil > 30', () => {
    expect(deriveUrgency(31)).toBe('low');
    expect(deriveUrgency(60)).toBe('low');
    expect(deriveUrgency(120)).toBe('low');
  });

  // Edge: negative (past item, shouldn't happen but safe)
  it('returns high for negative minutesUntil', () => {
    expect(deriveUrgency(-1)).toBe('high');
  });
});

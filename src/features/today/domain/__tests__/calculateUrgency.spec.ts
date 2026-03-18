import { describe, expect, it } from 'vitest';
import { calculateUrgency } from '../engine/calculateUrgency';

describe('calculateUrgency', () => {
  it('targetTime がない場合は score=0 / isOverdue=false', () => {
    const now = new Date('2026-03-18T12:00:00');
    expect(calculateUrgency(undefined, now)).toEqual({
      score: 0,
      isOverdue: false,
    });
  });

  it('予定時刻前は低スコアになる', () => {
    const now = new Date('2026-03-18T12:00:00');
    const target = new Date('2026-03-18T12:30:00');

    const result = calculateUrgency(target, now, 15);

    expect(result.isOverdue).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(50);
  });

  it('SLA超過時は isOverdue=true かつスコアが大きく跳ね上がる', () => {
    const now = new Date('2026-03-18T13:20:00');
    const target = new Date('2026-03-18T13:00:00');

    const result = calculateUrgency(target, now, 15);

    expect(result.isOverdue).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(100);
  });
});

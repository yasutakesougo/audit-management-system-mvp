import { describe, expect, it } from 'vitest';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';

describe('getScheduleKey normalization', () => {
  it('normalizes whitespace and trims plannedActivity', () => {
    const a = getScheduleKey('09:00', '朝の受け入れ');
    const b = getScheduleKey('09:00', ' 朝の受け入れ ');
    const c = getScheduleKey('09:00', '朝の  受け入れ');

    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('handles empty plannedActivity consistently', () => {
    const a = getScheduleKey('09:00', undefined);
    const b = getScheduleKey('09:00', '');
    const c = getScheduleKey('09:00', '   ');

    expect(a).toBe(b);
    expect(a).toBe(c);
  });
});

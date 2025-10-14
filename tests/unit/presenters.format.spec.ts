import { describe, expect, it } from 'vitest';
import { formatOrgSubtitle } from '@/features/schedule/presenters/format';

describe('formatOrgSubtitle', () => {
  it('prefers audience list and trims location when present', () => {
    const result = formatOrgSubtitle({
      audience: ['全体', '夜勤'],
      location: ' 多目的室 ',
      start: 'ignored-start',
      end: 'ignored-end',
    });

    expect(result).toBe('全体, 夜勤 / 多目的室');
  });

  it('falls back to targetUserNames when audience is empty', () => {
    const result = formatOrgSubtitle({
      audience: [],
      targetUserNames: ['田中', '佐藤'],
      location: null,
    });

    expect(result).toBe('田中, 佐藤');
  });

  it('returns formatted start-end range when no audience or location metadata exists', () => {
    const result = formatOrgSubtitle({
      startLocal: '2025-03-10 09:00',
      start: '2025-03-10T00:00:00Z',
      startUtc: '2025-03-09T23:00:00Z',
      endLocal: null,
      end: '2025-03-10T12:00:00Z',
      endUtc: '2025-03-10T11:00:00Z',
      targetUserNames: [],
    });

    expect(result).toBe('2025-03-10 09:00 - 2025-03-10T12:00:00Z');
  });
});

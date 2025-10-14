import { describe, expect, it } from 'vitest';
import { validateUserCare } from '@/features/schedule/validation';
import type { ScheduleUserCare } from '@/features/schedule/types';

const buildDraft = (overrides: Partial<ScheduleUserCare> = {}): Partial<ScheduleUserCare> => ({
  category: 'User',
  serviceType: 'ショートステイ',
  personType: 'Internal',
  personId: 'user-001',
  start: '2025-01-01T00:00:00Z',
  end: '2025-01-01T01:00:00Z',
  allDay: false,
  staffIds: ['staff-1'],
  ...overrides,
});

describe('validation(UserCare) – missing staff / external name / chronology', () => {
  it('rejects when staff assignment is empty', () => {
    const draft = buildDraft({ staffIds: [] });
    expect(() => validateUserCare(draft)).toThrow(/職員|staff/i);
  });

  it('rejects external care without externalPersonName', () => {
    const draft = buildDraft({
      personType: 'External',
      personId: undefined,
      externalPersonName: '   ',
    });
    expect(() => validateUserCare(draft)).toThrow(/外部|氏名|name/i);
  });

  it('rejects when end precedes start', () => {
    const draft = buildDraft({
      start: '2025-01-01T02:00:00Z',
      end: '2025-01-01T01:00:00Z',
    });
    expect(() => validateUserCare(draft)).toThrow(/終了/);
  });

  it('accepts all-day entries with date-only ISO strings', () => {
    const draft = buildDraft({
      allDay: true,
      start: '2025-01-01',
      end: '2025-01-02',
    });
    expect(() => validateUserCare(draft)).not.toThrow();
  });
});

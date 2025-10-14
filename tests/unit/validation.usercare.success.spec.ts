import { describe, it, expect } from 'vitest';
import { validateUserCare } from '@/features/schedule/validation';
import type { ScheduleUserCare } from '@/features/schedule/types';

describe('validation(UserCare) – happy path', () => {
  const baseDraft: Partial<ScheduleUserCare> = {
    category: 'User',
    serviceType: 'ショートステイ',
    personType: 'External',
    externalPersonName: '山田太郎',
    staffIds: ['21'],
    start: '2025-02-03T00:00:00Z',
    end: '2025-02-03T23:59:59Z',
    allDay: true,
  };

  it('accepts external all-day entries when required fields are present', () => {
    expect(() => validateUserCare(baseDraft)).not.toThrow();
  });

  it('accepts internal time-bound entries with chronological order', () => {
    const internalDraft: Partial<ScheduleUserCare> = {
      ...baseDraft,
      personType: 'Internal',
      personId: 'user-001',
      personName: '田中太郎',
      externalPersonName: undefined,
      allDay: false,
      start: '2025-02-03T09:00:00Z',
      end: '2025-02-03T10:00:00Z',
    };

    expect(() => validateUserCare(internalDraft)).not.toThrow();
  });
});

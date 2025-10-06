import { describe, expect, test } from 'vitest';
import { validateUserCare } from '../validation';
import type { ScheduleUserCare } from '../types';

describe('validateUserCare', () => {
  test('external user-care requires externalPersonName', () => {
    expect(() =>
      validateUserCare({
        category: 'User',
        serviceType: '一時ケア',
        personType: 'External',
        externalPersonName: '山本 さくら',
        start: '2025-10-03T10:00:00+09:00',
        end: '2025-10-03T15:00:00+09:00',
        allDay: false,
        staffIds: ['sakamoto'],
      } satisfies Partial<ScheduleUserCare>),
    ).not.toThrow();
  });

  test('temp care cannot be all-day', () => {
    expect(() =>
      validateUserCare({
        category: 'User',
        serviceType: '一時ケア',
        personType: 'Internal',
        personId: 'U001',
        start: '2025-10-03T10:00:00+09:00',
        end: '2025-10-03T15:00:00+09:00',
        allDay: true, // ❌
        staffIds: ['sakamoto'],
      } satisfies Partial<ScheduleUserCare>),
    ).toThrow(/終日/);
  });
});

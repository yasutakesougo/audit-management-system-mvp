import { describe, expect, it } from 'vitest';

import { normalizeUserId, toSharePointPayload } from './createAdapters';
import type { CreateScheduleEventInput } from './port';
import { SCHEDULES_FIELDS } from './spSchema';

describe('createAdapters helpers', () => {
  const baseInput: Pick<CreateScheduleEventInput, 'startLocal' | 'endLocal' | 'serviceType' | 'title'> = {
    title: 'test',
    startLocal: '2025-11-26T10:00',
    endLocal: '2025-11-26T11:00',
    serviceType: 'normal',
  };

  it('keeps assignedStaffId as a string for Staff schedules', () => {
    const input: CreateScheduleEventInput = {
      ...baseInput,
      category: 'Staff',
      assignedStaffId: '12',
    };

    const payload = toSharePointPayload(input);
    expect(payload.body[SCHEDULES_FIELDS.assignedStaff]).toBe('12');
  });

  it('normalizes userId for User schedules', () => {
    expect(normalizeUserId('U-001')).toBe('U001');

    const input: CreateScheduleEventInput = {
      ...baseInput,
      category: 'User',
      userId: 'U-001',
      userLookupId: '42',
      userName: 'テスト利用者',
    };

    const payload = toSharePointPayload(input);
    expect(payload.body[SCHEDULES_FIELDS.personId]).toBe('U001');
    expect(payload.body[SCHEDULES_FIELDS.personName]).toBe('テスト利用者');
    expect(payload.body[SCHEDULES_FIELDS.targetUserId]).toBe(42);
  });

  it('allows Org schedules without user or staff IDs', () => {
    const input: CreateScheduleEventInput = {
      ...baseInput,
      category: 'Org',
    };

    const payload = toSharePointPayload(input);
    expect(payload.body[SCHEDULES_FIELDS.personId]).toBeNull();
    expect(payload.body[SCHEDULES_FIELDS.personName]).toBeNull();
    expect(payload.body[SCHEDULES_FIELDS.targetUserId]).toBeNull();
    expect(payload.body[SCHEDULES_FIELDS.assignedStaff]).toBeUndefined();
  });
});

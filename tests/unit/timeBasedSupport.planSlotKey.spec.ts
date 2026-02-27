import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import { useTimeBasedSupportRecordPage } from '@/pages/hooks/useTimeBasedSupportRecordPage';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const schedule = [
  {
    time: '09:00',
    activity: '朝の受け入れ',
    instruction: '挨拶と体調確認',
    isKey: false,
  },
];

const scheduleKey = getScheduleKey('09:00', '朝の受け入れ');

const makeProcedureRepo = () => ({
  getByUser: vi.fn(() => schedule),
  save: vi.fn(),
});

const makeBehaviorRepo = () => ({
  fetchByUser: vi.fn(async () => undefined),
  add: vi.fn(async () => {
    throw new Error('not used in this test');
  }),
});

describe('useTimeBasedSupportRecordPage planSlotKey matching', () => {
  it('marks plan row as filled when observation has planSlotKey (even if recorded time differs)', () => {
    const behaviorRecords: BehaviorObservation[] = [
      {
        id: 'obs-1',
        userId: 'u1',
        recordedAt: new Date('2026-02-22T09:15:00+09:00').toISOString(),
        planSlotKey: scheduleKey,
        timeSlot: '09:15',
        plannedActivity: '実測時刻入力',
        antecedent: '',
        antecedentTags: [],
        behavior: '日常記録',
        consequence: '',
        intensity: 1,
        actualObservation: '問題なし',
      },
    ];

    const { result } = renderHook(() =>
      useTimeBasedSupportRecordPage({
        procedureRepo: makeProcedureRepo(),
        behaviorRepo: makeBehaviorRepo(),
        behaviorRecords,
        initialUserId: 'u1',
      }),
    );

    expect(result.current.filledStepIds.has(scheduleKey)).toBe(true);
    expect(result.current.unfilledStepsCount).toBe(0);
  });

  it('keeps backward compatibility via timeSlot+plannedActivity when planSlotKey is missing', () => {
    const behaviorRecords: BehaviorObservation[] = [
      {
        id: 'obs-2',
        userId: 'u1',
        recordedAt: new Date('2026-02-22T09:00:00+09:00').toISOString(),
        timeSlot: '09:00',
        plannedActivity: '朝の受け入れ',
        antecedent: '',
        antecedentTags: [],
        behavior: '日常記録',
        consequence: '',
        intensity: 1,
      },
    ];

    const { result } = renderHook(() =>
      useTimeBasedSupportRecordPage({
        procedureRepo: makeProcedureRepo(),
        behaviorRepo: makeBehaviorRepo(),
        behaviorRecords,
        initialUserId: 'u1',
      }),
    );

    expect(result.current.filledStepIds.has(scheduleKey)).toBe(true);
    expect(result.current.unfilledStepsCount).toBe(0);
  });
});

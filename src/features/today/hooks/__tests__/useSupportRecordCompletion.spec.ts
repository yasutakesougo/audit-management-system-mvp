import { describe, expect, it } from 'vitest';
import { computeSupportRecordCompletion } from '../useSupportRecordCompletion';

describe('computeSupportRecordCompletion', () => {
  const slots: Record<string, number> = {
    'U001': 8,
    'U002': 6,
    'U003': 8,
  };

  it('marks a user as complete when all slots are recorded', () => {
    const result = computeSupportRecordCompletion(
      ['U001'],
      (uid) => slots[uid] ?? 0,
      () => 8, // all 8 recorded
    );

    expect(result.total).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.pending).toBe(0);
    expect(result.pendingUserIds).toEqual([]);
    expect(result.byUser[0]).toMatchObject({
      userId: 'U001',
      totalSlots: 8,
      recordedSlots: 8,
      isComplete: true,
      rate: 1,
    });
  });

  it('marks a user as pending when some slots are unrecorded', () => {
    const result = computeSupportRecordCompletion(
      ['U001'],
      (uid) => slots[uid] ?? 0,
      () => 3, // only 3 of 8
    );

    expect(result.completed).toBe(0);
    expect(result.pending).toBe(1);
    expect(result.pendingUserIds).toEqual(['U001']);
    expect(result.byUser[0]).toMatchObject({
      isComplete: false,
      rate: 3 / 8,
    });
  });

  it('handles zero-slot users as not-complete', () => {
    const result = computeSupportRecordCompletion(
      ['U999'],
      () => 0, // no slots defined
      () => 0,
    );

    expect(result.byUser[0]).toMatchObject({
      isComplete: false,
      rate: 0,
    });
    expect(result.pending).toBe(1);
  });

  it('handles multiple users with mixed completion', () => {
    const recorded: Record<string, number> = {
      'U001': 8,
      'U002': 2,
      'U003': 0,
    };

    const result = computeSupportRecordCompletion(
      ['U001', 'U002', 'U003'],
      (uid) => slots[uid] ?? 0,
      (uid) => recorded[uid] ?? 0,
    );

    expect(result.total).toBe(3);
    expect(result.completed).toBe(1);
    expect(result.pending).toBe(2);
    expect(result.pendingUserIds).toEqual(['U002', 'U003']);
  });

  it('returns empty summary for empty userIds', () => {
    const result = computeSupportRecordCompletion(
      [],
      () => 8,
      () => 0,
    );

    expect(result.total).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.pendingUserIds).toEqual([]);
    expect(result.byUser).toEqual([]);
  });

  it('caps rate at 1 even if recorded > total (data inconsistency)', () => {
    const result = computeSupportRecordCompletion(
      ['U001'],
      () => 5,
      () => 10, // more records than slots (edge case)
    );

    expect(result.byUser[0]?.rate).toBe(1);
    expect(result.byUser[0]?.isComplete).toBe(true);
  });
});

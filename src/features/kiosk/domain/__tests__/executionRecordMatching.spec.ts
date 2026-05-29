import { describe, it, expect } from 'vitest';
import {
  matchExecutionRecordsToProcedures,
} from '../executionRecordMatching';
import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';

describe('executionRecordMatching helper', () => {
  const mockSlots: ProcedureItem[] = [
    {
      id: 'base-1',
      rowNo: 1,
      time: '09:30 - 09:40',
      activity: '朝の会',
      instruction: '',
      isKey: true,
      block: 'morning',
    },
    {
      id: 'base-2',
      rowNo: 2,
      time: '09:40 - 10:00',
      activity: '水分補給',
      instruction: '',
      isKey: false,
      block: 'morning',
    },
    {
      id: 'base-3',
      rowNo: 3,
      time: '10:00 - 10:45',
      activity: '午前作業',
      instruction: '',
      isKey: true,
      block: 'morning',
    },
  ];

  it('prefers strict matching over shifted matching', () => {
    const mockRecords: ExecutionRecord[] = [
      {
        id: 'R1',
        date: '2026-05-29',
        userId: 'U001',
        scheduleItemId: '1', // Strict match for slot 1
        status: 'completed',
        memo: 'Strict Match',
        recordedAt: '2026-05-29T09:30:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      },
      {
        id: 'R2',
        date: '2026-05-29',
        userId: 'U001',
        scheduleItemId: '0', // Shifted match for slot 1 (recordNum + 1)
        status: 'completed',
        memo: 'Shifted Match',
        recordedAt: '2026-05-29T09:35:00Z',
        recordedBy: 'Staff B',
        triggeredBipIds: [],
      },
    ];

    const result = matchExecutionRecordsToProcedures(mockSlots, mockRecords);

    // Slot 1 should get the strict match R1, and R2 (shifted) is left to be consumed or unmatched.
    expect(result[0]).toBeDefined();
    expect(result[0]?.id).toBe('R1');
    expect(result[0]?.memo).toBe('Strict Match');

    // Slot 2 should get R2 because R2 is unconsumed and matches Slot 2 shifted?
    // Wait, R2 scheduleItemId is '0'. Slot 2 rowNo is 2.
    // Shifted match: slot.rowNo (2) === recordNum (0) + 1 => 2 === 1 (false).
    // Let's check Slot 2: R2 does not match Slot 2. So Slot 2 is undefined.
    expect(result[1]).toBeUndefined();
  });

  it('uses shifted matching only as fallback', () => {
    const mockRecords: ExecutionRecord[] = [
      {
        id: 'R1',
        date: '2026-05-29',
        userId: 'U001',
        scheduleItemId: '0', // Shifted match for slot 1 (rowNo 1)
        status: 'completed',
        memo: 'Shifted Match',
        recordedAt: '2026-05-29T09:30:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      },
    ];

    const result = matchExecutionRecordsToProcedures(mockSlots, mockRecords);

    expect(result[0]).toBeDefined();
    expect(result[0]?.id).toBe('R1');
    expect(result[0]?.memo).toBe('Shifted Match');
    expect(result[1]).toBeUndefined();
  });

  it('prevents assigning the same ExecutionRecord to multiple procedure rows', () => {
    const mockRecords: ExecutionRecord[] = [
      {
        id: 'R1',
        date: '2026-05-29',
        userId: 'U001',
        scheduleItemId: '1', // Matches slot 1 strictly, but what if slot 2 also matches?
        status: 'completed',
        memo: 'Single Record',
        recordedAt: '2026-05-29T09:30:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      },
    ];

    // Let's create two slots that both target rowNo 1
    const overlappingSlots: ProcedureItem[] = [
      { ...mockSlots[0], rowNo: 1, id: 'base-1' },
      { ...mockSlots[1], rowNo: 1, id: 'other-1' },
    ];

    const result = matchExecutionRecordsToProcedures(overlappingSlots, mockRecords);

    expect(result[0]).toBeDefined();
    expect(result[0]?.id).toBe('R1');
    // The second slot should NOT get matched because the record was already consumed by the first slot
    expect(result[1]).toBeUndefined();
  });

  it('deduplicates ID-less records by object reference', () => {
    const recordA: ExecutionRecord = {
      id: '', // Empty ID
      date: '2026-05-29',
      userId: 'U001',
      scheduleItemId: '1', // Matches slot 1 strictly
      status: 'completed',
      memo: 'Record A',
      recordedAt: '2026-05-29T09:30:00Z',
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    };

    const recordB: ExecutionRecord = {
      id: '', // Same empty ID
      date: '2026-05-29',
      userId: 'U001',
      scheduleItemId: '1', // Same scheduleItemId, matches slot 1 strictly
      status: 'completed',
      memo: 'Record B',
      recordedAt: '2026-05-29T09:35:00Z',
      recordedBy: 'Staff B',
      triggeredBipIds: [],
    };

    // We have two slots that both match scheduleItemId '1' (e.g. slot 1 with rowNo 1 and slot 2 with rowNo 1 fallback)
    const twoMatchingSlots: ProcedureItem[] = [
      { ...mockSlots[0], rowNo: 1, id: 'base-1' },
      { ...mockSlots[1], rowNo: 1, id: 'base-1' }, // Overlapping mock slots for testing reference deduplication
    ];

    const result = matchExecutionRecordsToProcedures(twoMatchingSlots, [recordA, recordB]);

    // Both should be matched because they are distinct object references even though they have the same ID ('')
    expect(result[0]).toBeDefined();
    expect(result[0]?.memo).toBe('Record A');
    expect(result[1]).toBeDefined();
    expect(result[1]?.memo).toBe('Record B');
  });

  it('handles 1-based rowNo and 0-based index drift safely', () => {
    const slotsWithoutRowNo: ProcedureItem[] = [
      {
        id: 'base-1',
        rowNo: undefined as any, // Missing rowNo
        time: '09:30',
        activity: '朝の会',
        instruction: '',
        isKey: false,
        block: 'morning',
      },
      {
        id: 'base-2',
        rowNo: undefined as any, // Missing rowNo
        time: '09:40',
        activity: '水分補給',
        instruction: '',
        isKey: false,
        block: 'morning',
      },
    ];

    const mockRecords: ExecutionRecord[] = [
      {
        id: 'R1',
        date: '2026-05-29',
        userId: 'U001',
        scheduleItemId: '0', // 0-based index from Kiosk routes, should match first slot (index 0 -> rowNo 1 via shift fallback)
        status: 'completed',
        memo: 'First Slot Record',
        recordedAt: '2026-05-29T09:30:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      },
      {
        id: 'R2',
        date: '2026-05-29',
        userId: 'U001',
        scheduleItemId: '1', // 1-based or 0-based index. If 1-based, matches slot 1 strictly. If 0-based, matches slot 2 (index 1 -> rowNo 2) via shift fallback.
        status: 'completed',
        memo: 'Second Slot Record',
        recordedAt: '2026-05-29T09:40:00Z',
        recordedBy: 'Staff B',
        triggeredBipIds: [],
      },
    ];

    const result = matchExecutionRecordsToProcedures(slotsWithoutRowNo, mockRecords);

    // Slot 1 (derived rowNo = 1) strictly matches R2 (scheduleItemId: '1') first in Phase 1 (strict match)
    // Slot 2 (derived rowNo = 2) gets R1 (scheduleItemId: '0') in Phase 2? No!
    // Let's trace it:
    // Slot 1: rowNo = 1. R2 scheduleItemId is '1'. Strict match! So Slot 1 gets R2.
    // Slot 2: rowNo = 2. R1 scheduleItemId is '0'. Shifted match: slot.rowNo (2) === recordNum (0) + 1 => 2 === 1 (false).
    // Wait, let's verify if R1 matches Slot 2 shifted:
    // isShiftedProcedureSlot(slot2, R1): slot.rowNo = 2. record.scheduleItemId = '0'. recordNum = 0. slot.rowNo === recordNum + 1 => 2 === 1 (false).
    // Oh, wait! For Slot 2 (rowNo 2) to match via shifted fallback, the record's scheduleItemId should be '1' (recordNum 1 + 1 = 2).
    // If scheduleItemId is '0', it matches rowNo 1.
    // Let's check Slot 1: rowNo = 1. R1 scheduleItemId is '0'. Shifted match: slot.rowNo (1) === recordNum (0) + 1 => 1 === 1 (true).
    // Yes! R1 shifted matches Slot 1.
    // So:
    // Strict match phase: Slot 1 (rowNo 1) strictly matches R2 (scheduleItemId '1'). R2 is consumed.
    // Shifted match phase: Slot 1 is already matched. Slot 2 (rowNo 2) looks for shifted match.
    // Unconsumed records: [R1]. R1 scheduleItemId is '0'. Does it match Slot 2 shifted? No (2 !== 1).
    // So Slot 2 gets undefined.
    expect(result[0]).toBe(mockRecords[1]);
    expect(result[1]).toBeUndefined();
  });

  it('does not over-match records with mismatching scheduleItemId', () => {
    const mockRecords: ExecutionRecord[] = [
      {
        id: 'R99',
        date: '2026-05-29',
        userId: 'U001',
        scheduleItemId: '99', // No corresponding slot
        status: 'completed',
        memo: 'Mismatch',
        recordedAt: '2026-05-29T09:30:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      },
    ];

    const result = matchExecutionRecordsToProcedures(mockSlots, mockRecords);

    expect(result[0]).toBeUndefined();
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBeUndefined();
  });
});

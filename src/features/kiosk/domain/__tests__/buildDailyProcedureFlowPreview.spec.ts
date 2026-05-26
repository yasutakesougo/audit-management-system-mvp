import { describe, it, expect } from 'vitest';
import { buildDailyProcedureFlowPreview } from '../buildDailyProcedureFlowPreview';
import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';

describe('buildDailyProcedureFlowPreview', () => {
  const mockSlots: ProcedureItem[] = [
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
      id: 'base-1',
      rowNo: 1,
      time: '09:30 - 09:40',
      activity: '朝の会',
      instruction: '',
      isKey: true,
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

  it('sorts slots chronologically by rowNo', () => {
    const result = buildDailyProcedureFlowPreview(mockSlots, []);
    expect(result).toHaveLength(3);
    expect(result[0].rowNo).toBe(1);
    expect(result[1].rowNo).toBe(2);
    expect(result[2].rowNo).toBe(3);
  });

  it('matches records to slots correctly by scheduleItemId', () => {
    const mockRecords: ExecutionRecord[] = [
      {
        id: 'R001',
        date: '2024-01-01',
        userId: 'U001',
        scheduleItemId: '1', // Matches slot with rowNo: 1
        status: 'completed',
        memo: '元気に参加されました。',
        recordedAt: '2024-01-01T09:35:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      },
      {
        id: 'R003',
        date: '2024-01-01',
        userId: 'U001',
        scheduleItemId: 'base-3', // Matches slot with id: 'base-3'
        status: 'triggered',
        memo: '不穏あり。一時中断。',
        recordedAt: '2024-01-01T10:15:00Z',
        recordedBy: 'Staff B',
        triggeredBipIds: [],
      },
    ];

    const result = buildDailyProcedureFlowPreview(mockSlots, mockRecords);

    // Row 1 (Matched by string rowNo '1')
    expect(result[0].rowNo).toBe(1);
    expect(result[0].record).toBeDefined();
    expect(result[0].record?.status).toBe('completed');
    expect(result[0].record?.memo).toBe('元気に参加されました。');
    expect(result[0].record?.recordedBy).toBe('Staff A');

    // Row 2 (Unrecorded slot)
    expect(result[1].rowNo).toBe(2);
    expect(result[1].record).toBeUndefined();

    // Row 3 (Matched by slot id 'base-3')
    expect(result[2].rowNo).toBe(3);
    expect(result[2].record).toBeDefined();
    expect(result[2].record?.status).toBe('triggered');
    expect(result[2].record?.memo).toBe('不穏あり。一時中断。');
  });

  it('generates fallback steps chronologically from records when slots are empty', () => {
    const mockRecords: ExecutionRecord[] = [
      {
        id: 'R002',
        date: '2024-01-01',
        userId: 'U001',
        scheduleItemId: 'user-4-row-15',
        status: 'completed',
        memo: 'おやつ。完食。',
        recordedAt: '2024-01-01T15:00:00Z',
        recordedBy: 'Staff B',
        triggeredBipIds: [],
      },
      {
        id: 'R001',
        date: '2024-01-01',
        userId: 'U001',
        scheduleItemId: '2',
        status: 'completed',
        memo: '水分補給完了。',
        recordedAt: '2024-01-01T09:45:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      },
    ];

    const result = buildDailyProcedureFlowPreview([], mockRecords);

    // Should build fallback steps from empty slots input
    expect(result).toHaveLength(2);

    // Records should be sorted chronologically by recordedAt (R001: 09:45 -> R002: 15:00)
    expect(result[0].rowNo).toBe(2); // Extracted from '2'
    expect(result[0].time).toBe('09:45');
    expect(result[0].record?.memo).toBe('水分補給完了。');

    expect(result[1].rowNo).toBe(15); // Extracted from trailing digits of 'user-4-row-15'
    expect(result[1].time).toBe('15:00');
    expect(result[1].record?.memo).toBe('おやつ。完食。');
  });

  it('matches slots to records robustly with trailing digit logic', () => {
    const customSlots: ProcedureItem[] = [
      {
        id: 'procedure-15',
        rowNo: 15,
        time: '15:00',
        activity: 'おやつ',
        instruction: '',
        isKey: false,
        block: 'afternoon',
      }
    ];

    const customRecords: ExecutionRecord[] = [
      {
        id: 'R15',
        date: '2024-01-01',
        userId: 'U001',
        scheduleItemId: 'user-4-row-15', // different prefix but ends with 15
        status: 'completed',
        memo: '美味しく食べました。',
        recordedAt: '2024-01-01T15:05:00Z',
        recordedBy: 'Staff C',
        triggeredBipIds: [],
      }
    ];

    const result = buildDailyProcedureFlowPreview(customSlots, customRecords);
    expect(result[0].record).toBeDefined();
    expect(result[0].record?.memo).toBe('美味しく食べました。');
  });

  it('handles 0-based and 1-based index offsets robustly (e.g. slot.rowNo is 1 but record.scheduleItemId is 0)', () => {
    const customSlots: ProcedureItem[] = [
      {
        id: 'base-1',
        rowNo: 1,
        time: '09:30',
        activity: '通所・朝の準備',
        instruction: '',
        isKey: false,
        block: 'morning',
      }
    ];

    const customRecords: ExecutionRecord[] = [
      {
        id: 'R0',
        date: '2026-05-22',
        userId: 'U006',
        scheduleItemId: '0', // 0-based index from Kiosk routes
        status: 'completed',
        memo: '落ち着いていた',
        recordedAt: '2026-05-22T09:30:00Z',
        recordedBy: 'Staff C',
        triggeredBipIds: [],
      }
    ];

    const result = buildDailyProcedureFlowPreview(customSlots, customRecords);
    expect(result[0].record).toBeDefined();
    expect(result[0].record?.memo).toBe('落ち着いていた');
  });
});


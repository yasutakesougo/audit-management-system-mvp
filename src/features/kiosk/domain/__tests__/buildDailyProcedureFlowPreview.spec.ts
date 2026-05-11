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
});

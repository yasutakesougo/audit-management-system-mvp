import type { DailyRecordItem } from '@/features/daily';
import { describe, expect, it, vi } from 'vitest';
import { exportMonthlySummary } from '../monthly/MonthlySummaryExcel';

const { exportToExcelMock } = vi.hoisted(() => ({
  exportToExcelMock: vi.fn(),
}));

vi.mock('@/lib/reports/xlsxUtils', () => ({
  exportToExcel: (...args: unknown[]) => exportToExcelMock(...args),
}));

const makeRecord = (overrides: Partial<DailyRecordItem> = {}): DailyRecordItem => ({
  date: '2026-03-01',
  reporter: { name: '記録者', id: 'R1' },
  status: '完了',
  kind: 'A',
  draft: { isDraft: false },
  data: { amActivities: [], pmActivities: [] },
  userRows: [
    {
      userId: 'U1',
      userName: '利用者A',
      amActivity: '散歩',
      pmActivity: '音楽',
      lunchAmount: 'full',
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        shouting: false,
        pica: false,
        other: false,
      },
      specialNotes: '',
    },
  ],
  ...overrides,
} as unknown as DailyRecordItem);

describe('exportMonthlySummary', () => {
  it('maps labels, sorts rows, and delegates to exportToExcel', () => {
    exportToExcelMock.mockClear();

    const records: DailyRecordItem[] = [
      makeRecord({
        date: '2026-03-03',
        reporter: { name: 'Reporter B', id: 'R2' },
        userRows: [
          {
            userId: 'U2',
            userName: '利用者B',
            amActivity: '制作',
            pmActivity: '運動',
            lunchAmount: '80',
            problemBehavior: {
              selfHarm: true,
              otherInjury: false,
              shouting: true,
              pica: false,
              other: false,
            },
            specialNotes: '注意事項あり',
          },
        ],
      } as unknown as DailyRecordItem),
      makeRecord({
        date: '2026-03-01',
        reporter: { name: 'Reporter A', id: 'R1' },
        userRows: [
          {
            userId: 'U1',
            userName: '利用者A',
            amActivity: '散歩',
            pmActivity: '休憩',
            lunchAmount: 'half',
            problemBehavior: {
              selfHarm: false,
              otherInjury: false,
              shouting: false,
              pica: false,
              other: false,
            },
            specialNotes: '',
          },
        ],
      } as unknown as DailyRecordItem),
    ];

    exportMonthlySummary({
      month: '2026-03',
      users: [
        { id: 1, userId: 'U1', name: '利用者A', severe: false },
        { id: 2, userId: 'U2', name: '利用者B', severe: true },
      ],
      records,
    });

    expect(exportToExcelMock).toHaveBeenCalledTimes(1);
    const [data, options] = exportToExcelMock.mock.calls[0] as [
      Array<Record<string, string>>,
      { fileName: string; sheetName: string },
    ];

    expect(options).toEqual({
      fileName: '利用実績月次サマリ_2026-03',
      sheetName: '月次状況',
    });

    expect(data).toHaveLength(2);
    expect(data[0]['日付']).toBe('2026-03-01');
    expect(data[0]['利用者ID']).toBe('U1');
    expect(data[0]['昼食摂取']).toBe('半分');
    expect(data[0]['重度フラグ']).toBe('-');

    expect(data[1]['日付']).toBe('2026-03-03');
    expect(data[1]['利用者ID']).toBe('U2');
    expect(data[1]['昼食摂取']).toBe('8割');
    expect(data[1]['重度フラグ']).toBe('○');
    expect(data[1]['問題行動']).toBe('自傷, 大声');
  });
});

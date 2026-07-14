import type { DailyRecordItem } from '@/features/daily';
import { describe, expect, it, vi } from 'vitest';
import {
  buildMonthlySummaryCsvContent,
  buildMonthlySummaryRows,
  exportMonthlySummary,
} from '../monthly/MonthlySummaryCsv';

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
  it('maps labels, sorts rows, and builds CSV content', () => {
    const users = [
      { id: 1, userId: 'U1', name: '利用者A', severe: false },
      { id: 2, userId: 'U2', name: '利用者B', severe: true },
    ];
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
            specialNotes: '注意,重要',
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

    const rows = buildMonthlySummaryRows({ users, records });
    const csv = buildMonthlySummaryCsvContent(rows);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      '\ufeff日付,利用者ID,利用者名,午前活動,午後活動,昼食摂取,重度フラグ,問題行動,特記事項,記録者'
    );
    expect(lines[1]).toBe('2026-03-01,U1,利用者A,散歩,休憩,半分,-,,,Reporter A');
    expect(lines[2]).toBe(
      '2026-03-03,U2,利用者B,制作,運動,8割,○,"自傷, 大声","注意,重要",Reporter B'
    );
  });

  it('downloads a CSV file with the expected filename', () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a') as HTMLAnchorElement;
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return anchor;
      }
      return originalCreateElement(tagName);
    });
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:monthly-summary');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    exportMonthlySummary({
      month: '2026-03',
      users: [],
      records: [],
    });

    expect(anchor.download).toBe('利用実績月次サマリ_2026-03.csv');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });
});

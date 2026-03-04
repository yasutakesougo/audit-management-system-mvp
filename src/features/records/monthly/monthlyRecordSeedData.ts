/**
 * monthlyRecordSeedData — モックデータと E2E Seed 読み込み
 *
 * MonthlyRecordPage から抽出 (#766)
 */
import { getCurrentYearMonth, parseIsoDate, parseYearMonth } from '@/features/records/monthly/map';
import type { MonthlySummary, YearMonth } from '@/features/records/monthly/types';
import { isE2E } from '@/lib/env';

/**
 * E2E Seed データ型定義
 */
interface E2ESeedWindow extends Window {
  __E2E_SEED__?: string;
  __E2E_FIXTURE_MONTHLY_RECORDS__?: {
    summaryRows?: Array<{
      userId: string;
      userName: string;
      month: string;
      total: number;
      completed: number;
    }>;
  };
}

// モックデータ（後でAPIから取得）
export const mockMonthlySummaries: MonthlySummary[] = [
  {
    userId: 'I001',
    yearMonth: '2025-11' as YearMonth,
    displayName: '田中太郎',
    lastUpdatedUtc: '2024-11-06T10:30:00Z',
    kpi: {
      totalDays: 22,
      plannedRows: 418,
      completedRows: 380,
      inProgressRows: 25,
      emptyRows: 13,
      specialNotes: 8,
      incidents: 2,
    },
    completionRate: 90.91,
    firstEntryDate: '2025-11-01',
    lastEntryDate: '2025-11-05',
  },
  {
    userId: 'I002',
    yearMonth: '2025-11' as YearMonth,
    displayName: '佐藤花子',
    lastUpdatedUtc: '2024-11-06T09:15:00Z',
    kpi: {
      totalDays: 22,
      plannedRows: 418,
      completedRows: 295,
      inProgressRows: 48,
      emptyRows: 75,
      specialNotes: 12,
      incidents: 0,
    },
    completionRate: 70.57,
    firstEntryDate: '2025-11-01',
    lastEntryDate: '2025-11-05',
  },
  {
    userId: 'I003',
    yearMonth: '2025-11' as YearMonth,
    displayName: '鈴木次郎',
    lastUpdatedUtc: '2024-11-06T11:45:00Z',
    kpi: {
      totalDays: 22,
      plannedRows: 418,
      completedRows: 201,
      inProgressRows: 82,
      emptyRows: 135,
      specialNotes: 5,
      incidents: 1,
    },
    completionRate: 48.09,
    firstEntryDate: '2025-11-02',
    lastEntryDate: '2025-11-05',
  },
];

export const DEFAULT_MONTH: YearMonth = mockMonthlySummaries[0]?.yearMonth ?? getCurrentYearMonth();

/**
 * E2E用 Demo Seed から月次サマリーを取得（E2E限定）
 */
export function useDemoSummaries(): MonthlySummary[] {
  const e2e = isE2E();
  const w = (typeof window !== 'undefined' ? window : {}) as E2ESeedWindow;

  if (e2e && w.__E2E_SEED__?.startsWith('monthly.records.')) {
    const fixture = w.__E2E_FIXTURE_MONTHLY_RECORDS__;
    if (fixture?.summaryRows) {
      return fixture.summaryRows.map((row) => {
        const yearMonth = parseYearMonth(row.month);
        const firstEntryDate = parseIsoDate(`${row.month}-01`);
        const lastEntryDate = parseIsoDate(`${row.month}-01`);

        if (!yearMonth) {
          console.warn(`Invalid YearMonth in E2E fixture: ${row.month}`);
        }

        return {
          userId: row.userId,
          yearMonth: yearMonth ?? '2025-01' as YearMonth,
          displayName: row.userName,
          lastUpdatedUtc: new Date().toISOString(),
          kpi: {
            totalDays: 22,
            plannedRows: 418,
            completedRows: row.completed ?? 0,
            inProgressRows: 0,
            emptyRows: (row.total ?? 0) - (row.completed ?? 0),
            specialNotes: 0,
            incidents: 0,
          },
          completionRate: row.total ? (row.completed / row.total) * 100 : 0,
          firstEntryDate: firstEntryDate ?? undefined,
          lastEntryDate: lastEntryDate ?? undefined,
        };
      });
    }
    return [];
  }

  return mockMonthlySummaries;
}

export type { E2ESeedWindow };

import type { DailyRecordItem } from '@/features/daily';

export interface User {
  id: number;
  userId: string;
  name: string;
  severe: boolean;
}

/**
 * Mapping for Lunch Intake labels
 */
const LUNCH_LABELS: Record<string, string> = {
  full: '完食',
  '80': '8割',
  half: '半分',
  small: '少量',
  none: 'なし',
};

/**
 * Mapping for Problem Behavior labels
 */
const BEHAVIOR_LABELS: Record<string, string> = {
  selfHarm: '自傷',
  otherInjury: '他傷',
  shouting: '大声',
  pica: '異食',
  other: 'その他',
};

export interface MonthlySummaryOptions {
  month: string; // YYYY-MM
  users: User[];
  records: DailyRecordItem[];
}

export interface MonthSummaryCsvRow {
  date: string;
  userId: string;
  userName: string;
  amActivity: string;
  pmActivity: string;
  lunchAmount: string;
  severeFlag: string;
  problemBehavior: string;
  specialNotes: string;
  reporter: string;
}

const HEADER_COLUMNS: Array<[keyof MonthSummaryCsvRow, string]> = [
  ['date', '日付'],
  ['userId', '利用者ID'],
  ['userName', '利用者名'],
  ['amActivity', '午前活動'],
  ['pmActivity', '午後活動'],
  ['lunchAmount', '昼食摂取'],
  ['severeFlag', '重度フラグ'],
  ['problemBehavior', '問題行動'],
  ['specialNotes', '特記事項'],
  ['reporter', '記録者'],
];

const csvEscape = (value: unknown): string => {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const buildMonthlySummaryCsvContent = (rows: Array<MonthSummaryCsvRow>): string => {
  const header = HEADER_COLUMNS.map(([, label]) => csvEscape(label)).join(',');
  const body = rows.map(row =>
    HEADER_COLUMNS.map(([key]) => csvEscape(row[key])).join(',')
  );
  return `\ufeff${header}\n${body.join('\n')}\n`;
};

export const buildMonthlySummaryRows = ({
  users,
  records,
}: Pick<MonthlySummaryOptions, 'users' | 'records'>): Array<MonthSummaryCsvRow> =>
  records
    .flatMap(record => {
      return record.userRows.map(row => {
        const user = users.find(u => u.userId === row.userId);
        const behaviors = Object.entries(row.problemBehavior)
          .filter(([, checked]) => checked)
          .map(([type]) => BEHAVIOR_LABELS[type] || type)
          .join(', ');

        return {
          date: record.date,
          userId: row.userId,
          userName: row.userName,
          amActivity: row.amActivity,
          pmActivity: row.pmActivity,
          lunchAmount: LUNCH_LABELS[row.lunchAmount] || row.lunchAmount,
          severeFlag: user?.severe ? '○' : '-',
          problemBehavior: behaviors,
          specialNotes: row.specialNotes,
          reporter: record.reporter.name,
        };
      });
    })
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.userId.localeCompare(b.userId);
    });

const downloadCsv = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Generate and download a monthly summary CSV file
 */
export function exportMonthlySummary({
  month,
  users,
  records,
}: MonthlySummaryOptions): void {
  const rows = buildMonthlySummaryRows({ users, records });

  downloadCsv(
    `利用実績月次サマリ_${month}.csv`,
    buildMonthlySummaryCsvContent(rows),
  );
}

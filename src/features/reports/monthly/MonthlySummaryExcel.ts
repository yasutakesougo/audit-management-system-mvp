import type { DailyRecordItem } from '@/features/daily';
import { exportToExcel } from '@/lib/reports/xlsxUtils';

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
  violence: '他害',
  shouting: '大声',
  pica: '異食',
  other: 'その他',
};

export interface MonthlySummaryOptions {
  month: string; // YYYY-MM
  users: User[];
  records: DailyRecordItem[];
}

/**
 * Generate and download a monthly summary Excel file
 */
export function exportMonthlySummary({
  month,
  users,
  records,
}: MonthlySummaryOptions): void {
  // Flatten data for Excel
  const data = records.flatMap(record => {
    return record.userRows.map(row => {
      const user = users.find(u => u.userId === row.userId);
      const behaviors = Object.entries(row.problemBehavior)
        .filter(([, checked]) => checked)
        .map(([type]) => BEHAVIOR_LABELS[type] || type)
        .join(', ');

      return {
        '日付': record.date,
        '利用者ID': row.userId,
        '利用者名': row.userName,
        '午前活動': row.amActivity,
        '午後活動': row.pmActivity,
        '昼食摂取': LUNCH_LABELS[row.lunchAmount] || row.lunchAmount,
        '重度フラグ': user?.severe ? '○' : '-',
        '問題行動': behaviors,
        '特記事項': row.specialNotes,
        '記録者': record.reporter.name,
      };
    });
  });

  // Sort by date then user ID
  data.sort((a, b) => {
    const dateCmp = a['日付'].localeCompare(b['日付']);
    if (dateCmp !== 0) return dateCmp;
    return a['利用者ID'].localeCompare(b['利用者ID']);
  });

  exportToExcel(data, {
    fileName: `利用実績月次サマリ_${month}`,
    sheetName: '月次状況',
  });
}

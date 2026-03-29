import type { UserRowData } from '../../hooks/view-models/useTableDailyRecordForm';
import type { TableDailyRecordRow, ProblemBehaviorVariant, ProblemBehaviorColor } from './tableDailyRecordRow';
import { hasRowContent } from '../../domain/builders/rowInitialization';

export function toTableDailyRecordRow(row: UserRowData): TableDailyRecordRow {
  const behaviorKeys = Object.keys(row.problemBehavior) as Array<keyof UserRowData['problemBehavior']>;
  
  const problemBehaviorVariants = {} as Record<keyof UserRowData['problemBehavior'], ProblemBehaviorVariant>;
  const problemBehaviorColors = {} as Record<keyof UserRowData['problemBehavior'], ProblemBehaviorColor>;

  for (const key of behaviorKeys) {
    const isChecked = row.problemBehavior[key];
    problemBehaviorVariants[key] = isChecked ? 'filled' : 'outlined';
    problemBehaviorColors[key] = isChecked ? 'warning' : 'default';
  }

  // 3-C-2 のためのシンプルな検索用連結文字列
  const searchText = [row.userName, row.userId, row.specialNotes, row.amActivity, row.pmActivity]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    ...row,
    problemBehaviorVariants,
    problemBehaviorColors,
    behaviorTags: row.behaviorTags ?? [],
    hasRowContent: hasRowContent(row),
    searchText,
  };
}

export function buildTableDailyRecordRows(rows: UserRowData[]): TableDailyRecordRow[] {
  return rows.map(toTableDailyRecordRow);
}

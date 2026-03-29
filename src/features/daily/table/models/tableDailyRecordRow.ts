import type { UserRowData } from '../../hooks/view-models/useTableDailyRecordForm';

export type ProblemBehaviorVariant = 'filled' | 'outlined';
export type ProblemBehaviorColor = 'warning' | 'default';

export type TableDailyRecordRow = UserRowData & {
  problemBehaviorVariants: Record<keyof UserRowData['problemBehavior'], ProblemBehaviorVariant>;
  problemBehaviorColors: Record<keyof UserRowData['problemBehavior'], ProblemBehaviorColor>;
  behaviorTags: string[];
  hasRowContent: boolean;
  searchText: string;
};

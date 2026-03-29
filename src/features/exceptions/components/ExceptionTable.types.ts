import type { SnoozePreset } from '@/features/action-engine/domain/computeSnoozeUntil';
import type {
  ExceptionCategory,
  ExceptionItem,
  ExceptionSeverity,
} from '../domain/exceptionLogic';
import type { UserExceptionGroup } from '../domain/groupByUser';

export type ExceptionTableSortOrder = 'severity' | 'newest' | 'oldest';
export type ExceptionTableSortMode = 'default' | 'priority';
export type ExceptionTableDisplayMode = 'flat' | 'grouped';
export type SuggestionCtaSurface = 'table' | 'priority-top3';

export type ExceptionTableSuggestionActions = {
  onDismiss: (stableId: string) => void;
  onSnooze: (stableId: string, preset: SnoozePreset) => void;
  onCtaClick?: (
    stableId: string,
    targetUrl: string,
    ctaSurface?: SuggestionCtaSurface,
  ) => void;
  onPriorityTopShown?: (stableIds: string[]) => void;
};

export type ExceptionDisplayRow =
  | {
      kind: 'item';
      item: ExceptionItem;
      sortDate: number;
      sortSeverity: ExceptionSeverity;
      sortPriority?: number;
    }
  | {
      kind: 'corrective-group';
      group: UserExceptionGroup;
      representative: ExceptionItem;
      sortDate: number;
      sortSeverity: ExceptionSeverity;
      sortPriority?: number;
    };

export type PriorityTopItem = {
  id: string;
  title: string;
  description: string;
  targetUser?: string;
  severity: ExceptionSeverity;
  category: ExceptionCategory;
  actionPath?: string;
  actionLabel?: string;
  stableId?: string;
};

export type ExceptionTableProps = {
  items: ExceptionItem[];
  title?: string;
  showFilters?: boolean;
  initialSortMode?: ExceptionTableSortMode;
  categoryFilter?: ExceptionCategory | 'all';
  onCategoryFilterChange?: (category: ExceptionCategory | 'all') => void;
  severityFilter?: ExceptionSeverity | 'all';
  onSeverityFilterChange?: (severity: ExceptionSeverity | 'all') => void;
  suggestionActions?: ExceptionTableSuggestionActions;
};

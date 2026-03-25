import { ExceptionCategory, ExceptionItem, ExceptionSeverity } from '../domain/exceptionLogic';
import { groupExceptionsByUser, UserExceptionGroup } from '../domain/groupByUser';

export type ExceptionTableSortOrder = 'severity' | 'newest' | 'oldest';

export type ExceptionDisplayRow =
  | {
      kind: 'item';
      item: ExceptionItem;
      sortDate: number;
      sortSeverity: ExceptionSeverity;
    }
  | {
      kind: 'corrective-group';
      group: UserExceptionGroup;
      representative: ExceptionItem;
      sortDate: number;
      sortSeverity: ExceptionSeverity;
    };

export const SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export function getExceptionSortDate(item: ExceptionItem): number {
  const dateStr = item.targetDate ?? item.updatedAt;
  if (!dateStr) return 0;
  const ts = new Date(dateStr).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export function filterExceptions(
  items: ExceptionItem[],
  categoryFilter: ExceptionCategory | 'all',
  severityFilter: ExceptionSeverity | 'all',
): ExceptionItem[] {
  return items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
    return true;
  });
}

export function buildExceptionDisplayRows(
  filtered: ExceptionItem[],
  displayMode: 'flat' | 'grouped',
): ExceptionDisplayRow[] {
  let nonGroupedRows: ExceptionDisplayRow[] = [];
  let groupedRows: ExceptionDisplayRow[] = [];

  if (displayMode === 'flat') {
    nonGroupedRows = filtered.map((item) => ({
      kind: 'item',
      item,
      sortDate: getExceptionSortDate(item),
      sortSeverity: item.severity,
    }));
  } else {
    groupedRows = groupExceptionsByUser(filtered, 'all').map((group) => {
      const sortedItems = [...group.items].sort((a, b) => {
        const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return getExceptionSortDate(b) - getExceptionSortDate(a);
      });
      const representative = sortedItems[0] ?? group.items[0];

      return {
        kind: 'corrective-group',
        group: { ...group, items: sortedItems },
        representative,
        sortDate: getExceptionSortDate(representative),
        sortSeverity: group.highestSeverity,
      };
    });
  }

  return [...nonGroupedRows, ...groupedRows];
}

export function sortExceptionDisplayRows(
  rows: ExceptionDisplayRow[],
  sortOrder: ExceptionTableSortOrder,
): ExceptionDisplayRow[] {
  return [...rows].sort((a, b) => {
    if (sortOrder === 'severity') {
      const severityDiff = SEVERITY_ORDER[a.sortSeverity] - SEVERITY_ORDER[b.sortSeverity];
      if (severityDiff !== 0) return severityDiff;
      return b.sortDate - a.sortDate;
    }
    if (sortOrder === 'newest') {
      if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate;
      return SEVERITY_ORDER[a.sortSeverity] - SEVERITY_ORDER[b.sortSeverity];
    }
    if (sortOrder === 'oldest') {
      if (a.sortDate !== b.sortDate) return a.sortDate - b.sortDate;
      return SEVERITY_ORDER[a.sortSeverity] - SEVERITY_ORDER[b.sortSeverity];
    }
    return 0;
  });
}

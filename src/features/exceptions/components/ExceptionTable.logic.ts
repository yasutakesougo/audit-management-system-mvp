import {
  buildChildCountByParentId,
  computeExceptionPriorityScore,
} from '../domain/computeExceptionPriorityScore';
import type {
  ExceptionCategory,
  ExceptionItem,
  ExceptionSeverity,
} from '../domain/exceptionLogic';
import { groupExceptionsByUser } from '../domain/groupByUser';
import type {
  ExceptionDisplayRow,
  ExceptionTableDisplayMode,
  ExceptionTableSortMode,
  ExceptionTableSortOrder,
  PriorityTopItem,
} from './ExceptionTable.types';

export const SEVERITY_CONFIG: Record<
  ExceptionSeverity,
  { label: string; color: 'error' | 'warning' | 'info' | 'default' }
> = {
  critical: { label: '緊急', color: 'error' },
  high: { label: '高', color: 'warning' },
  medium: { label: '中', color: 'info' },
  low: { label: '低', color: 'default' },
};

export const SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

function getRowStableId(row: ExceptionDisplayRow): string {
  if (row.kind === 'item') return row.item.id;
  return row.representative.id;
}

export function getExceptionSortDate(item: ExceptionItem): number {
  const dateStr = item.targetDate ?? item.updatedAt;
  if (!dateStr) return 0;
  const ts = new Date(dateStr).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export function compareByDefaultSortOrder(
  a: Pick<ExceptionDisplayRow, 'sortDate' | 'sortSeverity'>,
  b: Pick<ExceptionDisplayRow, 'sortDate' | 'sortSeverity'>,
  sortOrder: ExceptionTableSortOrder,
): number {
  if (sortOrder === 'severity') {
    const severityDiff =
      SEVERITY_ORDER[a.sortSeverity] - SEVERITY_ORDER[b.sortSeverity];
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
}

export function compareByPriority(
  a: ExceptionItem,
  b: ExceptionItem,
  now: Date,
  childCountByParentId: ReadonlyMap<string, number>,
): number {
  const aPriority = computeExceptionPriorityScore(a, { now, childCountByParentId });
  const bPriority = computeExceptionPriorityScore(b, { now, childCountByParentId });
  if (aPriority !== bPriority) return bPriority - aPriority;

  const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (severityDiff !== 0) return severityDiff;

  const dateDiff = getExceptionSortDate(b) - getExceptionSortDate(a);
  if (dateDiff !== 0) return dateDiff;

  return a.id.localeCompare(b.id);
}

export function sortFlatItemsByPriority(items: ExceptionItem[]): ExceptionItem[] {
  const now = new Date();
  const childCountByParentId = buildChildCountByParentId(items);
  const childrenByParentId = new Map<string, ExceptionItem[]>();
  const parentIds = new Set(items.map((item) => item.id));

  for (const item of items) {
    if (!item.parentId) continue;
    const existing = childrenByParentId.get(item.parentId) ?? [];
    existing.push(item);
    childrenByParentId.set(item.parentId, existing);
  }

  type GroupUnit = {
    items: ExceptionItem[];
    groupScore: number;
    representative: ExceptionItem;
  };

  const groups: GroupUnit[] = [];

  for (const item of items) {
    if (item.parentId) continue;

    const children = [...(childrenByParentId.get(item.id) ?? [])].sort((a, b) =>
      compareByPriority(a, b, now, childCountByParentId),
    );

    if (children.length === 0) {
      const score = computeExceptionPriorityScore(item, { now, childCountByParentId });
      groups.push({
        items: [item],
        groupScore: score,
        representative: item,
      });
      continue;
    }

    const groupItems = [item, ...children];
    const groupScore = Math.max(
      ...groupItems.map((groupItem) =>
        computeExceptionPriorityScore(groupItem, { now, childCountByParentId }),
      ),
    );

    groups.push({
      items: groupItems,
      groupScore,
      representative: item,
    });
  }

  for (const item of items) {
    if (!item.parentId || parentIds.has(item.parentId)) continue;
    const score = computeExceptionPriorityScore(item, { now, childCountByParentId });
    groups.push({
      items: [item],
      groupScore: score,
      representative: item,
    });
  }

  groups.sort((a, b) => {
    if (a.groupScore !== b.groupScore) return b.groupScore - a.groupScore;
    const repSeverityDiff =
      SEVERITY_ORDER[a.representative.severity] -
      SEVERITY_ORDER[b.representative.severity];
    if (repSeverityDiff !== 0) return repSeverityDiff;
    const dateDiff =
      getExceptionSortDate(b.representative) - getExceptionSortDate(a.representative);
    if (dateDiff !== 0) return dateDiff;
    return a.representative.id.localeCompare(b.representative.id);
  });

  return groups.flatMap((group) => group.items);
}

export function filterExceptionItems(
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

type BuildDisplayRowsParams = {
  items: ExceptionItem[];
  categoryFilter: ExceptionCategory | 'all';
  severityFilter: ExceptionSeverity | 'all';
  sortMode: ExceptionTableSortMode;
  sortOrder: ExceptionTableSortOrder;
  displayMode: ExceptionTableDisplayMode;
};

export function buildDisplayRows({
  items,
  categoryFilter,
  severityFilter,
  sortMode,
  sortOrder,
  displayMode,
}: BuildDisplayRowsParams): ExceptionDisplayRow[] {
  const filtered = filterExceptionItems(items, categoryFilter, severityFilter);

  if (displayMode === 'flat' && sortMode === 'priority') {
    const sortedFlatItems = sortFlatItemsByPriority(filtered);
    const now = new Date();
    const childCountByParentId = buildChildCountByParentId(filtered);

    return sortedFlatItems.map((item) => ({
      kind: 'item',
      item,
      sortDate: getExceptionSortDate(item),
      sortSeverity: item.severity,
      sortPriority: computeExceptionPriorityScore(item, { now, childCountByParentId }),
    }));
  }

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
    const now = new Date();
    const childCountByParentId = buildChildCountByParentId(filtered);

    groupedRows = groupExceptionsByUser(filtered, 'all').map((group) => {
      const sortedItems = [...group.items].sort((a, b) =>
        sortMode === 'priority'
          ? compareByPriority(a, b, now, childCountByParentId)
          : compareByDefaultSortOrder(
              { sortDate: getExceptionSortDate(a), sortSeverity: a.severity },
              { sortDate: getExceptionSortDate(b), sortSeverity: b.severity },
              'severity',
            ),
      );

      const representative = sortedItems[0] ?? group.items[0];
      const sortPriority = computeExceptionPriorityScore(representative, {
        now,
        childCountByParentId,
      });

      return {
        kind: 'corrective-group',
        group: { ...group, items: sortedItems },
        representative,
        sortDate: getExceptionSortDate(representative),
        sortSeverity: representative.severity,
        sortPriority,
      };
    });
  }

  const rows = [...nonGroupedRows, ...groupedRows];

  if (sortMode === 'priority') {
    return rows.sort((a, b) => {
      const pA = a.sortPriority ?? 0;
      const pB = b.sortPriority ?? 0;
      if (pA !== pB) return pB - pA;

      const severityDiff =
        SEVERITY_ORDER[a.sortSeverity] - SEVERITY_ORDER[b.sortSeverity];
      if (severityDiff !== 0) return severityDiff;
      if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate;
      return getRowStableId(a).localeCompare(getRowStableId(b));
    });
  }

  return rows.sort((a, b) => compareByDefaultSortOrder(a, b, sortOrder));
}

export function buildPriorityTopItems(
  displayRows: ExceptionDisplayRow[],
  sortMode: ExceptionTableSortMode,
  displayMode: ExceptionTableDisplayMode,
): PriorityTopItem[] {
  if (sortMode !== 'priority') return [];

  if (displayMode === 'flat') {
    return displayRows
      .filter(
        (row): row is ExceptionDisplayRow & { kind: 'item' } => row.kind === 'item',
      )
      .map((row) => row.item)
      .filter((item) => !item.parentId)
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        targetUser: item.targetUser,
        severity: item.severity,
        category: item.category,
        actionPath: item.actionPath,
        actionLabel: item.actionLabel,
        stableId: item.stableId,
      }));
  }

  return displayRows
    .filter(
      (row): row is ExceptionDisplayRow & { kind: 'corrective-group' } =>
        row.kind === 'corrective-group',
    )
    .slice(0, 3)
    .map((row) => {
      const userName = row.group.userName ?? row.representative.targetUser ?? '対象者';
      return {
        id: row.representative.id,
        title: `${userName} の例外 (${row.group.count}件)`,
        description: row.representative.description,
        targetUser: userName,
        severity: row.representative.severity,
        category: row.representative.category,
        actionPath: row.representative.actionPath,
        actionLabel: row.representative.actionLabel,
        stableId: row.representative.stableId,
      };
    });
}

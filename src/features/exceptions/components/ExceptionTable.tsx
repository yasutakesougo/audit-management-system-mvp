/**
 * ExceptionTable — 例外一覧テーブル
 *
 * 表示オーケストレーター:
 * - 状態管理 (filter/sort/mode/expand)
 * - displayRows / priorityTop の算出
 * - telemetry callback の発火
 *
 * 描画本体は分割コンポーネントへ委譲:
 * - ExceptionTableControls
 * - ExceptionTablePriorityTop
 * - ExceptionTableRows
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  getInitialExpandedParents,
  groupExceptionsByParent,
} from '../domain/groupExceptionsByParent';
import type { ExceptionCategory, ExceptionSeverity } from '../domain/exceptionLogic';
import {
  buildDisplayRows,
  buildPriorityTopItems,
} from './ExceptionTable.logic';
import { ExceptionTableControls } from './ExceptionTableControls';
import { ExceptionTablePriorityTop } from './ExceptionTablePriorityTop';
import { ExceptionTableRows } from './ExceptionTableRows';
import type {
  ExceptionDisplayRow,
  ExceptionTableDisplayMode,
  ExceptionTableProps,
  ExceptionTableSortMode,
  ExceptionTableSortOrder,
  PriorityTopItem,
} from './ExceptionTable.types';

export type {
  ExceptionTableProps,
  ExceptionTableSortMode,
  ExceptionTableSortOrder,
} from './ExceptionTable.types';

export const ExceptionTable: React.FC<ExceptionTableProps> = ({
  items,
  title = '例外一覧',
  showFilters = true,
  initialSortMode = 'default',
  categoryFilter: externalCategoryFilter,
  onCategoryFilterChange,
  severityFilter: externalSeverityFilter,
  onSeverityFilterChange,
  suggestionActions,
}) => {
  const navigate = useNavigate();
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<
    ExceptionCategory | 'all'
  >('all');
  const [internalSeverityFilter, setInternalSeverityFilter] = useState<
    ExceptionSeverity | 'all'
  >('all');
  const [sortMode, setSortMode] = useState<ExceptionTableSortMode>(initialSortMode);
  const [sortOrder, setSortOrder] = useState<ExceptionTableSortOrder>('severity');
  const [displayMode, setDisplayMode] =
    useState<ExceptionTableDisplayMode>('flat');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const STORAGE_KEY = 'exception-collapsed-parents';
  const readSavedCollapsed = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.filter((v: unknown) => typeof v === 'string'));
      }
    } catch {
      // ignore corrupted localStorage data
    }
    return new Set();
  }, []);

  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(
    () => readSavedCollapsed(),
  );
  const parentInitRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsedParents]));
    } catch {
      // ignore quota / private mode failures
    }
  }, [collapsedParents]);

  const categoryFilter =
    externalCategoryFilter !== undefined
      ? externalCategoryFilter
      : internalCategoryFilter;
  const severityFilter =
    externalSeverityFilter !== undefined
      ? externalSeverityFilter
      : internalSeverityFilter;

  const handleCategoryChange = (val: ExceptionCategory | 'all') => {
    if (onCategoryFilterChange) onCategoryFilterChange(val);
    else setInternalCategoryFilter(val);
  };

  const handleSeverityChange = (val: ExceptionSeverity | 'all') => {
    if (onSeverityFilterChange) onSeverityFilterChange(val);
    else setInternalSeverityFilter(val);
  };

  const displayRows = useMemo(
    () =>
      buildDisplayRows({
        items,
        categoryFilter,
        severityFilter,
        sortMode,
        sortOrder,
        displayMode,
      }),
    [items, categoryFilter, severityFilter, sortMode, sortOrder, displayMode],
  );

  const priorityTopItems = useMemo(
    () => buildPriorityTopItems(displayRows, sortMode, displayMode),
    [displayRows, sortMode, displayMode],
  );

  const shownTopStableIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (sortMode !== 'priority') return;
    if (!suggestionActions?.onPriorityTopShown) return;

    const stableIds = priorityTopItems
      .map((item) => item.stableId)
      .filter((stableId): stableId is string => typeof stableId === 'string');
    const unseen = stableIds.filter(
      (stableId) => !shownTopStableIdsRef.current.has(stableId),
    );
    if (unseen.length === 0) return;

    for (const stableId of unseen) {
      shownTopStableIdsRef.current.add(stableId);
    }
    suggestionActions.onPriorityTopShown(unseen);
  }, [priorityTopItems, sortMode, suggestionActions]);

  const handlePriorityTopAction = useCallback(
    (item: PriorityTopItem) => {
      if (!item.actionPath) return;
      if (item.category === 'corrective-action' && item.stableId) {
        suggestionActions?.onCtaClick?.(item.stableId, item.actionPath, 'priority-top3');
      }
      navigate(item.actionPath);
    },
    [navigate, suggestionActions],
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const parentChildGroups = useMemo(() => {
    if (displayMode !== 'flat') return [];
    const flatItems = displayRows
      .filter(
        (row): row is ExceptionDisplayRow & { kind: 'item' } => row.kind === 'item',
      )
      .map((row) => row.item);
    return groupExceptionsByParent(flatItems);
  }, [displayRows, displayMode]);

  const parentIds = useMemo(
    () =>
      parentChildGroups
        .filter((group) => group.kind === 'parent')
        .map((group) => group.item.id),
    [parentChildGroups],
  );

  useEffect(() => {
    if (displayMode !== 'flat') return;
    if (parentInitRef.current) return;
    if (parentIds.length === 0) return;

    parentInitRef.current = true;
    const saved = readSavedCollapsed();
    const validSaved = new Set(
      [...saved].filter((parentId) => parentIds.includes(parentId)),
    );
    if (validSaved.size > 0) {
      setCollapsedParents(validSaved);
      return;
    }

    const initialExpanded = getInitialExpandedParents(parentChildGroups);
    const initialCollapsed = new Set(
      parentIds.filter((parentId) => !initialExpanded.has(parentId)),
    );
    setCollapsedParents(initialCollapsed);
  }, [displayMode, parentIds, parentChildGroups, readSavedCollapsed]);

  const handleToggleParent = useCallback((parentId: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => setCollapsedParents(new Set()), []);
  const handleCollapseAll = useCallback(
    () => setCollapsedParents(new Set(parentIds)),
    [parentIds],
  );

  return (
    <Box data-testid="exception-table">
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
          {items.length > 0 && (
            <Chip
              label={`${items.length}件`}
              size="small"
              color="warning"
              sx={{ ml: 1, verticalAlign: 'middle' }}
            />
          )}
        </Typography>
      </Stack>

      <ExceptionTableControls
        showFilters={showFilters}
        itemCount={items.length}
        categoryFilter={categoryFilter}
        severityFilter={severityFilter}
        sortMode={sortMode}
        sortOrder={sortOrder}
        displayMode={displayMode}
        hasParentGroups={displayMode === 'flat' && parentIds.length > 0}
        onCategoryChange={handleCategoryChange}
        onSeverityChange={handleSeverityChange}
        onSortModeChange={setSortMode}
        onSortOrderChange={setSortOrder}
        onDisplayModeChange={setDisplayMode}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />

      {sortMode === 'priority' && (
        <ExceptionTablePriorityTop
          items={priorityTopItems}
          onAction={handlePriorityTopAction}
        />
      )}

      <ExceptionTableRows
        sourceItemCount={items.length}
        displayRows={displayRows}
        displayMode={displayMode}
        parentChildGroups={parentChildGroups}
        collapsedParents={collapsedParents}
        onToggleParent={handleToggleParent}
        expandedGroups={expandedGroups}
        onToggleGroup={toggleGroup}
        onNavigate={navigate}
        suggestionActions={suggestionActions}
      />
    </Box>
  );
};

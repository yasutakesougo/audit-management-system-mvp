/**
 * ExceptionTable — 例外一覧テーブル
 *
 * MVP-006: Control Layer の土台コンポーネント。
 * 管理者向けに「どこで詰まっているか」をテーブル形式で可視化。
 *
 * ## 設計方針
 * - データは親コンポーネントから受け取る (smart/dumb 分離)
 * - ExceptionCenterPage (MVP-007) から再利用される
 * - EmptyStateAction (MVP-001) を0件時に再利用
 * - フィルタは category と severity で可能
 *
 * ## MVP-012 Phase B
 * - CorrectiveActionsCell: buildCorrectiveActions() による複数是正アクション表示
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── MUI ──
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import IconButton from '@mui/material/IconButton';
import ViewListIcon from '@mui/icons-material/ViewList';
import PersonIcon from '@mui/icons-material/Person';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import Tooltip from '@mui/material/Tooltip';

// ── Domain ──
import { EmptyStateAction } from '@/components/ui/EmptyStateAction';
import {
  groupExceptionsByParent,
  getInitialExpandedParents,
} from '../domain/groupExceptionsByParent';
import { DismissSnoozeMenu } from '@/features/action-engine/components/DismissSnoozeMenu';
import type { SnoozePreset } from '@/features/action-engine/domain/computeSnoozeUntil';
import {
  EXCEPTION_CATEGORIES,
  type ExceptionCategory,
  type ExceptionItem,
  type ExceptionSeverity,
} from '../domain/exceptionLogic';
import { buildCorrectiveActions } from '../domain/correctiveActions';
import {
  groupExceptionsByUser,
  type UserExceptionGroup,
} from '../domain/groupByUser';
import {
  TEMPERATURE_LABELS,
  severityToPriority,
} from '../domain/mapSuggestionToException';
import {
  buildChildCountByParentId,
  computeExceptionPriorityScore,
} from '../domain/computeExceptionPriorityScore';

// ─── Props ──────────────────────────────────────────────────

export type ExceptionTableSortOrder = 'severity' | 'newest' | 'oldest';
export type ExceptionTableSortMode = 'default' | 'priority';
type SuggestionCtaSurface = 'table' | 'priority-top3';

type ExceptionDisplayRow =
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

type PriorityTopItem = {
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
  categoryFilter?: ExceptionCategory | 'all';
  onCategoryFilterChange?: (category: ExceptionCategory | 'all') => void;
  severityFilter?: ExceptionSeverity | 'all';
  onSeverityFilterChange?: (severity: ExceptionSeverity | 'all') => void;
  suggestionActions?: {
    onDismiss: (stableId: string) => void;
    onSnooze: (stableId: string, preset: SnoozePreset) => void;
    onCtaClick?: (
      stableId: string,
      targetUrl: string,
      ctaSurface?: SuggestionCtaSurface,
    ) => void;
    onPriorityTopShown?: (stableIds: string[]) => void;
  };
};

// ─── Severity Chip Config ───────────────────────────────────

const SEVERITY_CONFIG: Record<ExceptionSeverity, { label: string; color: 'error' | 'warning' | 'info' | 'default' }> = {
  critical: { label: '緊急', color: 'error' },
  high: { label: '高', color: 'warning' },
  medium: { label: '中', color: 'info' },
  low: { label: '低', color: 'default' },
};

const SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

function getExceptionSortDate(item: ExceptionItem): number {
  const dateStr = item.targetDate ?? item.updatedAt;
  if (!dateStr) return 0;
  const ts = new Date(dateStr).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function compareByDefaultSortOrder(
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

function compareByPriority(
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

function sortFlatItemsByPriority(items: ExceptionItem[]): ExceptionItem[] {
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

  // 親を持たない orphan child は standalone として扱う
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
      SEVERITY_ORDER[a.representative.severity] - SEVERITY_ORDER[b.representative.severity];
    if (repSeverityDiff !== 0) return repSeverityDiff;
    return getExceptionSortDate(b.representative) - getExceptionSortDate(a.representative);
  });

  return groups.flatMap((group) => group.items);
}
// ─── CorrectiveActionsCell (MVP-012 Phase B) ─────────────────
// ExceptionTable の前に定義して「使用前宣言」エラーを回避する

const SEVERITY_TO_COLOR: Record<string, 'error' | 'warning' | 'primary' | 'inherit'> = {
  critical: 'error',
  high: 'warning',
  medium: 'primary',
  low: 'inherit',
};

const CorrectiveActionsCell: React.FC<{
  item: ExceptionItem;
  onNavigate: (route: string) => void;
  suggestionActions?: ExceptionTableProps['suggestionActions'];
}> = ({ item, onNavigate, suggestionActions }) => {
  const actions = buildCorrectiveActions(item);
  const primary = actions.find((a) => a.variant === 'primary');
  const secondary = actions.find((a) => a.variant === 'secondary' || a.variant === 'ghost');
  const stableId = item.stableId;
  const canOpenSuggestionMenu = Boolean(
    item.category === 'corrective-action' &&
      stableId &&
      suggestionActions,
  );

  const handleNavigate = (route: string) => {
    if (item.category === 'corrective-action' && stableId) {
      suggestionActions?.onCtaClick?.(stableId, route, 'table');
    }
    onNavigate(route);
  };

  if (!primary) return null;

  return (
    <Stack spacing={0.5} alignItems="flex-start">
      {/* Primary: 主アクション */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Button
          size="small"
          variant="contained"
          color={SEVERITY_TO_COLOR[primary.severity] ?? 'primary'}
          onClick={() => handleNavigate(primary.route)}
          startIcon={<span style={{ fontSize: 12 }}>{primary.icon}</span>}
          sx={{ fontSize: '0.7rem', textTransform: 'none', py: 0.25, px: 1 }}
          title={primary.reason}
          data-testid={`corrective-primary-${item.id}`}
        >
          {primary.label}
        </Button>
        {canOpenSuggestionMenu && stableId && suggestionActions && (
          <DismissSnoozeMenu
            buttonAriaLabel="改善提案メニュー"
            buttonTestId={`suggestion-menu-button-${item.id}`}
            onDismiss={() => suggestionActions.onDismiss(stableId)}
            onSnooze={(preset) => suggestionActions.onSnooze(stableId, preset)}
          />
        )}
      </Stack>

      {/* Secondary/Ghost: 補助アクション（小） */}
      {secondary && (
        <Button
          size="small"
          variant="text"
          onClick={() => handleNavigate(secondary.route)}
          sx={{
            fontSize: '0.65rem',
            textTransform: 'none',
            color: 'text.secondary',
            py: 0,
            px: 0.5,
            minHeight: 'auto',
          }}
          title={secondary.reason}
          data-testid={`corrective-secondary-${item.id}`}
        >
          {secondary.icon} {secondary.label}
        </Button>
      )}
    </Stack>
  );
};



// ─── Component ──────────────────────────────────────────────

export const ExceptionTable: React.FC<ExceptionTableProps> = ({
  items,
  title = '例外一覧',
  showFilters = true,
  categoryFilter: externalCategoryFilter,
  onCategoryFilterChange,
  severityFilter: externalSeverityFilter,
  onSeverityFilterChange,
  suggestionActions,
}) => {
  const navigate = useNavigate();
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<ExceptionCategory | 'all'>('all');
  const [internalSeverityFilter, setInternalSeverityFilter] = useState<ExceptionSeverity | 'all'>('all');
  const [sortMode, setSortMode] = useState<ExceptionTableSortMode>('default');
  const [sortOrder, setSortOrder] = useState<ExceptionTableSortOrder>('severity');
  const [displayMode, setDisplayMode] = useState<'flat' | 'grouped'>('flat');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  // ── 親子折りたたみ state（localStorage 永続化）──────────────────────────────
  const STORAGE_KEY = 'exception-collapsed-parents';

  const readSavedCollapsed = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.filter((v: unknown) => typeof v === 'string'));
    } catch { /* ignore corrupted data */ }
    return new Set();
  }, []);

  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(() => readSavedCollapsed());
  const parentInitRef = useRef(false);

  // localStorage への自動保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsedParents]));
    } catch { /* quota exceeded etc. */ }
  }, [collapsedParents]);

  const categoryFilter = externalCategoryFilter !== undefined ? externalCategoryFilter : internalCategoryFilter;
  const severityFilter = externalSeverityFilter !== undefined ? externalSeverityFilter : internalSeverityFilter;

  const handleCategoryChange = (val: ExceptionCategory | 'all') => {
    if (onCategoryFilterChange) onCategoryFilterChange(val);
    else setInternalCategoryFilter(val);
  };

  const handleSeverityChange = (val: ExceptionSeverity | 'all') => {
    if (onSeverityFilterChange) onSeverityFilterChange(val);
    else setInternalSeverityFilter(val);
  };

  const displayRows = useMemo<ExceptionDisplayRow[]>(() => {
    // 1. Filter
    const filtered = items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
      return true;
    });

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

    // 2. 表示モードに応じた行の生成
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
        const sortedItems = [...group.items].sort((a, b) => (
          sortMode === 'priority'
            ? compareByPriority(a, b, now, childCountByParentId)
            : compareByDefaultSortOrder(
              { sortDate: getExceptionSortDate(a), sortSeverity: a.severity },
              { sortDate: getExceptionSortDate(b), sortSeverity: b.severity },
              'severity',
            )
        ));
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
        return b.sortDate - a.sortDate;
      });
    }

    // 3. Sort
    return rows.sort((a, b) =>
      compareByDefaultSortOrder(a, b, sortOrder),
    );
  }, [items, categoryFilter, severityFilter, sortMode, sortOrder, displayMode]);

  const priorityTopItems = useMemo<PriorityTopItem[]>(() => {
    if (sortMode !== 'priority') return [];

    if (displayMode === 'flat') {
      return displayRows
        .filter((row): row is ExceptionDisplayRow & { kind: 'item' } => row.kind === 'item')
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
      .filter((row): row is ExceptionDisplayRow & { kind: 'corrective-group' } => row.kind === 'corrective-group')
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
  }, [displayRows, sortMode, displayMode]);

  const shownTopStableIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (sortMode !== 'priority') return;
    if (!suggestionActions?.onPriorityTopShown) return;

    const stableIds = priorityTopItems
      .map((item) => item.stableId)
      .filter((stableId): stableId is string => typeof stableId === 'string');

    const unseen = stableIds.filter((stableId) => !shownTopStableIdsRef.current.has(stableId));
    if (unseen.length === 0) return;

    for (const stableId of unseen) {
      shownTopStableIdsRef.current.add(stableId);
    }
    suggestionActions.onPriorityTopShown(unseen);
  }, [priorityTopItems, sortMode, suggestionActions]);

  const handlePriorityTopAction = useCallback((item: PriorityTopItem) => {
    if (!item.actionPath) return;
    if (item.category === 'corrective-action' && item.stableId) {
      suggestionActions?.onCtaClick?.(
        item.stableId,
        item.actionPath,
        'priority-top3',
      );
    }
    navigate(item.actionPath);
  }, [navigate, suggestionActions]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // ── 親子グルーピング（flat モード用）──────────────────────────────────────────
  const parentChildGroups = useMemo(() => {
    if (displayMode !== 'flat') return [];
    const flatItems = displayRows
      .filter((r): r is ExceptionDisplayRow & { kind: 'item' } => r.kind === 'item')
      .map((r) => r.item);
    return groupExceptionsByParent(flatItems);
  }, [displayRows, displayMode]);

  const parentIds = useMemo(
    () => parentChildGroups.filter((g) => g.kind === 'parent').map((g) => g.item.id),
    [parentChildGroups],
  );

  // 初期展開状態の適用（保存された状態がない場合のみ、一度だけ）
  if (
    displayMode === 'flat' &&
    !parentInitRef.current &&
    parentIds.length > 0
  ) {
    parentInitRef.current = true;
    // localStorage に有効な保存値があればそれを使う（古い ID を除外）
    const saved = readSavedCollapsed();
    const validSaved = new Set([...saved].filter((id) => parentIds.includes(id)));
    if (validSaved.size > 0) {
      queueMicrotask(() => setCollapsedParents(validSaved));
    } else {
      // 保存値がない場合は初期展開ルールを適用
      const initialExpanded = getInitialExpandedParents(parentChildGroups);
      const initialCollapsed = new Set(
        parentIds.filter((id) => !initialExpanded.has(id)),
      );
      queueMicrotask(() => setCollapsedParents(initialCollapsed));
    }
  }

  const handleExpandAll = () => setCollapsedParents(new Set());
  const handleCollapseAll = () => setCollapsedParents(new Set(parentIds));
  const hasParentGroups = parentIds.length > 0;

  return (
    <Box data-testid="exception-table">
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
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

      {/* Filters & Toggles */}
      {showFilters && items.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <ToggleButtonGroup
            value={displayMode}
            exclusive
            onChange={(_, v) => { if (v) setDisplayMode(v as 'flat' | 'grouped'); }}
            size="small"
            color="primary"
          >
            <ToggleButton value="flat" data-testid="exception-mode-flat">
              <ViewListIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
              フラット一覧
            </ToggleButton>
            <ToggleButton value="grouped" data-testid="exception-mode-grouped">
              <PersonIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
              利用者単位
            </ToggleButton>
          </ToggleButtonGroup>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>カテゴリ</InputLabel>
            <Select
              value={categoryFilter}
              label="カテゴリ"
              onChange={(e) => handleCategoryChange(e.target.value as ExceptionCategory | 'all')}
              data-testid="exception-filter-category"
            >
              <MenuItem value="all">すべて</MenuItem>
              {Object.entries(EXCEPTION_CATEGORIES).map(([key, meta]) => (
                <MenuItem key={key} value={key}>
                  {meta.icon} {meta.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>重要度</InputLabel>
            <Select
              value={severityFilter}
              label="重要度"
              onChange={(e) => handleSeverityChange(e.target.value as ExceptionSeverity | 'all')}
              data-testid="exception-filter-severity"
            >
              <MenuItem value="all">すべて</MenuItem>
              {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  {config.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>ソート</InputLabel>
            <Select
              value={sortMode}
              label="ソート"
              onChange={(e) => setSortMode(e.target.value as ExceptionTableSortMode)}
              data-testid="exception-sort-mode"
            >
              <MenuItem value="default">標準順</MenuItem>
              <MenuItem value="priority">優先度順</MenuItem>
            </Select>
          </FormControl>
          {sortMode === 'default' && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>並び順</InputLabel>
            <Select
              value={sortOrder}
              label="並び順"
              onChange={(e) => setSortOrder(e.target.value as ExceptionTableSortOrder)}
              data-testid="exception-sort-order"
            >
              <MenuItem value="severity">🚨 重要度順</MenuItem>
              <MenuItem value="newest">⬇️ 新しい順</MenuItem>
              <MenuItem value="oldest">⬆️ 古い順</MenuItem>
            </Select>
            </FormControl>
          )}
          {displayMode === 'flat' && hasParentGroups && (
            <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
              <Tooltip title="すべて展開">
                <IconButton
                  size="small"
                  onClick={handleExpandAll}
                  data-testid="exception-expand-all"
                >
                  <UnfoldMoreIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="すべて折りたたみ">
                <IconButton
                  size="small"
                  onClick={handleCollapseAll}
                  data-testid="exception-collapse-all"
                >
                  <UnfoldLessIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>
      )}

      {sortMode === 'priority' && priorityTopItems.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            borderColor: 'warning.light',
            bgcolor: 'warning.50',
          }}
          data-testid="exception-priority-top3"
        >
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              ⚡ 今すぐ対応 Top3
            </Typography>
            {priorityTopItems.map((item, index) => {
              const sevConfig = SEVERITY_CONFIG[item.severity];
              return (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ p: 0.5, borderRadius: 1, bgcolor: 'background.paper' }}
                  data-testid={`exception-priority-top3-item-${index + 1}`}
                >
                  <Chip
                    label={`#${index + 1}`}
                    size="small"
                    color={index === 0 ? 'error' : 'warning'}
                    sx={{ minWidth: 42 }}
                  />
                  <Chip
                    label={sevConfig.label}
                    size="small"
                    color={sevConfig.color}
                    sx={{ minWidth: 48 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.targetUser ? `${item.targetUser} / ` : ''}{item.description}
                    </Typography>
                  </Box>
                  {item.actionPath && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => handlePriorityTopAction(item)}
                      data-testid={`exception-priority-top3-action-${item.id}`}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      {item.actionLabel ?? '確認'}
                    </Button>
                  )}
                </Stack>
              );
            })}
            <Typography variant="caption" color="text.secondary">
              詳細は下の一覧へ
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Table or Empty */}
      {displayRows.length === 0 ? (
        <EmptyStateAction
          icon={items.length === 0 ? '🎉' : '🔍'}
          title={items.length === 0 ? '例外なし — すべて正常です' : 'フィルタ条件に一致する例外はありません'}
          description={
            items.length === 0
              ? '現在、対応が必要な例外は見つかっていません。'
              : 'フィルタ条件を変更してください。'
          }
          variant={items.length === 0 ? 'success' : 'info'}
          testId="exception-table-empty"
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700, width: 80 }}>重要度</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 120 }}>種類</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>内容</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 100 }}>対象者</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 100 }}>日付</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 160 }}>是正アクション</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayRows.map((row) => {
                if (row.kind === 'item') {
                  const item = row.item;
                  const catMeta = EXCEPTION_CATEGORIES[item.category];
                  const sevConfig = SEVERITY_CONFIG[item.severity];
                  const isChild = Boolean(item.parentId);

                  // ── 親子折りたたみの情報 ──
                  const parentGroup = displayMode === 'flat'
                    ? parentChildGroups.find((g) => g.kind === 'parent' && g.item.id === item.id)
                    : undefined;
                  const isParent = parentGroup?.kind === 'parent';
                  const childCount = isParent ? parentGroup.childCount : 0;
                  const isCollapsed = isParent && collapsedParents.has(item.id);

                  // 子行が折りたたまれている場合は非表示
                  if (isChild && item.parentId && collapsedParents.has(item.parentId)) {
                    return null;
                  }

                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{
                        borderLeft: 4,
                        borderLeftColor: isChild ? 'transparent' : catMeta.color,
                        '&:last-child td': { borderBottom: 0 },
                        ...(isChild && {
                          bgcolor: 'grey.50',
                        }),
                        ...(isParent && {
                          cursor: 'pointer',
                        }),
                      }}
                      onClick={
                        isParent
                          ? () => {
                              setCollapsedParents((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) {
                                  next.delete(item.id);
                                } else {
                                  next.add(item.id);
                                }
                                return next;
                              });
                            }
                          : undefined
                      }
                      data-testid={`exception-row-${item.id}`}
                    >
                      <TableCell>
                        {isParent && (
                          <IconButton
                            size="small"
                            sx={{ p: 0, mr: 0.5 }}
                            data-testid={`exception-toggle-${item.id}`}
                          >
                            {isCollapsed ? (
                              <ChevronRightIcon sx={{ fontSize: 16 }} />
                            ) : (
                              <ExpandMoreIcon sx={{ fontSize: 16 }} />
                            )}
                          </IconButton>
                        )}
                        {isChild && (
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              width: 12,
                              height: 12,
                              borderLeft: '2px solid',
                              borderBottom: '2px solid',
                              borderColor: 'grey.400',
                              borderRadius: '0 0 0 4px',
                              mr: 0.5,
                              mb: -0.25,
                            }}
                          />
                        )}
                        <Chip
                          label={
                            item.category === 'corrective-action'
                              ? (TEMPERATURE_LABELS[severityToPriority(item.severity) ?? 'P2'] ?? sevConfig.label)
                              : sevConfig.label
                          }
                          size="small"
                          color={sevConfig.color}
                          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Box sx={{ fontSize: 14, ...(isChild && { opacity: 0.5 }) }}>{catMeta.icon}</Box>
                          <Typography variant="caption" sx={{ fontWeight: 600, ...(isChild && { color: 'text.secondary' }) }}>
                            {isChild ? '└ 個別' : catMeta.label}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={isChild ? { pl: 3 } : undefined}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 600, ...(isChild && { fontSize: '0.8rem' }) }}>
                            {item.title}
                          </Typography>
                          {isParent && childCount > 0 && (
                            <Chip
                              label={`${childCount}件`}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontSize: '0.65rem',
                                height: 18,
                                '& .MuiChip-label': { px: 0.5 },
                              }}
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {item.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.targetUserId ? (
                          <Button
                            variant="text"
                            size="small"
                            sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontWeight: 600 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/users/${item.targetUserId}`);
                            }}
                            data-testid={`exception-user-link-${item.id}`}
                          >
                            {item.targetUser ?? '—'}
                          </Button>
                        ) : (
                          <Typography variant="body2">
                            {item.targetUser ?? '—'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {item.targetDate ?? item.updatedAt}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <CorrectiveActionsCell
                          item={item}
                          onNavigate={navigate}
                          suggestionActions={suggestionActions}
                        />
                      </TableCell>
                    </TableRow>
                  );
                }

                const { group, representative } = row;
                const catMeta = EXCEPTION_CATEGORIES[representative.category];
                const sevConfig = SEVERITY_CONFIG[representative.severity];
                const isExpanded = expandedGroups[group.userId] ?? false;
                const canExpand = group.items.length > 1;
                const userName = group.userName ?? representative.targetUser ?? (group.userId === '__unknown__' ? '共通・その他' : '—');
                const canOpenUser = group.userId !== '__unknown__';
                const groupTitle = group.userId === '__unknown__' ? `共通・その他の例外 (${group.count}件)` : `${userName} の例外 (${group.count}件)`;

                return (
                  <React.Fragment key={`group-${group.userId}`}>
                    <TableRow
                      hover
                      sx={{
                        borderLeft: 4,
                        borderLeftColor: catMeta.color,
                      }}
                      data-testid={`exception-row-${representative.id}`}
                    >
                      <TableCell>
                        <Chip
                          label={TEMPERATURE_LABELS[severityToPriority(representative.severity) ?? 'P2'] ?? sevConfig.label}
                          size="small"
                          color={sevConfig.color}
                          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Box sx={{ fontSize: 14 }}>{catMeta.icon}</Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {catMeta.label}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {groupTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {representative.description}
                          {group.count > 1 ? ` / 他 ${group.count - 1} 件` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {canOpenUser ? (
                          <Button
                            variant="text"
                            size="small"
                            sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontWeight: 600 }}
                            onClick={() => navigate(`/users/${group.userId}`)}
                            data-testid={`exception-user-link-${representative.id}`}
                          >
                            {userName}
                          </Button>
                        ) : (
                          <Typography variant="body2">{userName}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {representative.targetDate ?? representative.updatedAt}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Stack spacing={0.5} alignItems="flex-start">
                          <CorrectiveActionsCell
                            item={representative}
                            onNavigate={navigate}
                            suggestionActions={suggestionActions}
                          />
                          {canExpand && (
                            <Button
                              size="small"
                              variant="text"
                              sx={{ textTransform: 'none', p: 0, minHeight: 'auto' }}
                              onClick={() => toggleGroup(group.userId)}
                              data-testid={`exception-group-toggle-${group.userId}`}
                            >
                              {isExpanded ? '個別例外を隠す' : '個別例外を表示'} ({group.count})
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                    {canExpand && isExpanded && (
                      <TableRow data-testid={`exception-group-details-${group.userId}`}>
                        <TableCell colSpan={6} sx={{ bgcolor: 'grey.50', py: 1.25 }}>
                          <Stack spacing={1}>
                            {group.items.map((item) => {
                              const detailConfig = SEVERITY_CONFIG[item.severity];
                              return (
                                <Paper
                                  key={item.id}
                                  variant="outlined"
                                  sx={{ p: 1, borderRadius: 1, bgcolor: 'background.paper' }}
                                >
                                  <Stack spacing={0.75}>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                      <Chip
                                        label={TEMPERATURE_LABELS[severityToPriority(item.severity) ?? 'P2'] ?? detailConfig.label}
                                        size="small"
                                        color={detailConfig.color}
                                        sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                                      />
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {item.title}
                                      </Typography>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">
                                      {item.description}
                                    </Typography>
                                    <CorrectiveActionsCell
                                      item={item}
                                      onNavigate={navigate}
                                      suggestionActions={suggestionActions}
                                    />
                                  </Stack>
                                </Paper>
                              );
                            })}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

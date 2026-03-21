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
import React, { useMemo, useState } from 'react';
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

// ── Domain ──
import { EmptyStateAction } from '@/components/ui/EmptyStateAction';
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

// ─── Props ──────────────────────────────────────────────────

export type ExceptionTableSortOrder = 'severity' | 'newest' | 'oldest';

type ExceptionDisplayRow =
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
    onCtaClick?: (stableId: string, targetUrl: string) => void;
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
      suggestionActions?.onCtaClick?.(stableId, route);
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
  const [sortOrder, setSortOrder] = useState<ExceptionTableSortOrder>('severity');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

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

    // 2. Corrective-action だけ利用者単位に集約
    const correctiveItems = filtered.filter(
      (item) => item.category === 'corrective-action',
    );
    const nonCorrectiveRows: ExceptionDisplayRow[] = filtered
      .filter((item) => item.category !== 'corrective-action')
      .map((item) => ({
        kind: 'item',
        item,
        sortDate: getExceptionSortDate(item),
        sortSeverity: item.severity,
      }));

    const correctiveRows: ExceptionDisplayRow[] = groupExceptionsByUser(
      correctiveItems,
    ).map((group) => {
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

    const rows = [...nonCorrectiveRows, ...correctiveRows];

    // 3. Sort
    return rows.sort((a, b) => {
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
    });
  }, [items, categoryFilter, severityFilter, sortOrder]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

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

      {/* Filters */}
      {showFilters && items.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
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
        </Stack>
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
                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{
                        borderLeft: 4,
                        borderLeftColor: catMeta.color,
                        '&:last-child td': { borderBottom: 0 },
                      }}
                      data-testid={`exception-row-${item.id}`}
                    >
                      <TableCell>
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
                          <Box sx={{ fontSize: 14 }}>{catMeta.icon}</Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {catMeta.label}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.title}
                        </Typography>
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
                            onClick={() => navigate(`/users/${item.targetUserId}`)}
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
                const catMeta = EXCEPTION_CATEGORIES['corrective-action'];
                const sevConfig = SEVERITY_CONFIG[representative.severity];
                const isExpanded = expandedGroups[group.userId] ?? false;
                const canExpand = group.items.length > 1;
                const userName = group.userName ?? representative.targetUser ?? '—';
                const canOpenUser = group.userId !== '__unknown__';

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
                          {userName} の改善提案 ({group.count}件)
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
                              {isExpanded ? '個別提案を隠す' : '個別提案を表示'} ({group.count})
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

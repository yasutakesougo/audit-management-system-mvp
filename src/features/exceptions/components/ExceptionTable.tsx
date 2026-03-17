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
import {
  EXCEPTION_CATEGORIES,
  type ExceptionCategory,
  type ExceptionItem,
  type ExceptionSeverity,
} from '../domain/exceptionLogic';

// ─── Props ──────────────────────────────────────────────────

export type ExceptionTableProps = {
  items: ExceptionItem[];
  title?: string;
  showFilters?: boolean;
};

// ─── Severity Chip Config ───────────────────────────────────

const SEVERITY_CONFIG: Record<ExceptionSeverity, { label: string; color: 'error' | 'warning' | 'info' | 'default' }> = {
  critical: { label: '緊急', color: 'error' },
  high: { label: '高', color: 'warning' },
  medium: { label: '中', color: 'info' },
  low: { label: '低', color: 'default' },
};

// ─── Component ──────────────────────────────────────────────

export const ExceptionTable: React.FC<ExceptionTableProps> = ({
  items,
  title = '例外一覧',
  showFilters = true,
}) => {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<ExceptionCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<ExceptionSeverity | 'all'>('all');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
      return true;
    });
  }, [items, categoryFilter, severityFilter]);

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
              onChange={(e) => setCategoryFilter(e.target.value as ExceptionCategory | 'all')}
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
              onChange={(e) => setSeverityFilter(e.target.value as ExceptionSeverity | 'all')}
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
        </Stack>
      )}

      {/* Table or Empty */}
      {filteredItems.length === 0 ? (
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
                <TableCell sx={{ fontWeight: 700, width: 100 }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => {
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
                        label={sevConfig.label}
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
                      <Typography variant="body2">
                        {item.targetUser ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {item.targetDate ?? item.updatedAt}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.actionLabel && item.actionPath && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(item.actionPath!)}
                          sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                          data-testid={`exception-action-${item.id}`}
                        >
                          {item.actionLabel}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

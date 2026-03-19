/**
 * OpsListView — 監査・検索向け一覧ビュー
 *
 * 責務:
 * - ScheduleOpsItem[] を受け取り、テーブル形式で一覧表示する
 * - daily とは別用途: 監査・確認・抜け漏れチェック向け
 * - 基本列: 日時 / 利用者 / サービス種別 / 状態 / 担当
 * - sort 最低1軸（日時）
 * - empty state / loading / error 対応
 * - row click で詳細ドロワー
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ListAltIcon from '@mui/icons-material/ListAlt';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type FC, useMemo, useState } from 'react';

import { deriveSupportTags, toOpsServiceType } from '../../domain/scheduleOps';
import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';
import { OpsServiceTypeChip } from './OpsServiceTypeChip';
import { OpsStatusBadge } from './OpsStatusBadge';
import { OpsSupportTagChips } from './OpsSupportTagChips';

// ─── Sort ────────────────────────────────────────────────────────────────────

type SortDirection = 'asc' | 'desc';

function compareDateStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDirection,
): number {
  const aVal = a ?? '';
  const bVal = b ?? '';
  const cmp = aVal.localeCompare(bVal);
  return dir === 'asc' ? cmp : -cmp;
}

// ─── Time Formatter ──────────────────────────────────────────────────────────

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_TIME_FORMATTER.format(d);
}

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsListViewProps = {
  items: readonly ScheduleOpsItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onItemClick: (item: ScheduleOpsItem) => void;
};

export const OpsListView: FC<OpsListViewProps> = ({
  items,
  isLoading,
  error,
  onRetry,
  onItemClick,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => compareDateStrings(a.start, b.start, sortDir));
  }, [items, sortDir]);

  const handleToggleSort = () => {
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // ─── Error State ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            onRetry ? (
              <Button color="inherit" size="small" onClick={onRetry}>
                再試行
              </Button>
            ) : null
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  // ─── Loading State ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={40}
            sx={{ mb: 0.5, borderRadius: 0.5 }}
          />
        ))}
      </Box>
    );
  }

  // ─── Empty State ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <Box
        sx={{
          py: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <ListAltIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="body1" color="text.secondary">
          一覧に表示するデータがありません
        </Typography>
      </Box>
    );
  }

  // ─── Main Table ───────────────────────────────────────────────────────────
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{ borderTop: 1, borderColor: 'divider' }}
    >
      <Table
        sx={{ minWidth: isMobile ? 'auto' : 700 }}
        size="small"
        stickyHeader
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 140 }}>
              <TableSortLabel
                active
                direction={sortDir}
                onClick={handleToggleSort}
              >
                日時
              </TableSortLabel>
            </TableCell>
            <TableCell>利用者名</TableCell>
            <TableCell sx={{ width: 120 }}>サービス種別</TableCell>
            {!isMobile && <TableCell sx={{ width: 220 }}>支援タグ</TableCell>}
            {!isMobile && <TableCell sx={{ width: 120 }}>担当</TableCell>}
            <TableCell sx={{ width: 90 }}>状態</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedItems.map((item) => {
            const isCancelled = item.opsStatus === 'cancelled';
            const tags = deriveSupportTags(item);

            return (
              <TableRow
                key={item.id}
                onClick={() => onItemClick(item)}
                role="button"
                tabIndex={0}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.action.hover, 0.06),
                  },
                  ...(item.hasAttention && {
                    backgroundColor: alpha(theme.palette.error.main, 0.04),
                  }),
                  ...(isCancelled && { opacity: 0.55 }),
                }}
              >
                <TableCell
                  sx={{
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    width: 140,
                  }}
                >
                  {formatDateTime(item.start)}
                </TableCell>
                <TableCell>{item.userName ?? item.title}</TableCell>
                <TableCell sx={{ width: 120 }}>
                  <OpsServiceTypeChip
                    serviceType={toOpsServiceType(item.serviceType)}
                  />
                </TableCell>
                {!isMobile && (
                  <TableCell sx={{ width: 220 }}>
                    <OpsSupportTagChips tags={tags} maxVisible={3} />
                  </TableCell>
                )}
                {!isMobile && (
                  <TableCell sx={{ width: 120 }}>
                    {item.assignedStaffName ?? '—'}
                  </TableCell>
                )}
                <TableCell sx={{ width: 90 }}>
                  <OpsStatusBadge status={item.opsStatus} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/**
 * OpsDailyTable — 日次ビューのメインテーブル
 *
 * loading / empty / error の3状態を内包し、
 * データ行は OpsDailyTableRow に委譲する。
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { FC } from 'react';

import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';
import { OpsDailyTableRow } from './OpsDailyTableRow';

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsDailyTableProps = {
  items: readonly ScheduleOpsItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onItemClick: (item: ScheduleOpsItem) => void;
};

export const OpsDailyTable: FC<OpsDailyTableProps> = ({
  items,
  isLoading,
  error,
  onRetry,
  onItemClick,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ─── 3 State Handlers ────────────────────────────────────────────────────────

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

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={48}
            sx={{ mb: 1, borderRadius: 1 }}
          />
        ))}
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box
        sx={{
          py: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body1" color="text.secondary">
          予定はありません
        </Typography>
      </Box>
    );
  }

  // ─── Main Table ──────────────────────────────────────────────────────────────

  return (
    <TableContainer component={Paper} elevation={0} sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Table sx={{ minWidth: isMobile ? 'auto' : 700 }} size={isMobile ? 'medium' : 'small'} stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 100 }}>時間帯</TableCell>
            <TableCell>利用者名</TableCell>
            <TableCell sx={{ width: 120 }}>サービス種別</TableCell>
            {!isMobile && <TableCell sx={{ width: 220 }}>支援タグ</TableCell>}
            {!isMobile && <TableCell sx={{ width: 120 }}>担当</TableCell>}
            <TableCell sx={{ width: 90 }}>状態</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <OpsDailyTableRow
              key={item.id}
              item={item}
              onClick={onItemClick}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

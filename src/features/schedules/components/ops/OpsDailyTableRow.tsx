/**
 * OpsDailyTableRow — 日次ビューの行コンポーネント
 *
 * item 丸ごと受け取り、click handler は親で持つ。
 */

import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { FC } from 'react';

import { deriveSupportTags, toOpsServiceType } from '../../domain/scheduleOps';
import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';
import { OpsServiceTypeChip } from './OpsServiceTypeChip';
import { OpsStatusBadge } from './OpsStatusBadge';
import { OpsSupportTagChips } from './OpsSupportTagChips';

// ─── Time Formatter ──────────────────────────────────────────────────────────

function formatTimeRange(start?: string | null, end?: string | null): string {
  const fmt = (iso: string | null | undefined): string => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--:--';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return `${fmt(start)}-${fmt(end)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsDailyTableRowProps = {
  item: ScheduleOpsItem;
  onClick: (item: ScheduleOpsItem) => void;
};

export const OpsDailyTableRow: FC<OpsDailyTableRowProps> = ({
  item,
  onClick,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isCancelled = item.opsStatus === 'cancelled';
  const tags = deriveSupportTags(item);

  const rowSx = {
    cursor: 'pointer',
    '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.06) },
    ...(item.hasAttention && {
      backgroundColor: alpha(theme.palette.error.main, 0.04),
    }),
    ...(isCancelled && { opacity: 0.55 }),
  };

  return (
    <TableRow sx={rowSx} onClick={() => onClick(item)} role="button" tabIndex={0}>
      {/* 時間帯 */}
      <TableCell sx={{ whiteSpace: 'nowrap', width: 100, fontVariantNumeric: 'tabular-nums' }}>
        {formatTimeRange(item.start, item.end)}
      </TableCell>

      {/* 利用者名 */}
      <TableCell>
        {item.hasAttention && (
          <ReportProblemIcon
            color="error"
            sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }}
          />
        )}
        {item.userName ?? item.title}
      </TableCell>

      {/* サービス種別 */}
      <TableCell sx={{ width: 120 }}>
        <OpsServiceTypeChip serviceType={toOpsServiceType(item.serviceType)} />
      </TableCell>

      {/* 支援タグ (desktop only) */}
      {!isMobile && (
        <TableCell sx={{ width: 220 }}>
          <OpsSupportTagChips tags={tags} maxVisible={3} />
        </TableCell>
      )}

      {/* 担当職員 (desktop only) */}
      {!isMobile && (
        <TableCell sx={{ width: 120 }}>
          {item.assignedStaffName ?? '—'}
        </TableCell>
      )}

      {/* 状態 */}
      <TableCell sx={{ width: 90 }}>
        <OpsStatusBadge status={item.opsStatus} />
      </TableCell>
    </TableRow>
  );
};

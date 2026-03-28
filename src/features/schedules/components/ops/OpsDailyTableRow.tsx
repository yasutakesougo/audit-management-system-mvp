/**
 * OpsDailyTableRow — 日次ビューの行コンポーネント
 *
 * item 丸ごと受け取り、click handler は親で持つ。
 * Phase 8-A: 利用者状態アイテムは専用チップで表示。
 */

import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import Chip from '@mui/material/Chip';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { FC } from 'react';

import { deriveSupportTags, toOpsServiceType } from '../../domain/scheduleOps';
import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';
import { isUserStatusServiceType, USER_STATUS_LABELS, type UserStatusType } from '../../domain/mappers/userStatus';
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

// ─── User Status Chip Config ─────────────────────────────────────────────────

const STATUS_CHIP_CONFIG: Record<UserStatusType, { emoji: string; color: 'error' | 'warning' | 'info' }> = {
  absence: { emoji: '❌', color: 'error' },
  preAbsence: { emoji: '📅', color: 'info' },
  late: { emoji: '🕐', color: 'warning' },
  earlyLeave: { emoji: '🏃', color: 'warning' },
};

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
  const isUserStatus = isUserStatusServiceType(item.serviceType);
  const tags = deriveSupportTags(item);

  const rowSx = {
    cursor: 'pointer',
    '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.06) },
    ...(item.hasAttention && {
      backgroundColor: alpha(theme.palette.error.main, 0.04),
    }),
    ...(isCancelled && { opacity: 0.55 }),
    ...(isUserStatus && { opacity: 0.75 }),
  };

  return (
    <TableRow sx={rowSx} onClick={() => onClick(item)} role="button" tabIndex={0}>
      {/* 時間帯 */}
      <TableCell sx={{ whiteSpace: 'nowrap', width: 100, fontVariantNumeric: 'tabular-nums' }}>
        {isUserStatus ? '—' : formatTimeRange(item.start, item.end)}
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

      {/* サービス種別 / 利用者状態チップ */}
      <TableCell sx={{ width: 120 }}>
        {isUserStatus ? (
          <Chip
            size="small"
            label={`${STATUS_CHIP_CONFIG[item.serviceType as UserStatusType].emoji} ${USER_STATUS_LABELS[item.serviceType as UserStatusType]}`}
            color={STATUS_CHIP_CONFIG[item.serviceType as UserStatusType].color}
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
        ) : (
          <OpsServiceTypeChip serviceType={toOpsServiceType(item.serviceType)} />
        )}
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

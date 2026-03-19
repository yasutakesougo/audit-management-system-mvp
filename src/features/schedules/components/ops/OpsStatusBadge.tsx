/**
 * OpsStatusBadge — 業務ステータスバッジ
 *
 * opsStatus から表示を決定する。
 * props は型から表示が決まる設計（label を外から渡さない）。
 */

import Chip from '@mui/material/Chip';
import { alpha, useTheme } from '@mui/material/styles';
import type { FC } from 'react';

import type { OpsStatus } from '../../domain/scheduleOpsSchema';
import { OPS_STATUS_LABELS } from '../../domain/scheduleOps';

// ─── Color Mapping ───────────────────────────────────────────────────────────

type StatusColorKey = 'success' | 'info' | 'warning' | 'error' | 'default';

const STATUS_COLOR: Record<OpsStatus, StatusColorKey> = {
  planned: 'default',
  confirmed: 'success',
  changed: 'warning',
  cancelled: 'error',
  completed: 'info',
};

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsStatusBadgeProps = {
  status?: OpsStatus | null;
};

export const OpsStatusBadge: FC<OpsStatusBadgeProps> = ({ status }) => {
  const theme = useTheme();
  const resolved = status ?? 'planned';
  const label = OPS_STATUS_LABELS[resolved];
  const colorKey = STATUS_COLOR[resolved];

  const isCancelled = resolved === 'cancelled';

  // Theme-aware chip colors
  const chipSx =
    colorKey === 'default'
      ? { fontWeight: 600 }
      : {
          fontWeight: 600,
          backgroundColor: alpha(
            theme.palette[colorKey].main,
            isCancelled ? 0.2 : 0.12,
          ),
          color: theme.palette[colorKey].dark,
          ...(isCancelled && { textDecoration: 'line-through' }),
        };

  return (
    <Chip
      label={label}
      size="small"
      variant="filled"
      sx={chipSx}
    />
  );
};

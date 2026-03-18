/**
 * CallLogStatusChip — 対応状況チップ
 *
 * 表示ルール:
 *   new              → "未対応"  (warning)
 *   callback_pending → "折返し待ち" (info)
 *   done             → "完了"    (default + muted)
 *
 * 将来 Today / Drawer でも再利用できるよう独立コンポーネントにする。
 */

import Chip from '@mui/material/Chip';
import React from 'react';
import type { CallLogStatus } from '@/domain/callLogs/schema';

// ─── ラベル／スタイル helper（pure — テスト可能） ───────────────────────────

export const CALL_LOG_STATUS_CONFIG: Record<
  CallLogStatus,
  { label: string; color: 'warning' | 'info' | 'default' }
> = {
  new: { label: '未対応', color: 'warning' },
  callback_pending: { label: '折返し待ち', color: 'info' },
  done: { label: '完了', color: 'default' },
};

/** 対応状況の表示ラベルを返す純粋関数 */
export function getCallLogStatusLabel(status: CallLogStatus): string {
  return CALL_LOG_STATUS_CONFIG[status]?.label ?? status;
}

// ─── Component ────────────────────────────────────────────────────────────────

export type CallLogStatusChipProps = {
  status: CallLogStatus;
  size?: 'small' | 'medium';
};

export const CallLogStatusChip: React.FC<CallLogStatusChipProps> = ({
  status,
  size = 'small',
}) => {
  const { label, color } = CALL_LOG_STATUS_CONFIG[status] ?? {
    label: status,
    color: 'default' as const,
  };

  return (
    <Chip
      label={label}
      color={color}
      size={size}
      variant="outlined"
      data-testid={`call-log-status-chip-${status}`}
    />
  );
};

export default CallLogStatusChip;

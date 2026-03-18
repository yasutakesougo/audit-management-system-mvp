/**
 * CallLogUrgencyChip — 緊急度チップ
 *
 * 表示ルール:
 *   normal → "通常"  (default)
 *   today  → "本日中" (primary)
 *   urgent → "至急"  (error)
 *
 * 将来 Today / Drawer でも再利用できるよう独立コンポーネントにする。
 */

import Chip from '@mui/material/Chip';
import React from 'react';
import type { CallLogUrgency } from '@/domain/callLogs/schema';

// ─── ラベル／スタイル helper（pure — テスト可能） ───────────────────────────

export const CALL_LOG_URGENCY_CONFIG: Record<
  CallLogUrgency,
  { label: string; color: 'default' | 'primary' | 'error' }
> = {
  normal: { label: '通常', color: 'default' },
  today: { label: '本日中', color: 'primary' },
  urgent: { label: '至急', color: 'error' },
};

/** 緊急度の表示ラベルを返す純粋関数 */
export function getCallLogUrgencyLabel(urgency: CallLogUrgency): string {
  return CALL_LOG_URGENCY_CONFIG[urgency]?.label ?? urgency;
}

// ─── Component ────────────────────────────────────────────────────────────────

export type CallLogUrgencyChipProps = {
  urgency: CallLogUrgency;
  size?: 'small' | 'medium';
};

export const CallLogUrgencyChip: React.FC<CallLogUrgencyChipProps> = ({
  urgency,
  size = 'small',
}) => {
  const { label, color } = CALL_LOG_URGENCY_CONFIG[urgency] ?? {
    label: urgency,
    color: 'default' as const,
  };

  return (
    <Chip
      label={label}
      color={color}
      size={size}
      variant={urgency === 'urgent' ? 'filled' : 'outlined'}
      data-testid={`call-log-urgency-chip-${urgency}`}
    />
  );
};

export default CallLogUrgencyChip;

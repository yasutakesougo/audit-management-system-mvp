/**
 * HandoffItemHeader — 申し送りカードのヘッダー行
 *
 * Phase 2 (B-1): HandoffItem.tsx から分割。
 * 時刻 + 利用者名 + 未確認インジケーター + ステータスバッジ を表示。
 */

import {
    AccessTime as AccessTimeIcon,
    CheckCircle as CheckCircleIcon,
    FiberManualRecord as FiberManualRecordIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import { Box, Chip, Stack, Typography } from '@mui/material';
import React from 'react';
import { motionTokens } from '@/app/theme';
import { HANDOFF_STATUS_META } from '../handoffStateMachine';
import type { HandoffStatus } from '../handoffTypes';

// ────────────────────────────────────────────────────────────

/** 時刻フォーマット（HH:MM） */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────

export type HandoffItemHeaderProps = {
  createdAt: string;
  userDisplayName: string;
  status: HandoffStatus;
  isCompleted: boolean;
  isSeen: boolean;
  onStatusToggle: () => void;
};

export const HandoffItemHeader: React.FC<HandoffItemHeaderProps> = React.memo(({
  createdAt,
  userDisplayName,
  status,
  isCompleted,
  isSeen,
  onStatusToggle,
}) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    {/* 時刻 */}
    <Typography
      variant="caption"
      sx={{
        fontWeight: 700,
        color: 'text.secondary',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: 0.5,
        fontSize: '0.7rem',
      }}
    >
      {formatTime(createdAt)}
    </Typography>

    {/* 利用者名 */}
    <Typography
      variant="subtitle2"
      sx={{
        fontWeight: 700,
        color: isCompleted ? 'text.disabled' : 'text.primary',
        lineHeight: 1.2,
      }}
    >
      {userDisplayName}
    </Typography>

    {/* 未確認インジケーター */}
    {!isSeen && (
      <FiberManualRecordIcon
        sx={{
          fontSize: 8,
          color: 'warning.main',
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.4 },
          },
        }}
      />
    )}

    <Box sx={{ flexGrow: 1 }} />

    {/* ステータスバッジ（右端固定） */}
    <Chip
      size="small"
      label={HANDOFF_STATUS_META[status].label}
      color={HANDOFF_STATUS_META[status].color}
      variant={isCompleted ? 'filled' : 'outlined'}
      onClick={onStatusToggle}
      clickable
      icon={
        isCompleted ? <CheckCircleIcon /> :
        status === '対応中' ? <AccessTimeIcon /> :
        <RadioButtonUncheckedIcon />
      }
      sx={{
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 26,
        transition: motionTokens.transition.hoverTransform,
        '&:active': { transform: 'scale(0.95)' },
      }}
    />
  </Stack>
));

HandoffItemHeader.displayName = 'HandoffItemHeader';

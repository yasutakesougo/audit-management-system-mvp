/**
 * HandoffFeedItem — 申し送りライブフィードの個別アイテム表示
 *
 * コンパクトモード（1行サマリー）と通常モード（2行+メタ情報）を
 * サポートする React.memo 化されたサブコンポーネント。
 *
 * @module features/handoff/components/HandoffFeedItem
 */

import { motionTokens } from '@/app/theme';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import React from 'react';
import { getSeverityColor } from '../handoffConstants';
import { FEED_STATUS_NEXT, formatTime, getRelativeTime } from '../handoffFormatters';
import { HANDOFF_STATUS_META } from '../handoffStateMachine';
import type { HandoffRecord, HandoffStatus } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// アニメーション
// ────────────────────────────────────────────────────────────

export const slideIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-12px) scale(0.97);
  }
  60% {
    opacity: 1;
    transform: translateY(2px) scale(1.005);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

export const newItemGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
`;

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export interface FeedItemProps {
  item: HandoffRecord;
  isNew: boolean;
  compact: boolean;
  onStatusChange?: (id: number, newStatus: HandoffStatus) => Promise<void>;
}

// ────────────────────────────────────────────────────────────
// ステータスチップ（compact / normalで共有）
// ────────────────────────────────────────────────────────────

function StatusChip({
  item,
  isCompleted,
  onStatusChange,
  size,
}: {
  item: HandoffRecord;
  isCompleted: boolean;
  onStatusChange?: (id: number, newStatus: HandoffStatus) => Promise<void>;
  size: 'compact' | 'normal';
}) {
  const chipHeight = size === 'compact' ? 20 : 22;
  const fontSize = size === 'compact' ? '0.6rem' : '0.65rem';
  const iconSize = size === 'compact' ? 12 : 14;

  return (
    <Chip
      size="small"
      label={HANDOFF_STATUS_META[item.status].label}
      color={HANDOFF_STATUS_META[item.status].color}
      variant={isCompleted ? 'filled' : 'outlined'}
      onClick={
        onStatusChange
          ? () => {
              const next = FEED_STATUS_NEXT[item.status] ?? '未対応';
              onStatusChange(item.id, next);
            }
          : undefined
      }
      clickable={!!onStatusChange}
      icon={
        isCompleted ? <CheckCircleIcon /> :
        item.status === '対応中' ? <AccessTimeIcon /> :
        <RadioButtonUncheckedIcon />
      }
      sx={{
        height: chipHeight,
        fontSize,
        fontWeight: 600,
        flexShrink: 0,
        '& .MuiChip-icon': { fontSize: iconSize },
        '&:active': { transform: 'scale(0.95)' },
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────

export const FeedItem: React.FC<FeedItemProps> = React.memo(({
  item,
  isNew,
  compact,
  onStatusChange,
}) => {
  const theme = useTheme();
  const isCompleted = item.status === '対応済' || item.status === '完了';

  const severityBorder = (() => {
    switch (item.severity) {
      case '重要':
        return isCompleted ? theme.palette.grey[300] : theme.palette.error.main;
      case '要注意':
        return isCompleted ? theme.palette.grey[300] : theme.palette.warning.main;
      default:
        return isCompleted ? theme.palette.grey[300] : theme.palette.grey[400];
    }
  })();

  return (
    <Box
      sx={{
        animation: isNew ? `${slideIn} 400ms ${motionTokens.easing.decel}` : undefined,
        '&:not(:last-child)': { mb: 0.75 },
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          px: 1.5,
          py: compact ? 0.75 : 1,
          borderLeft: `3px solid ${severityBorder}`,
          opacity: isCompleted ? 0.55 : 1,
          bgcolor: isCompleted
            ? 'transparent'
            : (item.severity === '重要'
              ? alpha(theme.palette.error.main, 0.03)
              : 'background.paper'),
          transition: motionTokens.transition.cardInteractive,
          ...(isNew && {
            animation: `${newItemGlow} 2s ease-out`,
          }),
          '&:hover': {
            bgcolor: alpha(theme.palette.action.hover, 0.06),
            transform: 'translateX(2px)',
          },
        }}
      >
        {compact ? (
          /* ── コンパクト: 1行表示 ── */
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {/* 時刻 */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'text.disabled',
                fontVariantNumeric: 'tabular-nums',
                fontSize: '0.65rem',
                flexShrink: 0,
                width: 36,
              }}
            >
              {formatTime(item.createdAt)}
            </Typography>

            {/* 重要度ドット */}
            {item.severity !== '通常' && (
              <FiberManualRecordIcon
                sx={{
                  fontSize: 8,
                  flexShrink: 0,
                  color: item.severity === '重要' ? 'error.main' : 'warning.main',
                }}
              />
            )}

            {/* 利用者 + メッセージ */}
            <Typography
              variant="caption"
              noWrap
              sx={{
                flex: 1,
                fontSize: '0.72rem',
                color: isCompleted ? 'text.disabled' : 'text.primary',
                ...(isCompleted && {
                  textDecoration: 'line-through',
                  textDecorationColor: alpha(theme.palette.text.disabled, 0.4),
                }),
              }}
            >
              <Box component="span" sx={{ fontWeight: 600, mr: 0.5 }}>
                {item.userDisplayName}
              </Box>
              {item.message.slice(0, 60)}
            </Typography>

            <StatusChip
              item={item}
              isCompleted={isCompleted}
              onStatusChange={onStatusChange}
              size="compact"
            />
          </Stack>
        ) : (
          /* ── 通常: 2行表示 ── */
          <Stack spacing={0.5}>
            {/* Row 1: 時刻 + 利用者 + ステータス */}
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '0.68rem',
                  flexShrink: 0,
                }}
              >
                {formatTime(item.createdAt)}
              </Typography>

              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: isCompleted ? 'text.disabled' : 'text.primary',
                  flex: 1,
                }}
              >
                {item.userDisplayName}
              </Typography>

              {item.severity !== '通常' && (
                <Chip
                  size="small"
                  label={item.severity}
                  color={getSeverityColor(item.severity)}
                  variant="filled"
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                />
              )}

              <StatusChip
                item={item}
                isCompleted={isCompleted}
                onStatusChange={onStatusChange}
                size="normal"
              />
            </Stack>

            {/* Row 2: メッセージ */}
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.78rem',
                lineHeight: 1.5,
                color: isCompleted ? 'text.disabled' : 'text.primary',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                ...(isCompleted && {
                  textDecoration: 'line-through',
                  textDecorationColor: alpha(theme.palette.text.disabled, 0.4),
                }),
              }}
            >
              {item.message}
            </Typography>

            {/* Row 3: メタ情報 */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                size="small"
                label={item.category}
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  borderColor: 'divider',
                  color: 'text.secondary',
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontSize: '0.58rem', ml: 'auto !important' }}
              >
                {getRelativeTime(item.createdAt)} · {item.createdByName}
              </Typography>
            </Stack>
          </Stack>
        )}
      </Paper>
    </Box>
  );
});
FeedItem.displayName = 'FeedItem';

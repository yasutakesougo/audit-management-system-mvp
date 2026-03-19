/**
 * NextCallHero — 最優先 CallLog 1件を Hero 表示するコンポーネント（ZONE A）
 *
 * 責務:
 * - resolveNextCallAction の結果を受け取り、大きく目立つカードで表示
 * - ワンクリックで「完了にする」操作を提供
 * - 全件対応済みなら ✅ 状態を表示
 *
 * 設計:
 * - データは props で受け取るのみ（hook を持たない）
 * - reason に応じて視覚的な緊急度を変える
 * - CallLogPage 専用（Today では使わない）
 */

import React from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PhoneCallbackIcon from '@mui/icons-material/PhoneCallback';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PhoneIcon from '@mui/icons-material/Phone';
import {
  Box,
  Button,
  Chip,
  Fade,
  Stack,
  Typography,
} from '@mui/material';
import type { NextCallAction, NextCallReason } from '../domain/resolveNextCallAction';
import { CallLogStatusChip } from './CallLogStatusChip';
import { CallLogUrgencyChip } from './CallLogUrgencyChip';

// ─── Props ────────────────────────────────────────────────────────────────────

export type NextCallHeroProps = {
  /** resolveNextCallAction の戻り値 */
  action: NextCallAction | null;
  /** 完了にするハンドラ */
  onMarkDone: (id: string) => void;
  /** 更新中フラグ */
  isUpdating: boolean;
};

// ─── 視覚マッピング ──────────────────────────────────────────────────────────

type HeroVisual = {
  borderColor: string;
  bgColor: string;
  icon: React.ReactNode;
  reasonLabel: string;
};

const HERO_VISUALS: Record<NextCallReason, HeroVisual> = {
  overdue: {
    borderColor: 'error.main',
    bgColor: 'error.50',
    icon: <ErrorOutlineIcon color="error" />,
    reasonLabel: '期限超過',
  },
  'due-soon': {
    borderColor: 'warning.main',
    bgColor: 'warning.50',
    icon: <ScheduleIcon color="warning" />,
    reasonLabel: '期限間近',
  },
  urgent: {
    borderColor: 'error.light',
    bgColor: 'transparent',
    icon: <ErrorOutlineIcon color="error" />,
    reasonLabel: '至急',
  },
  today: {
    borderColor: 'warning.light',
    bgColor: 'transparent',
    icon: <ScheduleIcon color="warning" />,
    reasonLabel: '今日中',
  },
  new: {
    borderColor: 'primary.light',
    bgColor: 'transparent',
    icon: <PhoneIcon color="primary" />,
    reasonLabel: '新規',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const NextCallHero: React.FC<NextCallHeroProps> = ({
  action,
  onMarkDone,
  isUpdating,
}) => {
  // 全件対応済み
  if (!action) {
    return (
      <Fade in timeout={300}>
        <Box
          data-testid="next-call-hero-clear"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 2,
            px: 2.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'success.light',
            bgcolor: 'success.50',
          }}
        >
          <Typography sx={{ fontSize: 24 }}>✅</Typography>
          <Box>
            <Typography variant="subtitle2" color="success.dark" fontWeight={700}>
              すべて対応済み
            </Typography>
            <Typography variant="caption" color="text.secondary">
              未対応の電話・連絡ログはありません
            </Typography>
          </Box>
        </Box>
      </Fade>
    );
  }

  const { log, reason, dueInfo } = action;
  const visual = HERO_VISUALS[reason];

  return (
    <Fade in timeout={300}>
      <Box
        data-testid="next-call-hero"
        sx={{
          p: 2.5,
          borderRadius: 2,
          border: '2px solid',
          borderColor: visual.borderColor,
          bgcolor: visual.bgColor,
          position: 'relative',
        }}
      >
        {/* ヘッダー行 */}
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          {visual.icon}
          <Typography
            variant="overline"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'text.secondary',
              fontSize: '0.7rem',
            }}
          >
            次に対応
          </Typography>
          <Chip
            label={visual.reasonLabel}
            size="small"
            color={reason === 'overdue' ? 'error' : reason === 'due-soon' ? 'warning' : 'default'}
            variant={reason === 'overdue' || reason === 'due-soon' ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
          />
          {dueInfo && dueInfo.level !== 'none' && (
            <Chip
              icon={<PhoneCallbackIcon sx={{ fontSize: 14 }} />}
              label={dueInfo.label}
              size="small"
              variant="filled"
              color={reason === 'overdue' ? 'error' : 'warning'}
              sx={{ fontWeight: 700, fontSize: '0.7rem', height: 20 }}
              data-testid="next-call-hero-due-chip"
            />
          )}
        </Stack>

        {/* メイン情報 */}
        <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
          {log.subject}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={2}>
          <Typography variant="body2" color="text.secondary">
            {log.callerName}{log.callerOrg ? ` (${log.callerOrg})` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">→</Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {log.targetStaffName}
          </Typography>
          <CallLogStatusChip status={log.status} />
          <CallLogUrgencyChip urgency={log.urgency} />
        </Stack>

        {/* メッセージプレビュー */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.6,
          }}
        >
          {log.message}
        </Typography>

        {/* CTA */}
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={() => onMarkDone(log.id)}
            disabled={isUpdating}
            data-testid="next-call-hero-done-btn"
          >
            完了にする
          </Button>
        </Stack>
      </Box>
    </Fade>
  );
};

export default NextCallHero;

/**
 * NextActionCard — 行動ナビゲーター
 *
 * Design principle:
 *   Scene = Context  (表示のみ、完了操作なし)
 *   Action = 業務アクション (出欠入力 / 記録 / 申し送り確認 etc.)
 *
 * 場面(Scene)は「いまどこにいるか」を示すラベル。
 * CTA は Scene が導出する実際の業務アクションのみ。
 *
 * スケジュール項目は **時間的コンテキスト** として表示。
 * Start/Done ボタンは存在しない — タスク管理ではなく行動ナビゲーション。
 *
 * 「見慣れ疲れ」対策:
 *   - 理由(reasons)が毎日異なる内容を伝える
 *   - urgency/priority で視覚的トーンが自動変化
 *   - 例外がある日だけ強調が入る
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { motionTokens } from '@/app/theme';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import type { NextActionWithProgress, Urgency } from '../hooks/useNextAction';
import type { SceneNextActionViewModel } from '../hooks/useSceneNextAction';
import { EmptyStateBlock } from './EmptyStateBlock';

export type NextActionCardProps = {
  nextAction: NextActionWithProgress;
  /** 場面ベースのアクション（オプション） */
  sceneAction?: SceneNextActionViewModel;
  /** 場面CTA クリック時のハンドラ */
  onSceneAction?: (target: string, userId?: string) => void;
  /** 空状態CTAクリック時の導線（スケジュール確認等） */
  onEmptyAction?: () => void;
  /** 記録メニュー補助導線（empty state の utility CTA） */
  onMenuAction?: () => void;
};

function formatMinutesUntil(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `あと ${abs}分`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m > 0 ? `あと ${h}時間${m}分` : `あと ${h}時間`;
}

function formatOverdueTime(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs}分`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

const URGENCY_BORDER_COLOR: Record<Urgency, string> = {
  low: 'grey.300',
  medium: 'warning.main',
  high: 'error.main',
};

const SCENE_PRIORITY_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

export const NextActionCard: React.FC<NextActionCardProps> = ({
  nextAction,
  sceneAction,
  onSceneAction,
  onEmptyAction,
  onMenuAction,
}) => {
  const { item, urgency, sceneState } = nextAction;
  const theme = useTheme();
  const isOverdue = sceneState === 'overdue';
  const hasSceneGuidance = !!(sceneAction && sceneAction.priority !== 'low');

  // ── Empty state ───────────────────────────────────────────
  if (!item && !hasSceneGuidance) {
    return (
      <Paper data-testid="today-next-action-card" sx={{ p: { xs: 2, sm: 2.5 } }} elevation={0}>
        <Typography variant="h6" fontWeight="bold" gutterBottom color="primary.main">
          ▶️ 次にやること
        </Typography>
        {sceneAction && (
          <Chip
            label={`📍 ${sceneAction.sceneLabel}`}
            size="small"
            variant="outlined"
            sx={{ mb: 1 }}
            data-testid="scene-label-chip"
          />
        )}
        <EmptyStateBlock
          icon={<EventAvailableIcon />}
          title="今すぐ優先する対応はありません"
          description="必要に応じて他の記録や確認作業を開けます"
          primaryAction={
            onEmptyAction
              ? { label: 'スケジュールを見る', onClick: onEmptyAction, testId: 'today-empty-next-action-cta' }
              : undefined
          }
          secondaryAction={
            onMenuAction
              ? { label: 'その他の記録へ', onClick: onMenuAction, testId: 'today-empty-menu-cta' }
              : undefined
          }
          testId="today-empty-next-action"
        />
      </Paper>
    );
  }

  // ── Active state: scene guidance and/or schedule context ──
  const effectiveUrgency: Urgency =
    sceneAction?.priority === 'critical' ? 'high'
      : sceneAction?.priority === 'high' ? 'medium'
        : urgency;

  const urgencyBg =
    effectiveUrgency === 'high'
      ? alpha(theme.palette.error.main, 0.06)
      : effectiveUrgency === 'medium'
        ? alpha(theme.palette.warning.main, 0.06)
        : theme.palette.background.paper;

  return (
    <Paper
      data-testid="today-next-action-card"
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderLeft: 4,
        borderColor: URGENCY_BORDER_COLOR[effectiveUrgency],
        bgcolor: urgencyBg,
        transition: `border-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}, background-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}`,
      }}
    >
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" fontWeight="bold" color="primary.main">
          ▶️ 次にやること
        </Typography>
        {sceneAction && (
          <Chip
            label={`📍 ${sceneAction.sceneLabel}`}
            size="small"
            variant="outlined"
            data-testid="scene-label-chip"
          />
        )}
      </Box>

      {/* ── Overdue indicator ── */}
      {isOverdue && (
        <Chip
          data-testid="next-action-overdue-chip"
          icon={<WarningAmberIcon />}
          label="未着手"
          color="warning"
          size="small"
          variant="outlined"
          sx={{ mb: 1 }}
        />
      )}

      {/* ── Scene guidance (primary — 行動ナビゲーション) ── */}
      {hasSceneGuidance && (
        <Box sx={{ mb: item ? 1.5 : 0 }}>
          <Typography variant="body1" fontWeight="bold" gutterBottom>
            {sceneAction!.title}
          </Typography>
          {sceneAction!.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {sceneAction!.description}
            </Typography>
          )}
          {sceneAction!.reasons.length > 0 && (
            <Box sx={{ mb: 1.5 }} data-testid="scene-reasons">
              {sceneAction!.reasons.map((reason, i) => (
                <Chip
                  key={i}
                  label={reason}
                  size="small"
                  color={SCENE_PRIORITY_COLOR[sceneAction!.priority] || 'default'}
                  variant="outlined"
                  sx={{ mr: 0.5, mb: 0.5 }}
                  data-testid={`scene-reason-${i}`}
                />
              ))}
            </Box>
          )}
          <Button
            data-testid="scene-action-cta"
            variant="contained"
            size="medium"
            color={sceneAction!.priority === 'critical' ? 'error' : 'primary'}
            onClick={() => onSceneAction?.(sceneAction!.ctaTarget, sceneAction!.userId)}
            sx={{ minHeight: 48, width: { xs: '100%', sm: 'auto' }, px: 3, fontWeight: 'bold' }}
          >
            {sceneAction!.ctaLabel}
          </Button>
        </Box>
      )}

      {/* ── Schedule context (secondary — 時間的コンテキスト) ── */}
      {item && (
        <Box
          sx={{
            ...(hasSceneGuidance && {
              pt: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
            }),
          }}
          data-testid="schedule-context"
        >
          <Typography
            variant={hasSceneGuidance ? 'h5' : 'h4'}
            fontWeight="bold"
            color={isOverdue ? 'warning.main' : 'primary.main'}
          >
            {item.time}
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            {item.title}
          </Typography>
          {item.owner && (
            <Typography variant="caption" color="text.secondary">
              {item.owner}
            </Typography>
          )}
          <Typography
            variant="caption"
            color={isOverdue ? 'warning.main' : effectiveUrgency === 'medium' ? 'warning.main' : 'text.secondary'}
            sx={{
              mt: 0.5,
              display: 'block',
              fontStyle: 'italic',
              fontWeight: isOverdue || effectiveUrgency !== 'low' ? 'bold' : undefined,
            }}
          >
            {isOverdue
              ? `予定時刻を${formatOverdueTime(item.minutesUntil)}過ぎています`
              : formatMinutesUntil(item.minutesUntil)}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

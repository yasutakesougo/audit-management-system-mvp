/**
 * NextActionCard — 次のアクション（Start/Done 実行可能）+ 場面コンテキスト
 *
 * P0: 表示のみ
 * P1-A: Start/Done ボタン + 経過時間 + 完了状態
 * PR-3: sticky 化 + urgency に応じた左ボーダー/背景色
 * Scene: 場面ベースの次アクション表示（オプション）
 * #852: overdue 表示 — 未着手タスクを柔らかく強調（A案）
 */
import { motionTokens } from '@/app/theme';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}分経過`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分経過` : `${h}時間経過`;
}

const URGENCY_COLOR: Record<Urgency, string> = {
  low: 'text.secondary',
  medium: 'warning.main',
  high: 'error.main',
};

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
}) => {
  const { item, status, urgency, sceneState, elapsedMinutes, actions } = nextAction;
  const theme = useTheme();
  const isOverdue = sceneState === 'overdue';

  // Determine effective urgency (scene can override border color when critical)
  const effectiveUrgency: Urgency =
    sceneAction?.priority === 'critical' ? 'high'
      : sceneAction?.priority === 'high' ? 'medium'
        : urgency;

  // Empty state: early return — no sticky Paper wrapper
  if (!item && (!sceneAction || sceneAction.priority === 'low')) {
    return (
      <Paper data-testid="today-next-action-card" sx={{ p: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          ⏭️ 次にやること
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
          title="次の予定はありません"
          description="本日の予定はすべて完了しています。"
          primaryAction={
            onEmptyAction
              ? { label: 'スケジュールを見る', onClick: onEmptyAction, testId: 'today-empty-next-action-cta' }
              : undefined
          }
          testId="today-empty-next-action"
        />
      </Paper>
    );
  }

  // Scene-only mode: no schedule item but scene has actionable items
  if (!item && sceneAction && sceneAction.priority !== 'low') {
    const sceneBg =
      sceneAction.priority === 'critical'
        ? alpha(theme.palette.error.main, 0.06)
        : sceneAction.priority === 'high'
          ? alpha(theme.palette.warning.main, 0.06)
          : theme.palette.background.paper;

    return (
      <Paper
        data-testid="today-next-action-card"
        sx={{
          p: 2,
          position: 'sticky',
          top: theme.spacing(1),
          zIndex: 10,
          borderLeft: 4,
          borderColor: sceneAction.priority === 'critical' ? 'error.main' : 'warning.main',
          bgcolor: sceneBg,
          transition: `border-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}, background-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            ⏭️ 次にやること
          </Typography>
          <Chip
            label={`📍 ${sceneAction.sceneLabel}`}
            size="small"
            variant="outlined"
            data-testid="scene-label-chip"
          />
        </Box>

        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {sceneAction.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {sceneAction.description}
        </Typography>

        {sceneAction.reasons.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            {sceneAction.reasons.map((reason, i) => (
              <Chip
                key={i}
                label={reason}
                size="small"
                color={SCENE_PRIORITY_COLOR[sceneAction.priority] || 'default'}
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
          size="small"
          color={sceneAction.priority === 'critical' ? 'error' : 'primary'}
          onClick={() => onSceneAction?.(sceneAction.ctaTarget, sceneAction.userId)}
          sx={{ minHeight: 44 }}
        >
          {sceneAction.ctaLabel}
        </Button>
      </Paper>
    );
  }

  // Combined mode: schedule item exists
  // urgency-based background using alpha() — theme-agnostic
  const urgencyBg =
    effectiveUrgency === 'high'
      ? alpha(theme.palette.error.main, 0.06)
      : effectiveUrgency === 'medium'
        ? alpha(theme.palette.warning.main, 0.06)
        : theme.palette.background.paper;

  return (
    <Paper
      data-testid="today-next-action-card"
      sx={{
        p: 2,
        position: 'sticky',
        top: theme.spacing(1),
        zIndex: 10,
        borderLeft: 4,
        borderColor: URGENCY_BORDER_COLOR[effectiveUrgency],
        bgcolor: urgencyBg,
        transition: `border-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}, background-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          ⏭️ 次にやること
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

      {/* Overdue badge (#852 — A案: 中立表現) */}
      {isOverdue && status === 'idle' && (
        <Chip
          data-testid="next-action-overdue-chip"
          icon={<WarningAmberIcon />}
          label="未着手"
          color="warning"
          size="small"
          variant="filled"
          sx={{ mb: 1 }}
        />
      )}

      {/* Scene-based guidance (when scene has higher priority) */}
      {sceneAction && sceneAction.priority !== 'low' && (
        <Box
          sx={{
            mb: 1.5,
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(
              sceneAction.priority === 'critical'
                ? theme.palette.error.main
                : theme.palette.warning.main,
              0.08,
            ),
          }}
          data-testid="scene-guidance"
        >
          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
            {sceneAction.title}
          </Typography>
          {sceneAction.reasons.map((reason, i) => (
            <Chip
              key={i}
              label={reason}
              size="small"
              color={SCENE_PRIORITY_COLOR[sceneAction.priority] || 'default'}
              variant="outlined"
              sx={{ mr: 0.5, mb: 0.5 }}
              data-testid={`scene-reason-${i}`}
            />
          ))}
          <Box sx={{ mt: 0.5 }}>
            <Button
              data-testid="scene-action-cta"
              variant="outlined"
              size="small"
              color={sceneAction.priority === 'critical' ? 'error' : 'warning'}
              onClick={() => onSceneAction?.(sceneAction.ctaTarget, sceneAction.userId)}
              sx={{ minHeight: 36 }}
            >
              {sceneAction.ctaLabel}
            </Button>
          </Box>
        </Box>
      )}

      {/* Time + Title (schedule-based) */}
      {item && (
        <>
          <Typography variant="h5" fontWeight="bold" color={isOverdue ? 'warning.main' : 'primary.main'}>
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

          {/* Status line */}
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            {status === 'idle' && (
              <>
                <Typography
                  variant="caption"
                  color={URGENCY_COLOR[urgency]}
                  sx={{ fontStyle: 'italic', flex: 1, fontWeight: urgency !== 'low' ? 'bold' : undefined }}
                >
                  {isOverdue
                    ? `予定時刻を${formatOverdueTime(item.minutesUntil)}過ぎています`
                    : formatMinutesUntil(item.minutesUntil)}
                </Typography>
                <Button
                  data-testid="next-action-start"
                  variant="contained"
                  size="small"
                  color={isOverdue ? 'warning' : 'primary'}
                  startIcon={<PlayArrowIcon />}
                  onClick={actions.start}
                  sx={{ minHeight: 44 }}
                >
                  {isOverdue ? 'いま開始' : '開始'}
                </Button>
              </>
            )}

            {status === 'started' && (
              <>
                <Chip
                  label={elapsedMinutes !== null ? formatElapsed(elapsedMinutes) : '実行中'}
                  color="info"
                  size="small"
                  variant="outlined"
                  sx={{ flex: '0 0 auto' }}
                />
                <Box sx={{ flex: 1 }} />
                <Button
                  data-testid="next-action-done"
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<CheckCircleIcon />}
                  onClick={actions.done}
                  sx={{ minHeight: 44 }}
                >
                  完了
                </Button>
              </>
            )}

            {status === 'done' && (
              <Chip
                data-testid="next-action-done-chip"
                icon={<CheckCircleIcon />}
                label="完了"
                color="success"
                size="small"
                variant="filled"
              />
            )}
          </Box>
        </>
      )}
    </Paper>
  );
};

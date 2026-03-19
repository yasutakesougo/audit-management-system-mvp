/**
 * ActionQueueCard — 未処理キュー表示カード
 *
 * Today 画面で「今日の残タスク」を3カテゴリで集約表示する。
 * 各カテゴリクリックで対象画面へ直接遷移。
 * 全件完了時は EmptyStateAction で「完了 🎉」を表示。
 *
 * カテゴリ:
 *  1. 未入力記録  (source: 'unrecorded')
 *  2. 未確認申し送り (source: 'handoff')
 *  3. その他未完了 (source: 'briefing' | 'deadline' | 'schedule')
 *
 * @see docs/product/screen-catalog.md A1 TodayPage
 * @see docs/product/mvp-backlog.md MVP-002
 * @module features/today/widgets/ActionQueueCard
 */
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Fade from '@mui/material/Fade';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { EmptyStateAction } from '@/components/ui/EmptyStateAction';
import type { TodayTask } from '@/domain/todayEngine';

// ─── Types ───────────────────────────────────────────────────

/** Queue category definition */
export interface QueueCategory {
  /** Category key */
  key: 'unrecorded' | 'handoff' | 'other';
  /** Display label */
  label: string;
  /** Emoji icon */
  icon: string;
  /** Count of items in this category */
  count: number;
  /** Severity color for the count chip */
  color: 'error' | 'warning' | 'info';
  /** Navigation target when clicked */
  href: string;
  /** Optional: reason label for the top priority item (MVP-011) */
  topReasonLabel?: string;
}

export interface ActionQueueCardProps {
  /** TodayEngine task list (already deduped and sorted) */
  tasks: TodayTask[];
  /** Navigate to a route */
  onNavigate: (href: string) => void;
  /** Action when all tasks are done (e.g. navigate to daily record menu) */
  onEmptyAction?: () => void;
}

// ─── Pure Logic (testable) ───────────────────────────────────

/**
 * Aggregate TodayTasks into 3 queue categories.
 *
 * This is a pure function for easy unit testing.
 */
export function buildQueueCategories(tasks: TodayTask[]): QueueCategory[] {
  const incomplete = tasks.filter((t) => !t.completed);

  const unrecordedCount = incomplete.filter((t) => t.source === 'unrecorded').length;
  const handoffCount = incomplete.filter((t) => t.source === 'handoff').length;
  const otherCount = incomplete.filter(
    (t) => t.source !== 'unrecorded' && t.source !== 'handoff',
  ).length;

  return [
    {
      key: 'unrecorded',
      label: '未入力記録',
      icon: '📝',
      count: unrecordedCount,
      color: unrecordedCount > 0 ? 'error' : 'info',
      href: '/daily/activity',
    },
    {
      key: 'handoff',
      label: '未確認申し送り',
      icon: '📨',
      count: handoffCount,
      color: handoffCount > 0 ? 'warning' : 'info',
      href: '/handoff-timeline',
    },
    {
      key: 'other',
      label: '未完了タスク',
      icon: '📋',
      count: otherCount,
      color: otherCount > 0 ? 'warning' : 'info',
      href: '/today',
    },
  ];
}

/** Check if all tasks are done */
export function isAllDone(tasks: TodayTask[]): boolean {
  return tasks.length === 0 || tasks.every((t) => t.completed);
}

// ─── Component ───────────────────────────────────────────────

export const ActionQueueCard: React.FC<ActionQueueCardProps> = ({
  tasks,
  onNavigate,
  onEmptyAction,
}) => {
  const allDone = isAllDone(tasks);
  const categories = buildQueueCategories(tasks);
  const totalRemaining = categories.reduce((sum, c) => sum + c.count, 0);

  // All done → success state
  if (allDone) {
    return (
      <EmptyStateAction
        variant="success"
        icon="🎉"
        title="すべて完了！"
        description="今日の未処理タスクはゼロです"
        actionLabel={onEmptyAction ? '記録メニューを開く' : undefined}
        onAction={onEmptyAction}
        testId="action-queue-all-done"
        minHeight="6vh"
      />
    );
  }

  return (
    <Fade in timeout={300}>
      <Box data-testid="action-queue-card">
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography
            variant="overline"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'text.secondary',
              fontSize: '0.7rem',
            }}
          >
            🎯 未処理キュー
          </Typography>
          <Chip
            label={`残り ${totalRemaining} 件`}
            size="small"
            color={totalRemaining > 3 ? 'error' : 'warning'}
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
        </Stack>

        {/* Category Cards */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
        >
          {categories.map((cat) => (
            <ButtonBase
              key={cat.key}
              data-testid={`action-queue-${cat.key}`}
              onClick={() => onNavigate(cat.href)}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: cat.count > 0 ? `${cat.color}.main` : 'divider',
                bgcolor: cat.count > 0 ? `${cat.color}.main` : 'transparent',
                // Use alpha for background when count > 0
                ...(cat.count > 0 && {
                  bgcolor: 'transparent',
                  borderColor: `${cat.color}.main`,
                }),
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: cat.count > 0
                    ? `${cat.color}.dark`
                    : 'action.hover',
                  ...(cat.count > 0 && {
                    bgcolor: `${cat.color}.main`,
                    color: 'white',
                    '& .MuiTypography-root': { color: 'white' },
                    '& .MuiChip-root': { color: 'white', borderColor: 'white' },
                  }),
                },
              }}
            >
              {/* Icon */}
              <Typography sx={{ fontSize: 24, lineHeight: 1 }}>
                {cat.icon}
              </Typography>

              {/* Count */}
              <Chip
                label={cat.count}
                size="small"
                color={cat.count > 0 ? cat.color : 'default'}
                variant={cat.count > 0 ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  minWidth: 32,
                }}
              />

              {/* Label */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                {cat.label}
              </Typography>

              {/* Priority Reason (MVP-011) */}
              {cat.count > 0 && cat.topReasonLabel && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: `${cat.color}.dark`,
                    bgcolor: `${cat.color}.50`,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    mt: 0.25,
                    lineHeight: 1.4,
                  }}
                  data-testid={`action-queue-reason-${cat.key}`}
                >
                  {cat.topReasonLabel}
                </Typography>
              )}
            </ButtonBase>
          ))}
        </Stack>
      </Box>
    </Fade>
  );
};

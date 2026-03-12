/**
 * TodayTasksCard — Engine-driven task focus widget
 *
 * Phase 3 #3 (#826)
 *
 * Displays the TodayEngine output:
 *   - Focus alert: single most urgent task with reason
 *   - Summary bar: total / completed / remaining counts
 *   - Compact task list (top-5 by priority)
 *
 * Data comes from useTodayTasks() hook.
 * Widget is pure presentation — no data fetching.
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { motionTokens } from '@/app/theme';
import type { FocusTask, TodayTask, TodayTaskSummary } from '@/domain/todayEngine';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FlagIcon from '@mui/icons-material/Flag';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
    Alert,
    Box,
    Chip,
    LinearProgress,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material';
import React from 'react';

// ─── Constants ────────────────────────────────────────────────

/** Maximum tasks shown in the compact list */
const LIST_LIMIT = 5;

/** Source label mapping for display */
const SOURCE_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  unrecorded: { emoji: '🔴', label: '未記録', color: '#e53935' },
  handoff: { emoji: '📋', label: '申し送り', color: '#f57c00' },
  briefing: { emoji: '📢', label: 'ブリーフ', color: '#1976d2' },
  deadline: { emoji: '⏰', label: '期限', color: '#d32f2f' },
  schedule: { emoji: '📅', label: '予定', color: '#388e3c' },
  routine: { emoji: '🔄', label: '定常', color: '#757575' },
};

// ─── Props ────────────────────────────────────────────────────

export interface TodayTasksCardProps {
  tasks: TodayTask[];
  summary: TodayTaskSummary;
  focus: FocusTask | null;
  isLoading: boolean;
  /** Called when user taps a task row */
  onTaskClick?: (task: TodayTask) => void;
}

// ─── Sub-Components ──────────────────────────────────────────

function FocusAlert({ focus }: { focus: FocusTask }) {
  const sourceInfo = SOURCE_LABELS[focus.task.source] ?? SOURCE_LABELS.routine;
  return (
    <Alert
      severity="warning"
      variant="outlined"
      icon={<FlagIcon />}
      data-testid="today-tasks-focus-alert"
      sx={{
        mb: 2,
        '& .MuiAlert-message': { width: '100%' },
        borderColor: 'warning.main',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
          {sourceInfo.emoji} {focus.task.label}
        </Typography>
        <Chip
          size="small"
          label={sourceInfo.label}
          sx={{
            fontSize: '0.65rem',
            height: 20,
            bgcolor: sourceInfo.color,
            color: '#fff',
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {focus.reason}
      </Typography>
    </Alert>
  );
}

function SummaryBar({ summary }: { summary: TodayTaskSummary }) {
  const progress = summary.total > 0 ? (summary.completed / summary.total) * 100 : 0;
  const allDone = summary.remaining === 0 && summary.total > 0;
  return (
    <Box data-testid="today-tasks-summary" sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          進捗: {summary.completed}/{summary.total} 完了
        </Typography>
        <Typography variant="caption" color={allDone ? 'success.main' : 'text.secondary'} fontWeight={allDone ? 700 : 400}>
          {allDone ? '✅ すべて完了' : `残り ${summary.remaining}件`}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        color={allDone ? 'success' : 'primary'}
        sx={{ height: 6, borderRadius: 3 }}
      />
    </Box>
  );
}

function TaskRow({
  task,
  onTaskClick,
}: {
  task: TodayTask;
  onTaskClick?: (task: TodayTask) => void;
}) {
  const sourceInfo = SOURCE_LABELS[task.source] ?? SOURCE_LABELS.routine;
  const isClickable = task.actionType !== 'info' && !task.completed && onTaskClick;

  return (
    <Box
      data-testid={`today-task-row-${task.id}`}
      onClick={() => isClickable && onTaskClick?.(task)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        px: 1,
        borderRadius: 1,
        cursor: isClickable ? 'pointer' : 'default',
        opacity: task.completed ? 0.6 : 1,
        bgcolor: task.completed ? 'action.hover' : 'transparent',
        transition: motionTokens.transition.hoverAll,
        '&:hover': isClickable
          ? { bgcolor: 'action.hover', transform: 'translateX(2px)' }
          : {},
      }}
    >
      {/* Status icon */}
      {task.completed ? (
        <CheckCircleOutlineIcon sx={{ fontSize: 18, color: 'success.main' }} />
      ) : (
        <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: sourceInfo.color }} />
      )}

      {/* Label */}
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          textDecoration: task.completed ? 'line-through' : 'none',
          fontSize: '0.8rem',
        }}
      >
        {task.label}
      </Typography>

      {/* Source chip */}
      <Chip
        size="small"
        label={sourceInfo.label}
        variant="outlined"
        sx={{
          fontSize: '0.6rem',
          height: 18,
          borderColor: sourceInfo.color,
          color: sourceInfo.color,
          '& .MuiChip-label': { px: 0.5 },
        }}
      />

      {/* Due time */}
      {task.dueTime && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          {task.dueTime}
        </Typography>
      )}

      {/* Navigate icon */}
      {isClickable && (
        <NavigateNextIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
      )}
    </Box>
  );
}

// ─── Main Component ──────────────────────────────────────────

export const TodayTasksCard: React.FC<TodayTasksCardProps> = ({
  tasks,
  summary,
  focus,
  isLoading,
  onTaskClick,
}) => {
  if (isLoading) {
    return (
      <Box data-testid="today-tasks-card-loading" sx={{ py: 2 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={8} sx={{ mb: 2, borderRadius: 3 }} />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={32} sx={{ mb: 0.5, borderRadius: 1 }} />
        ))}
      </Box>
    );
  }

  // All tasks complete or no tasks
  if (tasks.length === 0) {
    return (
      <Box
        data-testid="today-tasks-card-empty"
        sx={{
          py: 3,
          textAlign: 'center',
          borderRadius: 2,
          bgcolor: 'rgba(255, 255, 255, 0.03)',
        }}
      >
        <AssignmentIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          今日のタスクはありません
        </Typography>
      </Box>
    );
  }

  const visibleTasks = tasks.slice(0, LIST_LIMIT);
  const hiddenCount = tasks.length - LIST_LIMIT;

  return (
    <Box data-testid="today-tasks-card">
      {/* Focus alert — most urgent task */}
      {focus && <FocusAlert focus={focus} />}

      {/* Summary progress bar */}
      <SummaryBar summary={summary} />

      {/* Compact task list */}
      <Stack spacing={0.25}>
        {visibleTasks.map((task) => (
          <TaskRow key={task.id} task={task} onTaskClick={onTaskClick} />
        ))}
      </Stack>

      {/* Overflow indicator */}
      {hiddenCount > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 1,
            fontStyle: 'italic',
          }}
        >
          他 {hiddenCount}件のタスクがあります
        </Typography>
      )}
    </Box>
  );
};

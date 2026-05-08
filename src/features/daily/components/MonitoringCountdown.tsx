/**
 * MonitoringCountdown — 利用者別モニタリング期限カウントダウン
 *
 * 支援開始日（monitoringBaseDate = ServiceStartDate）を起点に、
 * 90日固定で次回モニタリング期限を表示する。
 */
import { computeMonitoringDeadlineFromSupportStart } from '@/domain/isp/monitoringDeadline';
import { formatDateYmd } from '@/lib/dateFormat';
import EventIcon from '@mui/icons-material/Event';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

export { computeMonitoringDeadlineFromSupportStart } from '@/domain/isp/monitoringDeadline';
export type {
  MonitoringDeadlineState,
  MonitoringDeadlineStatus,
} from '@/domain/isp/monitoringDeadline';

// Legacy compatibility for existing imports (e.g. kiosk)
export interface MonitoringCycleResult {
  prevDate: Date;
  nextDate: Date;
  elapsed: number;
  remaining: number;
  totalDays: number;
  progress: number;
}

export function computeMonitoringCycle(baseDate: Date, now: Date): MonitoringCycleResult {
  const baseDateIso = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
  const nowIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const state = computeMonitoringDeadlineFromSupportStart(baseDateIso, nowIso);
  const nextDate = new Date(`${state.nextDueDate ?? baseDateIso}T00:00:00`);
  const prevDate = new Date(`${baseDateIso}T00:00:00`);
  const totalDays = 90;
  const remaining = state.remainingDays ?? totalDays;
  const elapsed = Math.max(0, totalDays - remaining);
  const progress = Math.min(Math.max((elapsed / totalDays) * 100, 0), 100);
  return { prevDate, nextDate, elapsed, remaining, totalDays, progress };
}

export type MonitoringCountdownProps = {
  userName?: string;
  monitoringBaseDate?: string | null;
  // Backward compatible prop name
  lastAssessmentDate?: string | null;
  today?: Date;
};

function resolveColor(remainingDays: number | null): 'error' | 'warning' | 'primary' {
  if (remainingDays === null) return 'primary';
  if (remainingDays <= 14) return 'error';
  if (remainingDays <= 30) return 'warning';
  return 'primary';
}

export const MonitoringCountdown: React.FC<MonitoringCountdownProps> = ({
  userName,
  monitoringBaseDate,
  lastAssessmentDate,
  today,
}) => {
  const now = useMemo(() => today ?? new Date(), [today]);
  if (!userName) return null;

  const baseDate = monitoringBaseDate ?? lastAssessmentDate ?? null;
  if (!baseDate) {
    return (
      <Tooltip title="この利用者の支援開始日が未設定です" arrow placement="bottom">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 2,
            bgcolor: 'action.hover',
            cursor: 'default',
            flexShrink: 0,
          }}
          data-testid="monitoring-countdown"
        >
          <WarningAmberIcon sx={{ fontSize: '0.9rem', color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
            支援開始日未設定
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const state = computeMonitoringDeadlineFromSupportStart(baseDate, todayIso);
  const color = resolveColor(state.remainingDays);

  if (state.status === 'invalid') {
    return (
      <Tooltip title="支援開始日の形式が不正です" arrow placement="bottom">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 2, bgcolor: 'action.hover' }}>
          <WarningAmberIcon sx={{ fontSize: '0.9rem', color: 'warning.main' }} />
          <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
            支援開始日不正
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={(
        <Box sx={{ p: 0.5 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            モニタリング期限（90日固定）
          </Typography>
          <Typography variant="caption" component="div">
            支援開始日：{formatDateYmd(new Date(`${baseDate}T00:00:00`))}
          </Typography>
          <Typography variant="caption" component="div">
            次回モニタリング期限：{state.nextDueDate ? formatDateYmd(new Date(`${state.nextDueDate}T00:00:00`)) : '未算出'}
          </Typography>
        </Box>
      )}
      arrow
      placement="bottom"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 0.5,
          borderRadius: 2,
          bgcolor: 'action.hover',
          cursor: 'default',
          minWidth: 'fit-content',
          flexShrink: 0,
        }}
        data-testid="monitoring-countdown"
      >
        <EventIcon fontSize="small" color={color} sx={{ fontSize: '1rem' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="caption"
            fontWeight="bold"
            color={`${color}.main`}
            sx={{ fontSize: '0.7rem', lineHeight: 1.2, whiteSpace: 'nowrap' }}
          >
            {state.status === 'overdue'
              ? `期限超過 ${Math.abs(state.remainingDays ?? 0)}日`
              : state.status === 'dueToday'
                ? '期限当日'
                : `次回モニタリング期限まで ${state.remainingDays ?? '--'}日`}
          </Typography>
          {(state.status === 'critical' || state.status === 'warning' || state.status === 'dueToday' || state.status === 'overdue') && (
            <Chip
              label={
                state.status === 'critical'
                  ? '要対応'
                  : state.status === 'warning'
                    ? '注意'
                    : state.status === 'dueToday'
                      ? '当日'
                      : '超過'
              }
              size="small"
              color={state.status === 'warning' ? 'warning' : 'error'}
              sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
            />
          )}
        </Box>
      </Box>
    </Tooltip>
  );
};


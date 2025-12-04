import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

import { TESTIDS, tid } from '../../testids';

export type BriefingMode = 'morning' | 'evening' | 'normal';

export type BriefingPriorityUser = {
  id: string | number;
  name: string;
  reason: string;
  memo?: string;
  priority: 'high' | 'medium' | 'low';
};

export type BriefingDailyStatus = {
  label: string;
  completed: number;
  planned: number;
};

export type BriefingHandoffSummary = {
  total: number;
  alertCount: number;
  actionCount: number;
};

export type BriefingSafety = {
  icon: string;
  status: string;
  conflictCount: number;
  avg7days?: number;
  trendEmoji?: string;
  trendLabel?: string;
  peakTimeSlot?: string;
  peakFrequency?: number;
  managementComment?: string;
  isStable?: boolean;
};

export type BriefingPanelProps = {
  /** 朝会・夕会などのモード */
  mode?: BriefingMode;
  /** 現在日時 */
  now?: Date;
  /** Safety HUD の集約情報 */
  safety: BriefingSafety;
  /** 日次記録（通所・日誌・支援手順など）の進捗 */
  dailyStatuses: BriefingDailyStatus[];
  /** 重点フォロー対象者 */
  priorityUsers?: BriefingPriorityUser[];
  /** 申し送りサマリー */
  handoffSummary?: BriefingHandoffSummary;
  /** 職員向けひと言（任意） */
  greetingMessage?: string;
};

const priorityColorMap: Record<BriefingPriorityUser['priority'], 'error' | 'warning' | 'info'> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

export const BriefingPanel: React.FC<BriefingPanelProps> = ({
  mode = 'normal',
  now = new Date(),
  safety,
  dailyStatuses,
  priorityUsers = [],
  handoffSummary,
  greetingMessage,
}) => {
  const dateLabel = now.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });

  const timeLabel = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const modeLabel =
    mode === 'morning'
      ? '朝会'
      : mode === 'evening'
      ? '夕会'
      : '日次ダッシュボード';

  const defaultGreeting =
    greetingMessage ??
    (mode === 'morning'
      ? '今日1日の安全運行と支援の質をそろえましょう。'
      : mode === 'evening'
      ? '1日の振り返りと、明日への申し送り整理に集中しましょう。'
      : '現在の全体状況をひと目で確認できます。');

  const hasPeakInfo = safety.peakTimeSlot && safety.peakFrequency != null;

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 2, md: 3 },
        mb: 3,
        borderLeft: '6px solid',
        borderColor: safety.isStable ? 'success.main' : 'warning.main',
        bgcolor: safety.isStable ? 'success.50' : 'background.paper',
        borderRadius: 3,
      }}
      data-testid="dashboard-briefing-panel"
    >
      {/* ヘッダー行：日付・モード・時刻 */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            {modeLabel}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.2rem', sm: '1.4rem', md: '1.6rem' }
            }}
          >
            {dateLabel} {timeLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {defaultGreeting}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`Safety: ${safety.status}`}
            icon={<span>{safety.icon}</span>}
            color={safety.isStable ? 'success' : 'warning'}
            variant="filled"
            size="small"
          />
          {safety.avg7days != null && (
            <Chip
              label={`7日平均 ${safety.avg7days.toFixed(1)}件`}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
      </Stack>

      {/* 中段：左 Safety / 右 記録進捗 */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
      >
        {/* Safety HUD サマリー */}
        <Box sx={{ flex: 1, minWidth: 0 }} data-testid="briefing-safety-summary">
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            🛡️ Safety HUD サマリー
          </Typography>

          <Typography variant="body2" sx={{ mb: 0.5 }}>
            予定の重なり: <strong>{safety.conflictCount}</strong> 件
          </Typography>

          {safety.trendLabel && (
            <Typography variant="body2" color="text.secondary">
              トレンド: {safety.trendEmoji} {safety.trendLabel}
            </Typography>
          )}

          {hasPeakInfo && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              負荷の高い時間帯: {safety.peakTimeSlot}{' '}
              （過去7日のうち{String(safety.peakFrequency)}日で重なり）
            </Typography>
          )}

          {safety.managementComment && (
            <Box
              sx={{
                mt: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: safety.isStable ? 'success.50' : 'warning.50',
                border: '1px solid',
                borderColor: safety.isStable ? 'success.light' : 'warning.light',
              }}
            >
              <Typography
                variant="caption"
                color={safety.isStable ? 'success.main' : 'warning.main'}
                sx={{ fontWeight: 600 }}
              >
                管理コメント
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.5, fontStyle: 'italic' }}
              >
                {safety.managementComment}
              </Typography>
            </Box>
          )}
        </Box>

        {/* 記録進捗サマリー */}
        <Box sx={{ flex: 1, minWidth: 0 }} data-testid="briefing-daily-status-list">
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, mb: 0.5 }}
          >
            📝 記録進捗サマリー
          </Typography>

          <Stack spacing={1.2}>
            {dailyStatuses.map((s) => {
              const total = s.planned || 0;
              const rate =
                total > 0 ? Math.round((s.completed / total) * 100) : 0;
              return (
                <Box key={s.label}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="body2">{s.label}</Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      完了 {s.completed}/{total}（{rate}%）
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={rate}
                    sx={{ mt: 0.3, height: 6, borderRadius: 3 }}
                    color={rate >= 90 ? 'success' : rate >= 60 ? 'warning' : 'error'}
                  />
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Stack>

      {/* 下段：重点フォロー ＋ 申し送りサマリー */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        sx={{ mt: 2 }}
      >
        {/* 重点フォロー */}
        <Box sx={{ flex: 1, minWidth: 0 }} data-testid="briefing-priority-users">
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, mb: 0.5 }}
          >
            🎯 今日の重点フォロー
          </Typography>
          {priorityUsers.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              特に重点フォローに指定された利用者はいません。
            </Typography>
          ) : (
            <Stack spacing={1}>
              {priorityUsers.map((u, index) => (
                <Paper
                  key={u.id}
                  variant="outlined"
                  sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: priorityColorMap[u.priority] + '.main',
                      fontSize: 14,
                    }}
                  >
                    {u.name.charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600 }}
                    >
                      {index + 1}. {u.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                    >
                      {u.reason}
                    </Typography>
                    {u.memo && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontStyle: 'italic' }}
                      >
                        📝 {u.memo}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={
                      u.priority === 'high'
                        ? '重要'
                        : u.priority === 'medium'
                        ? '要フォロー'
                        : '確認'
                    }
                    size="small"
                    color={priorityColorMap[u.priority]}
                    variant="outlined"
                  />
                </Paper>
              ))}
            </Stack>
          )}
        </Box>

        {/* 申し送りサマリー */}
        <Box sx={{ flex: 1, minWidth: 0 }} {...tid(TESTIDS['briefing-handoff-summary'])}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, mb: 0.5 }}
          >
            📋 申し送りサマリー
          </Typography>
          <Box {...tid(TESTIDS['dashboard-handoff-summary'])}>
            {handoffSummary ? (
              <Stack spacing={0.5}>
                <Typography
                  variant="body2"
                  {...tid(TESTIDS['dashboard-handoff-summary-total'])}
                >
                  総件数: <strong>{handoffSummary.total}</strong> 件
                </Typography>
                <Typography
                  variant="body2"
                  color="error.main"
                  {...tid(TESTIDS['dashboard-handoff-summary-alert'])}
                >
                  注意: {handoffSummary.alertCount}件
                </Typography>
                <Typography
                  variant="body2"
                  color="warning.main"
                  {...tid(TESTIDS['dashboard-handoff-summary-action'])}
                >
                  対応中: {handoffSummary.actionCount}件
                </Typography>
                <Tooltip title="詳細は下部の『申し送りタイムライン』から確認できます">
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: 'block' }}
                  >
                    ※ 詳細内容は「申し送りタイムライン」で確認してください
                  </Typography>
                </Tooltip>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                申し送りサマリー情報がありません。
              </Typography>
            )}
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
};

export default BriefingPanel;
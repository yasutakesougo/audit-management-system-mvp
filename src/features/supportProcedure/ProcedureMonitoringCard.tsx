import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import WatchLaterRoundedIcon from '@mui/icons-material/WatchLaterRounded';
import {
  Alert,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import type { ProcedureMonitoringSnapshot } from '@/domain/supportProcedure/mock';

type ProcedureMonitoringCardProps = {
  snapshot: ProcedureMonitoringSnapshot;
  personName?: string;
  currentDate?: string;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 100);

const formatDate = (iso?: string | null) => {
  if (!iso) {
    return '未実施';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString('ja-JP');
};

export const ProcedureMonitoringCard: React.FC<ProcedureMonitoringCardProps> = ({
  snapshot,
  personName,
  currentDate,
}) => {
  const referenceDate = React.useMemo(() => (currentDate ? new Date(currentDate) : new Date()), [currentDate]);
  const lastReviewDate = snapshot.lastReviewOn ? new Date(snapshot.lastReviewOn) : null;
  const nextReviewDate = new Date(snapshot.nextReviewDueOn);
  const dayMs = 1000 * 60 * 60 * 24;
  const daysUntilDue = Math.ceil((nextReviewDate.getTime() - referenceDate.getTime()) / dayMs);
  const daysSinceReview = lastReviewDate
    ? Math.max(0, Math.round((referenceDate.getTime() - lastReviewDate.getTime()) / dayMs))
    : null;
  const cycleProgress = daysSinceReview != null && snapshot.cycleDays > 0
    ? clamp((daysSinceReview / snapshot.cycleDays) * 100)
    : 0;
  const overdue = daysUntilDue < 0;
  const approaching = !overdue && daysUntilDue <= 14;

  const outstandingMessages: string[] = [];
  if (snapshot.outstandingActions.requiresPlanUpdate) {
    outstandingMessages.push('支援手順の更新が必要です。');
  }
  if (snapshot.outstandingActions.requiresTeamDebrief) {
    outstandingMessages.push('チームでの振り返りミーティングを実施してください。');
  }
  if (snapshot.outstandingActions.requiresCoachTraining) {
    outstandingMessages.push('支援員のフォローアップ研修が未実施です。');
  }
  if (outstandingMessages.length === 0) {
    outstandingMessages.push('最新の支援手順は有効で、次回レビュー待ちです。');
  }

  const alertSeverity: 'success' | 'warning' | 'error' =
    overdue || snapshot.outstandingActions.requiresPlanUpdate ? 'error'
      : approaching || outstandingMessages.length > 1 ? 'warning'
        : 'success';

  return (
    <Paper variant="outlined">
      <Stack spacing={2} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack spacing={0.25}>
            <Typography variant="h6" component="h3">
              強度行動障害支援モニタリング
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {personName ? `${personName} さん対象 / ` : ''}
              3か月ごとの計画レビュー（周期 {snapshot.cycleDays}日）
            </Typography>
          </Stack>
          <Chip size="small" label={`手順バージョン ${snapshot.planVersion}`} icon={<AutorenewRoundedIcon fontSize="small" />} />
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={lastReviewDate ? 'success' : 'default'}
            variant={lastReviewDate ? 'outlined' : 'filled'}
            label={`前回レビュー: ${formatDate(snapshot.lastReviewOn)}`}
            icon={<EventAvailableRoundedIcon fontSize="small" />}
          />
          <Chip
            size="small"
            color={overdue ? 'error' : approaching ? 'warning' : 'primary'}
            variant={overdue ? 'filled' : 'outlined'}
            label={`次回期日: ${formatDate(snapshot.nextReviewDueOn)}`}
            icon={<WatchLaterRoundedIcon fontSize="small" />}
          />
          <Chip
            size="small"
            variant="outlined"
            color="info"
            label={`レビュワー: ${snapshot.reviewerName}`}
            icon={<AssessmentRoundedIcon fontSize="small" />}
          />
          {snapshot.coachName ? (
            <Chip
              size="small"
              variant="outlined"
              color="secondary"
              label={`担当支援員: ${snapshot.coachName}`}
              icon={<GroupsRoundedIcon fontSize="small" />}
            />
          ) : null}
          <Chip
            size="small"
            variant="outlined"
            color={snapshot.incidentCounts.last30Days > 0 ? 'warning' : 'default'}
            label={`インシデント: 30日内 ${snapshot.incidentCounts.last30Days}件 / 90日内 ${snapshot.incidentCounts.last90Days}件`}
            icon={<PriorityHighRoundedIcon fontSize="small" />}
          />
        </Stack>

        <Stack spacing={0.75}>
          <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <ScheduleRoundedIcon fontSize="small" />
            レビュー周期の進捗（{Math.round(cycleProgress)}%）
          </Typography>
          <LinearProgress
            variant="determinate"
            value={cycleProgress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
              },
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {daysSinceReview != null
              ? `前回レビューから ${daysSinceReview} 日経過 ・ 期日まで ${
                  daysUntilDue >= 0 ? `${daysUntilDue} 日` : `${Math.abs(daysUntilDue)} 日超過`
                }`
              : '前回レビューの日付が未登録です'}
          </Typography>
        </Stack>

        {snapshot.focusNotes ? (
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'grey.50', border: (theme) => `1px dashed ${theme.palette.divider}` }}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <AutorenewRoundedIcon fontSize="small" color="primary" />
              次回レビューのフォーカス
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {snapshot.focusNotes}
            </Typography>
          </Box>
        ) : null}

        <Alert severity={alertSeverity} icon={<PriorityHighRoundedIcon fontSize="small" />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            モニタリング対応状況
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0, typography: 'body2' }}>
            {outstandingMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </Box>
        </Alert>
      </Stack>
    </Paper>
  );
};

ProcedureMonitoringCard.displayName = 'ProcedureMonitoringCard';

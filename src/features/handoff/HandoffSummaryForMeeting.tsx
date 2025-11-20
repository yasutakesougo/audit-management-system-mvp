/**
 * 申し送りサマリーカード（朝会・夕会用）
 *
 * MeetingGuidePageで申し送り状況を表示し、
 * タイムラインへの導線を提供する軽量コンポーネント
 */

import { AccessTime as AccessTimeIcon } from '@mui/icons-material';
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HandoffDayScope } from './handoffTypes';
import { useHandoffSummary } from './useHandoffSummary';

/**
 * 朝会・夕会で申し送り状況を表示するサマリーカード
 *
 * 機能:
 * - 今日の申し送り件数表示（未対応/対応中/対応済別）
 * - 重要・未完了項目のアラート表示
 * - タイムラインページへの導線
 */
type HandoffSummaryForMeetingProps = {
  dayScope?: HandoffDayScope;
  title?: string;
  description?: ReactNode;
  actionLabel?: string;
  onOpenTimeline?: () => void;
};

export default function HandoffSummaryForMeeting({
  dayScope = 'today',
  title = '今日の申し送り状況',
  description,
  actionLabel = '申し送りタイムラインを開く',
  onOpenTimeline,
}: HandoffSummaryForMeetingProps = {}) {
  const navigate = useNavigate();
  const { total, byStatus, criticalCount } = useHandoffSummary({ dayScope });

  const hasData = total > 0;

  const handleOpen = () => {
    if (onOpenTimeline) {
      onOpenTimeline();
      return;
    }
    navigate('/handoff-timeline', { state: { dayScope, timeFilter: 'all' } });
  };

  return (
    <Card sx={{ mb: 2, bgcolor: 'primary.50' }}>
      <CardContent sx={{ pb: 1 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AccessTimeIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {criticalCount > 0 && (
              <Chip
                size="small"
                color="error"
                variant="filled"
                label={`重要・未完了 ${criticalCount}件`}
                sx={{ ml: 'auto' }}
              />
            )}
          </Stack>

          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}

          {hasData ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
              <Chip
                size="small"
                variant={byStatus['未対応'] > 0 ? 'filled' : 'outlined'}
                color="default"
                label={`未対応 ${byStatus['未対応']}件`}
              />
              <Chip
                size="small"
                variant={byStatus['対応中'] > 0 ? 'filled' : 'outlined'}
                color="warning"
                label={`対応中 ${byStatus['対応中']}件`}
              />
              <Chip
                size="small"
                variant={byStatus['対応済'] > 0 ? 'filled' : 'outlined'}
                color="success"
                label={`対応済 ${byStatus['対応済']}件`}
              />
              <Typography
                variant="caption"
                sx={{ ml: 'auto !important', opacity: 0.7 }}
              >
                合計 {total} 件
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              まだ今日の申し送りはありません。気づいたことがあれば、簡単なメモからでも残してみてください。
            </Typography>
          )}
        </Stack>
      </CardContent>
      <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<AccessTimeIcon />}
          onClick={handleOpen}
        >
          {actionLabel}
        </Button>
      </CardActions>
    </Card>
  );
}
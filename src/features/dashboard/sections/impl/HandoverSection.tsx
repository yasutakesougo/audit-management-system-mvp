import React from 'react';
import { Link } from 'react-router-dom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TESTIDS, tid } from '@/testids';
import type { HandoffDayScope } from '@/features/handoff/handoffTypes';

export type HandoverSectionProps = {
  title?: string;
  handoffTotal: number;
  handoffCritical: number;
  handoffStatus: Record<string, number>;
  onOpenTimeline: (scope: HandoffDayScope) => void;
};

export const HandoverSection: React.FC<HandoverSectionProps> = (props) => {
  const { title, handoffTotal, handoffCritical, handoffStatus, onOpenTimeline } = props;

  return (
    <Box data-testid="dashboard-section-handover">
      <Paper elevation={3} sx={{ p: 3 }} {...tid(TESTIDS['dashboard-handoff-summary'])}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle2" lineHeight={1.2} sx={{ fontWeight: 700 }}>
                {title ?? '申し送りタイムライン'}
              </Typography>
              {handoffCritical > 0 && (
                <Chip
                  size="small"
                  color="error"
                  variant="filled"
                  label={`重要・未完了 ${handoffCritical}件`}
                />
              )}
            </Stack>
            <Typography variant="caption" lineHeight={1.3} color="text.secondary">
              今日の申し送り状況を把握して、必要に応じて詳細を確認してください。
            </Typography>
          </Stack>
          <Stack
            spacing={0.75}
            alignItems={{ xs: 'flex-start', md: 'flex-end' }}
            sx={{ width: { xs: '100%', md: 'auto' }, minWidth: 180 }}
          >
            <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
              <Button
                variant="contained"
                startIcon={<AccessTimeIcon />}
                onClick={() => onOpenTimeline('today')}
                size="small"
              >
                タイムラインを開く
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
              <Button variant="text" size="small" onClick={() => onOpenTimeline('yesterday')}>
                前日の申し送り
              </Button>
              <Button variant="text" size="small" component={Link} to="/handoff-timeline">
                一覧を見る
              </Button>
            </Stack>
          </Stack>
        </Stack>
        {handoffTotal > 0 ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color="warning"
              variant={handoffStatus['未対応'] > 0 ? 'filled' : 'outlined'}
              label={`未対応 ${handoffStatus['未対応']}件`}
              {...tid(TESTIDS['dashboard-handoff-summary-alert'])}
            />
            <Chip
              size="small"
              color="info"
              variant={handoffStatus['対応中'] > 0 ? 'filled' : 'outlined'}
              label={`対応中 ${handoffStatus['対応中']}件`}
              {...tid(TESTIDS['dashboard-handoff-summary-action'])}
            />
            <Chip
              size="small"
              color="success"
              variant={handoffStatus['対応済'] > 0 ? 'filled' : 'outlined'}
              label={`対応済 ${handoffStatus['対応済']}件`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`合計 ${handoffTotal}件`}
              {...tid(TESTIDS['dashboard-handoff-summary-total'])}
            />
          </Stack>
        ) : (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            まだ今日の申し送りは登録されていません。気づいたことがあれば /handoff-timeline から追加できます。
          </Alert>
        )}
      </Stack>
    </Paper>
    </Box>
  );
};

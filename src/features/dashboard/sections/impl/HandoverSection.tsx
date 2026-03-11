import type { HandoffDayScope } from '@/features/handoff/handoffTypes';
import { TESTIDS, tid } from '@/testids';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { Link } from 'react-router-dom';

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
      <Paper elevation={1} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }} {...tid(TESTIDS['dashboard-handoff-summary'])}>
        <Stack spacing={1.5}>
          {/* Header row */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            useFlexGap
          >
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
                {title ?? '申し送りタイムライン'}
              </Typography>
              {handoffCritical > 0 && (
                <Chip
                  size="small"
                  color="error"
                  variant="filled"
                  label={`重要 ${handoffCritical}件`}
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              )}
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Button
                variant="contained"
                onClick={() => onOpenTimeline('today')}
                size="small"
                sx={{ fontSize: '0.75rem', px: 1.5, py: 0.5, minHeight: 30, whiteSpace: 'nowrap' }}
              >
                タイムライン
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => onOpenTimeline('yesterday')}
                sx={{ fontSize: '0.7rem', px: 0.75, minHeight: 28, whiteSpace: 'nowrap' }}
              >
                前日
              </Button>
              <Button
                variant="text"
                size="small"
                component={Link}
                to="/handoff-timeline"
                sx={{ fontSize: '0.7rem', px: 0.75, minHeight: 28, whiteSpace: 'nowrap' }}
              >
                一覧
              </Button>
            </Stack>
          </Stack>

          {/* Description */}
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            今日の申し送り状況を把握して、必要に応じて詳細を確認してください。
          </Typography>

          {/* Status chips */}
          {handoffTotal > 0 ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
              <Chip
                size="small"
                color="warning"
                variant={handoffStatus['未対応'] > 0 ? 'filled' : 'outlined'}
                label={`未対応 ${handoffStatus['未対応']}件`}
                sx={{ height: 24, fontSize: '0.72rem' }}
                {...tid(TESTIDS['dashboard-handoff-summary-alert'])}
              />
              <Chip
                size="small"
                color="info"
                variant={handoffStatus['対応中'] > 0 ? 'filled' : 'outlined'}
                label={`対応中 ${handoffStatus['対応中']}件`}
                sx={{ height: 24, fontSize: '0.72rem' }}
                {...tid(TESTIDS['dashboard-handoff-summary-action'])}
              />
              <Chip
                size="small"
                color="success"
                variant={handoffStatus['対応済'] > 0 ? 'filled' : 'outlined'}
                label={`対応済 ${handoffStatus['対応済']}件`}
                sx={{ height: 24, fontSize: '0.72rem' }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`計 ${handoffTotal}件`}
                sx={{ height: 24, fontSize: '0.72rem' }}
                {...tid(TESTIDS['dashboard-handoff-summary-total'])}
              />
            </Stack>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2, py: 0.5 }}>
              今日の申し送りはまだありません
            </Alert>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

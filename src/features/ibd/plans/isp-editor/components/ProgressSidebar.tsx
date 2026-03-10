import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionIcon from '@mui/icons-material/Description';
import DoneIcon from '@mui/icons-material/Done';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import type { ISPComparisonEditorViewProps } from './ISPComparisonEditorView';

export type ProgressSidebarProps = Pick<
  ISPComparisonEditorViewProps,
  'sidebarOpen' | 'toggleSidebar' | 'progress' | 'daysRemaining' | 'domainCoverage' | 'currentPlan'
>;

export const ProgressSidebar: React.FC<ProgressSidebarProps> = ({
  sidebarOpen, toggleSidebar,
  progress, daysRemaining, domainCoverage, currentPlan,
}) => {
  const deadlineColor: 'error' | 'warning' | 'success' =
    daysRemaining < 30 ? 'error' : daysRemaining < 90 ? 'warning' : 'success';

  return (
    <Card
      elevation={1}
      component="aside"
      aria-label="更新進捗サイドバー"
      sx={{
        width: sidebarOpen ? 270 : 52,
        minWidth: sidebarOpen ? 270 : 52,
        transition: 'width 0.3s ease, min-width 0.3s ease',
        overflow: 'hidden',
        flexShrink: 0,
        display: { xs: sidebarOpen ? 'flex' : 'none', md: 'flex' },
        flexDirection: 'column',
      }}
    >
      {/* Toggle */}
      <Box sx={{ display: 'flex', justifyContent: sidebarOpen ? 'flex-end' : 'center', p: 0.5 }}>
        <IconButton
          size="small"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      {sidebarOpen && (
        <CardContent sx={{ flex: 1, overflowY: 'auto', pt: 0 }}>
          <Stack spacing={2.5}>

            {/* ── Section: Progress ── */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <DescriptionIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700} color="primary.dark">
                  更新進捗
                </Typography>
              </Stack>

              <Box sx={{ mb: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress.pct}
                  color="primary"
                  sx={{ height: 8, borderRadius: 99 }}
                  aria-label="更新進捗"
                />
              </Box>
              <Typography variant="caption" color="text.secondary" align="right" display="block">
                {progress.pct}% 完了
              </Typography>

              {/* Steps checklist */}
              <Stack spacing={1} sx={{ mt: 2 }}>
                {progress.steps.map((s) => (
                  <Stack key={s.key} direction="row" spacing={1} alignItems="center">
                    {s.done
                      ? <CheckCircleOutlineIcon sx={{ fontSize: 20, color: 'success.main' }} />
                      : <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: 'grey.300' }} />
                    }
                    <Typography variant="body2" color={s.done ? 'success.dark' : 'text.secondary'}>
                      {s.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Divider />

            {/* ── Section: Deadline ── */}
            <Card
              variant="outlined"
              sx={{
                borderColor: `${deadlineColor}.main`,
                bgcolor: `${deadlineColor}.50`,
              }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  {daysRemaining < 30
                    ? <WarningAmberIcon fontSize="small" color="error" />
                    : <ScheduleIcon fontSize="small" color={deadlineColor} />
                  }
                  <Typography variant="caption" fontWeight={600}>受給者証期限</Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color={daysRemaining < 30 ? 'error.main' : 'text.primary'}>
                  {daysRemaining}
                  <Typography component="span" variant="body2" fontWeight={500} sx={{ ml: 0.5 }}>日</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">{currentPlan.certExpiry}</Typography>
              </CardContent>
            </Card>

            <Divider />

            {/* ── Section: 5-Domain Coverage ── */}
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                5領域カバレッジ
              </Typography>
              <Stack spacing={0.5}>
                {domainCoverage.map((d) => (
                  <Stack
                    key={d.id}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                      px: 1.5, py: 0.75, borderRadius: 1,
                      bgcolor: d.covered ? d.bg : 'grey.50',
                      border: 1,
                      borderColor: d.covered ? d.color + '40' : 'grey.200',
                    }}
                  >
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: d.covered ? d.color : 'grey.400',
                      flexShrink: 0,
                    }} />
                    <Typography
                      variant="caption"
                      sx={{ color: d.covered ? d.color : 'text.disabled', fontWeight: d.covered ? 600 : 400 }}
                    >
                      {d.label}
                    </Typography>
                    {d.covered && <DoneIcon sx={{ fontSize: 14, color: d.color, ml: 'auto' }} />}
                  </Stack>
                ))}
              </Stack>
            </Box>

          </Stack>
        </CardContent>
      )}
    </Card>
  );
};

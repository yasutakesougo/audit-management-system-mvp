import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { useHandoffSummary } from '../useHandoffSummary';
import { useHandoffTimeline } from '../useHandoffTimeline';

interface HandoffMetricsDashboardProps {
  className?: string;
}

/**
 * 申し送りシステムの効果測定ダッシュボード
 * Phase 8B: リアルタイム効果測定機能
 * PoC期間中の効果を即座に可視化
 */
export function HandoffMetricsDashboard({ className }: HandoffMetricsDashboardProps) {
  const { todayHandoffs } = useHandoffTimeline();
  const summary = useHandoffSummary({ dayScope: 'today' });

  const metrics = useMemo(() => {
    const totalHandoffs = todayHandoffs.length;
    const completed = todayHandoffs.filter(h => h.status === '対応済').length;
    const completionRate = totalHandoffs > 0 ? (completed / totalHandoffs) * 100 : 0;
    const activeAlerts = todayHandoffs.filter(h => h.severity === '重要' && h.status !== '対応済').length;

    return {
      totalHandoffs,
      completionRate,
      activeAlerts,
    };
  }, [todayHandoffs]);

  return (
    <Box className={className}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        申し送り効果測定ダッシュボード
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        {/* 総申し送り件数 */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <AssignmentIcon color="primary" />
              <Typography variant="body2" color="text.secondary">
                総申し送り件数
              </Typography>
            </Stack>
            <Typography variant="h4" component="div">
              {metrics.totalHandoffs}
            </Typography>
          </CardContent>
        </Card>

        {/* 対応完了率 */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <CheckCircleIcon color="success" />
              <Typography variant="body2" color="text.secondary">
                対応完了率
              </Typography>
            </Stack>
            <Typography variant="h4" component="div" sx={{ mb: 2 }}>
              {metrics.completionRate.toFixed(1)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={metrics.completionRate}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>

        {/* アクティブアラート */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                重要案件（未対応）
              </Typography>
            </Stack>
            <Typography
              variant="h4"
              component="div"
              color={metrics.activeAlerts > 0 ? 'error.main' : 'success.main'}
              sx={{ mb: 1 }}
            >
              {metrics.activeAlerts}
            </Typography>
            {metrics.activeAlerts > 0 && (
              <Chip
                label="要注意"
                size="small"
                color="error"
                variant="filled"
              />
            )}
          </CardContent>
        </Card>

        {/* 今日の状況サマリー */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              今日の状況
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">未対応</Typography>
                <Chip
                  label={`${summary.byStatus['未対応'] || 0}件`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">対応中</Typography>
                <Chip
                  label={`${summary.byStatus['対応中'] || 0}件`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">対応済</Typography>
                <Chip
                  label={`${summary.byStatus['対応済'] || 0}件`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
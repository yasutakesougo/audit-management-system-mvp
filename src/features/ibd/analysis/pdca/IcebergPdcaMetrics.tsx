/**
 * Iceberg PDCA — Metrics Dashboard Cards
 *
 * Displays daily completion rate, lead time, and weekly/monthly trend cards.
 * Extracted from IcebergPdcaPage.tsx for maintainability.
 *
 * @module features/ibd/analysis/pdca/IcebergPdcaMetrics
 */

import {
    Button,
    Paper,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { TESTIDS } from '@/testids';

import { DEFAULT_TREND_TOLERANCE, type TrendDirection } from './dailyMetricsAdapter';
import { formatMinutes, formatPercent, trendLabel, type DailyMetricsResult } from './icebergPdcaHelpers';

// ============================================================================
// Types
// ============================================================================

interface PeriodMetrics {
  current: {
    completionRate: number;
    averageLeadTimeMinutes: number;
  };
  completionTrend: TrendDirection;
  leadTimeTrend: TrendDirection;
}

export interface IcebergPdcaMetricsProps {
  resolvedDailyMetrics: DailyMetricsResult;
  weeklyMetrics: PeriodMetrics;
  monthlyMetrics: PeriodMetrics;
  trendPeriod: 'weekly' | 'monthly';
  setTrendPeriod: (value: 'weekly' | 'monthly') => void;
  supportRecordJumpTo: string;
  today: string;
}

// ============================================================================
// Component
// ============================================================================

export function IcebergPdcaMetrics({
  resolvedDailyMetrics,
  weeklyMetrics,
  monthlyMetrics,
  trendPeriod,
  setTrendPeriod,
  supportRecordJumpTo,
  today,
}: IcebergPdcaMetricsProps) {
  const completionRateLabel = formatPercent(resolvedDailyMetrics.completionRate);
  const leadTimeLabel = formatMinutes(resolvedDailyMetrics.averageLeadTimeMinutes);

  const activeTrendMetrics = trendPeriod === 'weekly' ? weeklyMetrics : monthlyMetrics;
  const activeCompletionLabel = formatPercent(activeTrendMetrics.current.completionRate);
  const activeLeadTimeLabel = formatMinutes(activeTrendMetrics.current.averageLeadTimeMinutes);
  const activePeriodLabel = trendPeriod === 'weekly' ? '週次' : '月次';

  const completionWorse = activeTrendMetrics.completionTrend === 'down';
  const leadTimeWorse = activeTrendMetrics.leadTimeTrend === 'up';

  const completionTolerancePoint = Math.round(DEFAULT_TREND_TOLERANCE.completionRate * 100);
  const leadTimeToleranceMinutes = DEFAULT_TREND_TOLERANCE.leadTimeMinutes;

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }} data-testid={TESTIDS['pdca-daily-completion-card']}>
          <Typography variant="caption" color="text.secondary">当日入力完了率</Typography>
          <Typography variant="h6" data-testid={TESTIDS['pdca-daily-completion-value']}>
            {completionRateLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {resolvedDailyMetrics.submittedCount}/{resolvedDailyMetrics.targetCount} 名
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }} data-testid={TESTIDS['pdca-daily-leadtime-card']}>
          <Typography variant="caption" color="text.secondary">未送信解消リードタイム</Typography>
          <Typography variant="h6" data-testid={TESTIDS['pdca-daily-leadtime-value']}>
            {leadTimeLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary">平均</Typography>
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5 }} data-testid={TESTIDS['pdca-daily-trend-card']}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>週次 / 月次トレンド</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          {trendPeriod === 'weekly' ? '直近7日' : '直近30日'}の集計
        </Typography>
        <ToggleButtonGroup
          value={trendPeriod}
          exclusive
          size="small"
          onChange={(_, value: 'weekly' | 'monthly' | null) => {
            if (value) {
              setTrendPeriod(value);
            }
          }}
          sx={{ mb: 1 }}
          data-testid={TESTIDS['pdca-trend-period-toggle']}
        >
          <ToggleButton value="weekly" data-testid={TESTIDS['pdca-trend-period-weekly']}>週</ToggleButton>
          <ToggleButton value="monthly" data-testid={TESTIDS['pdca-trend-period-monthly']}>月</ToggleButton>
        </ToggleButtonGroup>
        <Stack spacing={0.5}>
          <Typography
            variant="body2"
            data-testid={TESTIDS['pdca-weekly-completion-trend']}
            aria-label={completionWorse ? '完了率 悪化' : undefined}
            sx={{ fontWeight: completionWorse ? 700 : undefined }}
          >
            {completionWorse ? '⚠ ' : ''}
            {activePeriodLabel}完了率 {activeCompletionLabel} {trendLabel(activeTrendMetrics.completionTrend)}
          </Typography>
          <Typography
            variant="body2"
            data-testid={TESTIDS['pdca-weekly-leadtime-trend']}
            aria-label={leadTimeWorse ? 'リードタイム 悪化' : undefined}
            sx={{ fontWeight: leadTimeWorse ? 700 : undefined }}
          >
            {leadTimeWorse ? '⚠ ' : ''}
            {activePeriodLabel}平均リードタイム {activeLeadTimeLabel} {trendLabel(activeTrendMetrics.leadTimeTrend)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            判定基準: 完了率 ±{completionTolerancePoint}pt / リードタイム ±{leadTimeToleranceMinutes}分
          </Typography>
          <Button
            size="small"
            component={RouterLink}
            to={supportRecordJumpTo}
            aria-label={`支援手順・行動記録へ移動（${today}）`}
            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
          >
            対象日の支援記録へ
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

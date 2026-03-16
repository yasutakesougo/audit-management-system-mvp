/**
 * @fileoverview CycleSpeedCard — サイクル速度 KPI カード
 */
import SpeedIcon from '@mui/icons-material/Speed';
import React from 'react';

import type { PdcaCycleMetricsResult } from '@/domain/metrics/pdcaCycleMetrics';
import { CYCLE_SPEED } from '@/domain/metrics/metricsThresholds';

import OpsMetricCard from './OpsMetricCard';
import type { MetricStatus } from './OpsMetricCard';

export interface CycleSpeedCardProps {
  metrics: PdcaCycleMetricsResult | null;
}

function deriveStatus(medianDays: number): MetricStatus {
  if (medianDays === 0) return 'good'; // データなし
  if (medianDays <= CYCLE_SPEED.GOOD_MAX_DAYS) return 'good';
  if (medianDays <= CYCLE_SPEED.WARNING_MAX_DAYS) return 'warning';
  return 'critical';
}

const CycleSpeedCard: React.FC<CycleSpeedCardProps> = ({ metrics }) => {
  if (!metrics || metrics.totalCycles === 0) {
    return (
      <OpsMetricCard
        title="サイクル速度"
        icon={<SpeedIcon />}
        primaryValue="—"
        primaryLabel="完了サイクルなし"
        status="good"
      />
    );
  }

  const hasCompleted = metrics.medianCycleDays > 0;

  return (
    <OpsMetricCard
      title="サイクル速度"
      icon={<SpeedIcon />}
      primaryValue={hasCompleted ? `${metrics.medianCycleDays}` : '—'}
      primaryUnit={hasCompleted ? '日' : ''}
      primaryLabel={hasCompleted ? '完了サイクル中央値' : '完了サイクルなし'}
      status={deriveStatus(metrics.medianCycleDays)}
      subMetrics={[
        { label: '提案→見直し', value: metrics.medianProposalToReviewDays > 0 ? `${metrics.medianProposalToReviewDays}日` : '—' },
        { label: '見直し→計画更新', value: metrics.medianReviewToPlanUpdateDays > 0 ? `${metrics.medianReviewToPlanUpdateDays}日` : '—' },
        { label: 'モニタリング実施率', value: `${metrics.reviewCompletionRate}%` },
      ]}
    />
  );
};

export default React.memo(CycleSpeedCard);

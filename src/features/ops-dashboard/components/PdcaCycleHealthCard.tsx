/**
 * @fileoverview PdcaCycleHealthCard — PDCA サイクル健全性 KPI カード
 */
import LoopIcon from '@mui/icons-material/Loop';
import React from 'react';

import type { PdcaCycleMetricsResult } from '@/domain/metrics/pdcaCycleMetrics';

import OpsMetricCard from './OpsMetricCard';
import type { MetricStatus } from './OpsMetricCard';

export interface PdcaCycleHealthCardProps {
  metrics: PdcaCycleMetricsResult | null;
}

function deriveStatus(result: PdcaCycleMetricsResult): MetricStatus {
  if (result.overdueCycles > 0) return 'critical';
  if (result.stalledCycles > 0) return 'warning';
  return 'good';
}

const PdcaCycleHealthCard: React.FC<PdcaCycleHealthCardProps> = ({ metrics }) => {
  if (!metrics || metrics.totalCycles === 0) {
    return (
      <OpsMetricCard
        title="PDCA 完走率"
        icon={<LoopIcon />}
        primaryValue="—"
        primaryLabel="サイクルデータなし"
        status="good"
      />
    );
  }

  return (
    <OpsMetricCard
      title="PDCA 完走率"
      icon={<LoopIcon />}
      primaryValue={`${metrics.completionRate}`}
      primaryUnit="%"
      primaryLabel={`${metrics.totalCycles}件中 ${metrics.completedCycles}件完了`}
      status={deriveStatus(metrics)}
      subMetrics={[
        { label: '進行中', value: `${metrics.inProgressCycles}件` },
        { label: '期限超過', value: `${metrics.overdueCycles}件` },
        { label: '停滞中', value: `${metrics.stalledCycles}件` },
      ]}
    />
  );
};

export default React.memo(PdcaCycleHealthCard);

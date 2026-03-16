/**
 * @fileoverview ProposalAdoptionCard — 提案採用率 KPI カード
 */
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import React from 'react';

import type { ProposalMetricsResult } from '@/domain/metrics/proposalMetrics';
import { PROPOSAL_ADOPTION } from '@/domain/metrics/metricsThresholds';

import OpsMetricCard from './OpsMetricCard';
import type { MetricStatus } from './OpsMetricCard';

export interface ProposalAdoptionCardProps {
  metrics: ProposalMetricsResult | null;
}

function deriveStatus(rate: number): MetricStatus {
  if (rate >= PROPOSAL_ADOPTION.GOOD_THRESHOLD) return 'good';
  if (rate >= PROPOSAL_ADOPTION.WARNING_THRESHOLD) return 'warning';
  return 'critical';
}

const ProposalAdoptionCard: React.FC<ProposalAdoptionCardProps> = ({ metrics }) => {
  if (!metrics || metrics.total === 0) {
    return (
      <OpsMetricCard
        title="提案採用率"
        icon={<ThumbUpAltOutlinedIcon />}
        primaryValue="—"
        primaryLabel="提案データなし"
        status="good"
      />
    );
  }

  return (
    <OpsMetricCard
      title="提案採用率"
      icon={<ThumbUpAltOutlinedIcon />}
      primaryValue={`${metrics.acceptanceRate}`}
      primaryUnit="%"
      primaryLabel={`${metrics.total}件中 ${metrics.accepted}件採用`}
      status={deriveStatus(metrics.acceptanceRate)}
      subMetrics={[
        { label: '却下率', value: `${metrics.dismissalRate}%` },
        { label: '保留率', value: `${metrics.deferralRate}%` },
        { label: '判断速度（中央値）', value: `${metrics.medianDecisionDays}日` },
      ]}
    />
  );
};

export default React.memo(ProposalAdoptionCard);

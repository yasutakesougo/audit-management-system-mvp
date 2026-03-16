/**
 * @fileoverview KnowledgeGrowthCard — 組織知化 KPI カード
 */
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import React from 'react';

import type { KnowledgeMetricsResult } from '@/domain/metrics/knowledgeMetrics';

import OpsMetricCard from './OpsMetricCard';
import type { MetricStatus } from './OpsMetricCard';

export interface KnowledgeGrowthCardProps {
  metrics: KnowledgeMetricsResult | null;
}

function deriveStatus(result: KnowledgeMetricsResult): MetricStatus {
  if (result.provenPatternCount >= 3) return 'good';
  if (result.totalDecisions > 0) return 'warning';
  return 'critical';
}

const KnowledgeGrowthCard: React.FC<KnowledgeGrowthCardProps> = ({ metrics }) => {
  if (!metrics || metrics.totalDecisions === 0) {
    return (
      <OpsMetricCard
        title="組織知化"
        icon={<AutoStoriesOutlinedIcon />}
        primaryValue="—"
        primaryLabel="判断記録なし"
        status="good"
      />
    );
  }

  return (
    <OpsMetricCard
      title="組織知化"
      icon={<AutoStoriesOutlinedIcon />}
      primaryValue={`${metrics.provenPatternCount}`}
      primaryUnit="件"
      primaryLabel="成功パターン（採用率≥60%, 出現≥3）"
      status={deriveStatus(metrics)}
      subMetrics={[
        { label: '判断記録（月平均）', value: `${metrics.decisionsPerMonth}件/月` },
        { label: '理由付き却下率', value: `${metrics.reasonedDismissRate}%` },
        { label: 'Evidence Link 密度', value: `${metrics.avgLinksPerSheet}/計画` },
      ]}
    />
  );
};

export default React.memo(KnowledgeGrowthCard);

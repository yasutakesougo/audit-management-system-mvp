import type { DateRange } from '../../hooks/useTelemetryDashboard';
import type { DashboardKpis } from '../../domain/computeCtaKpis';
import type { DashboardKpiDiffs, KpiAlert } from '../../domain/computeCtaKpiDiff';
import type { RoleBreakdown } from '../../domain/computeCtaKpisByRole';
import type { ClassifiedAlert } from '../../domain/classifyAlertState';
import type { AlertPersistence } from '../../domain/computeAlertPersistence';
import type { ReviewLoopSummary } from '../../domain/buildReviewLoopSummary';
import type { TransportKpis } from '@/features/today/transport/computeTransportKpis';
import { RANGE_LABELS } from '../constants/labels';
import { KpiCard } from '../ui/KpiCard';
import { SectionCard } from '../ui/SectionCard';
import { SectionTitle } from '../ui/SectionTitle';
import { EmptyState } from '../ui/EmptyState';
import { FlowDistributionChart } from '../charts/FlowDistributionChart';
import { HeroQueueChart } from '../charts/HeroQueueChart';
import { FunnelChart } from '../charts/FunnelChart';
import { HourlyChart } from '../charts/HourlyChart';
import { RoleBreakdownSection } from '../RoleBreakdownSection';
import { SuggestionLifecycleSection } from '../SuggestionLifecycleSection';
import { ReviewSummarySection } from './ReviewSummarySection';
import { AlertInsightsSection } from './AlertInsightsSection';
import { TransportTelemetrySection } from './TransportTelemetrySection';

type KpiTabContentProps = {
  range: DateRange;
  kpis: DashboardKpis | null;
  kpiDiffs: DashboardKpiDiffs | null;
  roleBreakdown: RoleBreakdown;
  classifiedAlerts: ClassifiedAlert[];
  persistence: AlertPersistence[];
  reviewSummary: ReviewLoopSummary | null;
  transportKpis: TransportKpis;
  transportAlerts: KpiAlert[];
};

export function KpiTabContent({
  range,
  kpis,
  kpiDiffs,
  roleBreakdown,
  classifiedAlerts,
  persistence,
  reviewSummary,
  transportKpis,
  transportAlerts,
}: KpiTabContentProps) {
  if (!kpis) {
    return (
      <SectionCard>
        <EmptyState message="KPI データの算出に必要なイベントがありません" />
      </SectionCard>
    );
  }

  return (
    <>
      <section style={{ marginBottom: 20 }}>
        <SectionTitle>📊 {RANGE_LABELS[range]}の KPI サマリ</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <KpiCard
            label="Hero 利用率"
            value={kpis.heroQueueRatio.heroRate}
            unit="%"
            color="#3b82f6"
            subLabel={`${kpis.heroQueueRatio.heroCount}回 / ${kpis.heroQueueRatio.heroCount + kpis.heroQueueRatio.queueCount}回`}
            diff={kpiDiffs?.heroRate}
          />
          <KpiCard
            label="Queue 利用率"
            value={kpis.heroQueueRatio.queueRate}
            unit="%"
            color="#f59e0b"
            subLabel={`${kpis.heroQueueRatio.queueCount}回`}
            diff={kpiDiffs?.queueRate}
          />
          <KpiCard
            label="完了ファネル"
            value={kpis.funnel[2]?.rate ?? 0}
            unit="%"
            color="#10b981"
            subLabel={`CTA→完了 ${kpis.funnel[2]?.count ?? 0}件`}
            diff={kpiDiffs?.completionRate}
          />
          <KpiCard
            label="CTA 総数"
            value={kpis.totalCtaClicks}
            color="#8b5cf6"
            subLabel={`Landing: ${kpis.totalLandings}回`}
            diff={kpiDiffs?.totalCtaClicks}
          />
        </div>
      </section>

      <SuggestionLifecycleSection range={range} />
      <TransportTelemetrySection kpis={transportKpis} alerts={transportAlerts} />
      <ReviewSummarySection summary={reviewSummary} />
      <AlertInsightsSection classifiedAlerts={classifiedAlerts} persistence={persistence} />
      <RoleBreakdownSection data={roleBreakdown} />

      <SectionCard>
        <SectionTitle>🧭 導線分布（CTA 遷移先）</SectionTitle>
        <FlowDistributionChart data={kpis.flowDistribution} />
      </SectionCard>

      <SectionCard>
        <SectionTitle>🎯 Hero vs Queue 画面別比率</SectionTitle>
        <HeroQueueChart screenKpis={kpis.screenKpis} totalHeroRate={kpis.heroQueueRatio.heroRate} />
      </SectionCard>

      <SectionCard>
        <SectionTitle>🔻 完了ファネル</SectionTitle>
        <FunnelChart steps={kpis.funnel} />
      </SectionCard>

      <SectionCard>
        <SectionTitle>🕐 時間帯別利用分布</SectionTitle>
        <HourlyChart buckets={kpis.hourlyDistribution} />
      </SectionCard>
    </>
  );
}

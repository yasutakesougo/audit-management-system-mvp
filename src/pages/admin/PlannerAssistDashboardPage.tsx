import React from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import type { PlannerAssistMetricsSummary } from '@/features/support-plan-guide/domain/plannerAssistMetrics';
import { PlannerAssistDashboard } from '@/features/support-plan-guide/components/planner-assist/dashboard/PlannerAssistDashboard';

// Моックのmetricsデータ
const mockMetrics: PlannerAssistMetricsSummary = {
  firstNavigation: {
    monitoring: 42,
    planning: 31,
    assessment: 19,
    other: 8,
  },
  actionClickRate: {
    totalSessions: 100,
    clicksPerSession: 2.3,
    totalClicks: 230,
    byCategory: {
      smart: 120,
      monitoring: 80,
      other: 30,
    },
  },
  navigationLatency: {
    latencies: Array.from({ length: 50 }, () => Math.random() * 3000 + 500), // Random distribution
    medianMs: 1250,
    meanMs: 1400,
    p90Ms: 2800,
  },
  adoptionUplift: {
    beforeRate: 0.45,
    afterRate: 0.62,
    sampleCount: 50,
    uplift: 0.17,
    insufficient: false,
  },
};

export const PlannerAssistDashboardPage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        支援品質アシスト利用状況 (Planner Assist Metrics)
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        ※現在はモックデータを表示しています。
      </Typography>

      <PlannerAssistDashboard metrics={mockMetrics} />
    </Container>
  );
};

export default PlannerAssistDashboardPage;

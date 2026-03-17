import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import { FirstNavigationCard } from './FirstNavigationCard';
import { ActionClickRateCard } from './ActionClickRateCard';
import { NavigationLatencyCard } from './NavigationLatencyCard';
import { AdoptionUpliftCard } from './AdoptionUpliftCard';
import type { PlannerAssistMetricsSummary } from '../../../domain/plannerAssistMetrics';

export type PlannerAssistDashboardProps = {
  metrics: PlannerAssistMetricsSummary | null;
};

export const PlannerAssistDashboard: React.FC<PlannerAssistDashboardProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          集計データがありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }} data-testid="planner-assist-dashboard">
      <Typography variant="h5" gutterBottom sx={{ mb: 4 }}>
        Planner Assist 分析ダッシュボード
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FirstNavigationCard distribution={metrics.firstNavigation} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ActionClickRateCard clickRate={metrics.actionClickRate} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <NavigationLatencyCard latency={metrics.navigationLatency} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <AdoptionUpliftCard upliftModel={metrics.adoptionUplift} />
        </Grid>
      </Grid>
    </Box>
  );
};

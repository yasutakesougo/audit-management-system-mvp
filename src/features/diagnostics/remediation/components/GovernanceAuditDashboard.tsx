import React from 'react';
import { Box, Card, Typography, Grid, LinearProgress, Chip, Stack } from '@mui/material';
import { GovernanceAuditStore } from '../domain/governanceAuditStore';

export const GovernanceAuditDashboard: React.FC = () => {
  const store = GovernanceAuditStore.getInstance();
  const report = store.getAnalysisReport();

  const getStatusColor = (rate: number, threshold: number) => 
    rate >= threshold ? 'success' : rate >= threshold - 10 ? 'warning' : 'error';

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f7fa', borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#1a335e' }}>
        Operational Intelligence Calibration (Pilot Monitor)
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        知能の目盛り調整：設計上の判断と人間の合意実績の同期状態を監視しています。
      </Typography>

      <Grid container spacing={2}>
        {/* Trust Metrics */}
        {[
          { label: 'Total Acceptance', value: report.acceptedRate, threshold: 80 },
          { label: 'High Confidence Precision', value: report.highConfidenceAcceptedRate, threshold: 90 },
          { label: 'Auto-Repair Safety', value: report.autoExecutableAcceptedRate, threshold: 95 },
        ].map((metric) => (
          <Grid size={{ xs: 12, md: 4 }} key={metric.label}>
            <Card sx={{ p: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
                {metric.label.toUpperCase()}
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography variant="h4" color={`${getStatusColor(metric.value, metric.threshold)}.main`}>
                  {metric.value.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  / {metric.threshold}% target
                </Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={metric.value} 
                color={getStatusColor(metric.value, metric.threshold)}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </Card>
          </Grid>
        ))}

        {/* Gap Analysis (byReasonKey Top 5) */}
        <Grid size={12}>
          <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              Top Drift Anomalies (byReasonKey)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(report.byReasonKey)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([key, count]) => (
                  <Chip 
                    key={key}
                    label={`${key}: ${count} hits`}
                    variant="outlined"
                    size="small"
                    sx={{ borderColor: count > 3 ? '#ff4d4f' : '#d9d9d9' }}
                  />
                ))}
              {Object.keys(report.byReasonKey).length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No drifts captured yet in the current calibration session.
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>
        
        <Grid size={12}>
          <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Calibration Mode: Memory Only (v4.3 Logic OS)
            </Typography>
            <Chip label="Pilot Live" color="secondary" size="small" variant="filled" />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

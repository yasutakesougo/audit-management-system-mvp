import React from 'react';
import { Card, CardContent, Stack, Typography, Box } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { AuthDiagnosticsSnapshot } from '../hooks/useAuthDiagnosticsSnapshot';

interface AuthDiagnosticsSummaryCardsProps {
  stats: AuthDiagnosticsSnapshot | null;
}

export default function AuthDiagnosticsSummaryCards({
  stats,
}: AuthDiagnosticsSummaryCardsProps): React.ReactElement {
  const recoveryRate = stats ? Math.round(stats.recoveryRate * 100) : 0;

  const totalEvents = stats?.total ?? 0;
  const topReason = stats
    ? Object.entries(stats.byReason)
        .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0]
    : 'N/A';

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
      {/* Card 1: Recovery Rate */}
      <Card sx={{ flex: 1 }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="textSecondary">
              Recovery Rate
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {recoveryRate}%
              </Typography>
              <TrendingUpIcon color="success" />
            </Box>
            <Typography variant="caption" color="textSecondary">
              {stats?.byOutcome.recovered ?? 0} of {totalEvents} events recovered
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Card 2: Recent Activity */}
      <Card sx={{ flex: 1 }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="textSecondary">
              Recent Activity
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {totalEvents}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                events
              </Typography>
            </Box>
            <Typography variant="caption" color="textSecondary">
              Blocked: {stats?.byOutcome.blocked ?? 0}, Manual: {stats?.byOutcome['manual-fix'] ?? 0}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Card 3: Top Reason */}
      <Card sx={{ flex: 1 }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="textSecondary">
              Top Reason
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberIcon color="warning" fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {topReason === 'N/A' ? 'N/A' : topReason}
              </Typography>
            </Box>
            <Typography variant="caption" color="textSecondary">
              {stats && topReason !== 'N/A'
                ? `${stats.byReason[topReason] ?? 0} occurrences`
                : 'No data'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

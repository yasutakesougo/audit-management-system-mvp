import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { formatLatencySec } from './formatters';
import type { NavigationLatency } from '../../../domain/plannerAssistMetrics';

export type NavigationLatencyCardProps = {
  latency: NavigationLatency;
};

export const NavigationLatencyCard: React.FC<NavigationLatencyCardProps> = ({ latency }) => {
  const { latencies, medianMs, meanMs, p90Ms } = latency;
  const samples = latencies.length;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          到達時間 (Navigation Latency)
        </Typography>

        {samples === 0 ? (
          <Typography variant="body2" color="text.secondary">
            データなし
          </Typography>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              サンプル数: {samples}
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  中央値 (Median)
                </Typography>
                <Typography variant="h4" data-testid="latency-median">
                  {formatLatencySec(medianMs)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  平均値 (Mean)
                </Typography>
                <Typography variant="h5" data-testid="latency-mean">
                  {formatLatencySec(meanMs)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  90パーセンタイル (p90)
                </Typography>
                <Typography variant="h6" data-testid="latency-p90">
                  {formatLatencySec(p90Ms)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

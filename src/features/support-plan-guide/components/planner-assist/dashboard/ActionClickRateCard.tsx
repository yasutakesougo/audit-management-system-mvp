import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { formatPercentage } from './formatters';
import type { ActionClickRate } from '../../../domain/plannerAssistMetrics';

export type ActionClickRateCardProps = {
  clickRate: ActionClickRate;
};

export const ActionClickRateCard: React.FC<ActionClickRateCardProps> = ({ clickRate }) => {
  const { totalSessions, clicksPerSession, byCategory, totalClicks } = clickRate;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          アクション押下率 (Action Click Rate)
        </Typography>

        {totalSessions === 0 ? (
          <Typography variant="body2" color="text.secondary">
            データなし
          </Typography>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              平均クリック数: {clicksPerSession.toFixed(1)} / セッション
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              カテゴリ別内訳 ({totalClicks}件中)
            </Typography>

            <Stack spacing={2}>
              {Object.entries(byCategory).map(([cat, clicks]) => {
                const rateOfTotal = totalClicks > 0 ? clicks / totalClicks : 0;
                return (
                  <Box key={cat}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{cat}</Typography>
                      <Typography variant="body2" color="text.secondary" data-testid={`click-rate-${cat}`}>
                        {clicks}回 ({formatPercentage(rateOfTotal)})
                      </Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={rateOfTotal * 100} />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

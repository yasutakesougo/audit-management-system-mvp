import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import { formatPercentage } from './formatters';

export type FirstNavigationCardProps = {
  distribution: Record<string, number>;
};

export const FirstNavigationCard: React.FC<FirstNavigationCardProps> = ({ distribution }) => {
  const categories = ['monitoring', 'planning', 'assessment', 'other'];
  const total = categories.reduce((sum, cat) => sum + (distribution[cat] || 0), 0);

  const entries = categories.map((cat) => {
    const count = distribution[cat] || 0;
    const rate = total > 0 ? count / total : 0;
    return { cat, count, rate };
  });

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          初回遷移先 (First Navigation)
        </Typography>

        {total === 0 ? (
          <Typography variant="body2" color="text.secondary">
            データなし
          </Typography>
        ) : (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.map(({ cat, rate }) => (
              <Box key={cat}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {cat}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" data-testid={`first-nav-rate-${cat}`}>
                    {formatPercentage(rate)}
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={rate * 100} />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

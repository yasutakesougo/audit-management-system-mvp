import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { QuickAction } from '../../domain/userDetailHubLogic';

export type QuickActionCardProps = {
  action: QuickAction;
  onClick: () => void;
};

export const QuickActionCard: React.FC<QuickActionCardProps> = ({ action, onClick }) => (
  <Card
    variant="outlined"
    sx={{ borderRadius: 2, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 3 } }}
    data-testid={`quick-action-${action.key}`}
  >
    <CardActionArea
      onClick={onClick}
      sx={{ p: 2 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ fontSize: 28, lineHeight: 1 }}>{action.icon}</Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {action.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {action.description}
          </Typography>
        </Box>
      </Stack>
    </CardActionArea>
  </Card>
);

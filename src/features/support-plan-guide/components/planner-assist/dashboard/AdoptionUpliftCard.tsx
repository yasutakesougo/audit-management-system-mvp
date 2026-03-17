import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { formatPercentage, formatUplift } from './formatters';
import type { AdoptionUplift } from '../../../domain/plannerAssistMetrics';

export type AdoptionUpliftCardProps = {
  upliftModel: AdoptionUplift;
};

export const AdoptionUpliftCard: React.FC<AdoptionUpliftCardProps> = ({ upliftModel }) => {
  const { beforeRate, afterRate, uplift, insufficient } = upliftModel;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">提案採用率変化 (Adoption Uplift)</Typography>
          {insufficient && (
            <Chip
              icon={<WarningAmberIcon />}
              label="データ不足 (Insufficient)"
              color="warning"
              size="small"
              variant="outlined"
              data-testid="uplift-insufficient-badge"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Uplift (変化量)
            </Typography>
            <Typography
              variant="h4"
              data-testid="uplift-value"
              color={insufficient ? 'text.disabled' : uplift >= 0 ? 'success.main' : 'error.main'}
            >
              {insufficient ? '-' : formatUplift(uplift)}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Before
              </Typography>
              <Typography variant="h6" data-testid="uplift-before">
                {formatPercentage(beforeRate)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                After
              </Typography>
              <Typography variant="h6" data-testid="uplift-after" color={insufficient ? 'text.secondary' : 'text.primary'}>
                {insufficient ? '-' : formatPercentage(afterRate)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

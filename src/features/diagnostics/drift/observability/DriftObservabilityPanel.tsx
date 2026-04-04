import React from 'react';
import {
  Box,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { IDriftEventRepository } from '../domain/DriftEventRepository';
import { useDriftObservability, type DriftObservabilityPeriod } from './useDriftObservability';

type DriftObservabilityPanelProps = {
  repository?: IDriftEventRepository;
  nowProvider?: () => Date;
};

const renderTopList = (
  items: Array<{ key: string; count: number }>,
  emptyLabel: string,
  listTestId: string,
): React.ReactNode => {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" data-testid={`${listTestId}-empty`}>
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <Box component="ol" sx={{ mt: 0, mb: 0, pl: 2.5 }} data-testid={listTestId}>
      {items.map((item) => (
        <li key={item.key}>
          <Typography variant="body2">
            <code>{item.key}</code> ({item.count})
          </Typography>
        </li>
      ))}
    </Box>
  );
};

export const DriftObservabilityPanel: React.FC<DriftObservabilityPanelProps> = ({
  repository,
  nowProvider,
}) => {
  const {
    period,
    setPeriod,
    loading,
    topDriftFields,
    topDriftLists,
    unresolvedCount,
  } = useDriftObservability({ repository, nowProvider });

  const handlePeriodChange = (_event: React.MouseEvent<HTMLElement>, value: DriftObservabilityPeriod | null) => {
    if (!value) return;
    setPeriod(value);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="subtitle1">Drift Observability</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {loading && <CircularProgress size={16} />}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={period}
            onChange={handlePeriodChange}
            aria-label="drift observability period"
          >
            <ToggleButton value="daily" aria-label="日次">
              日次
            </ToggleButton>
            <ToggleButton value="weekly" aria-label="週次">
              週次
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Top Drift Fields
          </Typography>
          {renderTopList(topDriftFields, 'No drift events', 'drift-top-fields')}
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Top Drift Lists
          </Typography>
          {renderTopList(topDriftLists, 'No drift events', 'drift-top-lists')}
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Unresolved Count
          </Typography>
          <Typography variant="h4" lineHeight={1.2} data-testid="drift-unresolved-count">
            {unresolvedCount}
          </Typography>
        </Paper>
      </Stack>
    </Paper>
  );
};

import React from 'react';
import Box from '@mui/material/Box';
import { TESTIDS } from '@/testids';
import HealthObservationForm from '@/features/nurse/observation/HealthObservationForm';

const ObservationBridge: React.FC = () => (
  <Box data-testid={TESTIDS.NURSE_OBS_PAGE} sx={{ '& > *': { width: '100%' } }}>
    <HealthObservationForm />
  </Box>
);

export default ObservationBridge;

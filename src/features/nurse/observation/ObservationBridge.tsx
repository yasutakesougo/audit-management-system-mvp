import HealthObservationForm from '@/features/nurse/observation/HealthObservationForm';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import React from 'react';

const ObservationBridge: React.FC = () => (
  <Box data-testid={TESTIDS.NURSE_OBS_PAGE} sx={{ '& > *': { width: '100%' } }}>
    <HealthObservationForm />
  </Box>
);

export default ObservationBridge;

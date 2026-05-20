import React, { Suspense } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { SectionKey } from '../types';

const TabFallback = <CircularProgress size={20} sx={{ m: 2 }} />;

interface TabPanelProps {
  current: SectionKey;
  value: SectionKey;
  children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({ current, value, children }) => (
  <Box
    role="tabpanel"
    hidden={current !== value}
    id={`support-plan-tabpanel-${value}`}
    aria-labelledby={`support-plan-tab-${value}`}
    sx={{ mt: 2 }}
  >
    {current === value ? <Suspense fallback={TabFallback}>{children}</Suspense> : null}
  </Box>
);

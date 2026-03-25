import React from 'react';
import Typography from '@mui/material/Typography';

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
    {children}
  </Typography>
);

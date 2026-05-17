import React from 'react';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

interface SectionTitleProps {
  number: number;
  title: string;
  desc?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ number, title, desc }) => (
  <Stack spacing={0.5} sx={{ mb: 1 }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip label={`§${number}`} size="small" color="primary" variant="outlined" />
      <Typography variant="h6" fontWeight={700}>{title}</Typography>
    </Stack>
    {desc && <Typography variant="body2" color="text.secondary">{desc}</Typography>}
  </Stack>
);

export default SectionTitle;

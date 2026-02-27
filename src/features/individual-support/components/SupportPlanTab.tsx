// ---------------------------------------------------------------------------
// SupportPlanTab — 「支援計画書」タブ (Pure View)
// ---------------------------------------------------------------------------
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { SupportSection } from '../types';

interface SupportPlanTabProps {
  sections: SupportSection[];
}

export const SupportPlanTab: React.FC<SupportPlanTabProps> = ({ sections }) => (
  <Box sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 2 }}>
    {sections.map((section) => (
      <Paper
        key={section.id}
        elevation={2}
        sx={{
          borderLeft: 6,
          borderColor: section.color,
          p: 3,
          backgroundColor: `${section.color}20`,
        }}
      >
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', fontWeight: 600, mb: 1 }}>
          {section.icon}
          {section.title}
        </Typography>
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {section.description.map((item, index) => (
            <li key={index}>
              <Typography variant="body2" color="text.secondary">
                {item}
              </Typography>
            </li>
          ))}
        </ul>
      </Paper>
    ))}
  </Box>
);

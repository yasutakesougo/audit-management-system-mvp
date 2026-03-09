import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import type { SmartCriterion } from '../data/ispRepo';
import { SMART_CRITERIA } from '../data/ispRepo';
import type { ISPComparisonEditorViewProps } from './ISPComparisonEditorView';

export type SmartGuidePanelProps = Pick<ISPComparisonEditorViewProps, 'showSmart'>;

export const SmartGuidePanel: React.FC<SmartGuidePanelProps> = ({ showSmart }) => (
  <Collapse in={showSmart} timeout={300}>
    <Card
      elevation={0}
      sx={{
        mb: 2,
        bgcolor: 'warning.50',
        border: 1,
        borderColor: 'warning.200',
        borderRadius: 2,
      }}
      id="smart-guide-panel"
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {SMART_CRITERIA.map((c: SmartCriterion) => (
            <Box key={c.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: '1 1 180px' }}>
              <Chip label={c.key} size="small" color="warning" sx={{ fontWeight: 800, minWidth: 32 }} />
              <Box>
                <Typography variant="caption" fontWeight={700}>{c.label}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">{c.hint}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  </Collapse>
);

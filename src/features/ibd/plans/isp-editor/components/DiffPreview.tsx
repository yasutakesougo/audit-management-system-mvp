import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import React from 'react';
import type { DiffSegment } from '../data/ispRepo';

export type DiffPreviewProps = { diff: DiffSegment[] };

export const DiffPreview: React.FC<DiffPreviewProps> = ({ diff }) => (
  <Card
    variant="outlined"
    sx={{ borderStyle: 'dashed', bgcolor: 'grey.50' }}
    aria-live="polite"
    aria-atomic="true"
  >
    <CardHeader
      avatar={<CompareArrowsIcon fontSize="small" color="primary" />}
      title="変更差分プレビュー（監査エビデンス）"
      titleTypographyProps={{ variant: 'caption', fontWeight: 700, color: 'primary.main' }}
      sx={{ pb: 0, pt: 1.5, px: 2 }}
    />
    <CardContent sx={{ pt: 0.5 }}>
      <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
        {diff.map((seg, i) => (
          <Typography
            key={i}
            component="span"
            variant="body2"
            sx={
              seg.type === 'del'
                ? { bgcolor: 'error.50', color: 'error.main', textDecoration: 'line-through', px: 0.3, borderRadius: 0.5 }
                : seg.type === 'add'
                  ? { bgcolor: 'success.50', color: 'success.dark', fontWeight: 700, px: 0.3, borderRadius: 0.5 }
                  : undefined
            }
          >
            {seg.text}
          </Typography>
        ))}
      </Typography>
    </CardContent>
  </Card>
);

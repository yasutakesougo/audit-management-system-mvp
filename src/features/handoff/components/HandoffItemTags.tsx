/**
 * HandoffItemTags — 申し送りカードのタグ行
 *
 * Phase 2 (B-1): HandoffItem.tsx から分割。
 * カテゴリ + 重要度 + 時間帯 + 記録者 を表示。
 */

import { Box, Chip, Stack, Typography } from '@mui/material';
import React from 'react';
import { getSeverityColor } from '../handoffConstants';
import type { HandoffSeverity } from '../handoffTypes';

// ────────────────────────────────────────────────────────────

export type HandoffItemTagsProps = {
  category: string;
  severity: HandoffSeverity;
  timeBand: string;
  createdByName: string;
};

export const HandoffItemTags: React.FC<HandoffItemTagsProps> = React.memo(({
  category,
  severity,
  timeBand,
  createdByName,
}) => (
  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 0.25 }}>
    <Chip
      size="small"
      label={category}
      variant="outlined"
      sx={{
        height: 20,
        fontSize: '0.65rem',
        borderColor: 'divider',
        color: 'text.secondary',
      }}
    />

    {severity !== '通常' && (
      <Chip
        size="small"
        label={severity}
        color={getSeverityColor(severity)}
        variant="filled"
        sx={{
          height: 20,
          fontSize: '0.65rem',
          fontWeight: 600,
        }}
      />
    )}

    <Chip
      size="small"
      label={timeBand}
      variant="outlined"
      sx={{
        height: 20,
        fontSize: '0.65rem',
        borderColor: 'divider',
        color: 'text.secondary',
      }}
    />

    <Box sx={{ flexGrow: 1 }} />

    {/* 記録者（小さく右寄せ） */}
    <Typography
      variant="caption"
      sx={{
        color: 'text.disabled',
        fontSize: '0.6rem',
        whiteSpace: 'nowrap',
      }}
    >
      by {createdByName}
    </Typography>
  </Stack>
));

HandoffItemTags.displayName = 'HandoffItemTags';

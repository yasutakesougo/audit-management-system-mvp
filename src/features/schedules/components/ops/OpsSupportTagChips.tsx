/**
 * OpsSupportTagChips — 支援タグチップ群
 *
 * deriveSupportTags() の出力を表示する。
 * 一覧表示では最大 maxVisible 個 + "+N" で省略する。
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import type { FC } from 'react';

import type { SupportTag } from '../../domain/scheduleOpsSchema';
import { SUPPORT_TAG_LABELS } from '../../domain/scheduleOps';

// ─── Color Mapping ───────────────────────────────────────────────────────────

type TagColorKey = 'default' | 'primary' | 'info' | 'warning' | 'error';

const TAG_COLOR: Record<SupportTag, TagColorKey> = {
  pickup: 'info',
  meal: 'default',
  bath: 'info',
  medication: 'warning',
  overnight: 'primary',
  extension: 'default',
  needsReview: 'error',
  medical: 'error',
  behavioral: 'error',
  firstVisit: 'warning',
  changed: 'warning',
};

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsSupportTagChipsProps = {
  tags: readonly SupportTag[];
  /** 表示最大数（省略時は全表示） */
  maxVisible?: number;
};

export const OpsSupportTagChips: FC<OpsSupportTagChipsProps> = ({
  tags,
  maxVisible,
}) => {
  if (tags.length === 0) return null;

  const visible =
    maxVisible != null && tags.length > maxVisible
      ? tags.slice(0, maxVisible)
      : tags;
  const hiddenCount =
    maxVisible != null ? Math.max(0, tags.length - maxVisible) : 0;
  const hiddenLabels =
    hiddenCount > 0
      ? tags
          .slice(maxVisible)
          .map((t) => SUPPORT_TAG_LABELS[t])
          .join('、')
      : '';

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        alignItems: 'center',
      }}
    >
      {visible.map((tag) => (
        <Chip
          key={tag}
          label={SUPPORT_TAG_LABELS[tag]}
          color={TAG_COLOR[tag]}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 500, fontSize: '0.7rem' }}
        />
      ))}
      {hiddenCount > 0 && (
        <Tooltip title={hiddenLabels} arrow disableInteractive>
          <Chip
            label={`+${hiddenCount}`}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

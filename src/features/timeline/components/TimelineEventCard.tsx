/**
 * TimelineEventCard — タイムラインイベント1件の表示カード
 *
 * 責務:
 *   - source 種別チップ（色分け）
 *   - occurredAt の日時表示
 *   - title / description の表示
 *   - severity に応じた視覚マーカー
 *
 * 設計:
 *   - カードはクリック不可（Phase 3 MVP）
 *   - source チップは最小限の色分けで視認性を確保
 *   - description は長い場合に省略表示（2行まで）
 */

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import {
  type TimelineEvent,
  type TimelineEventSource,
  type TimelineSeverity,
  TIMELINE_SOURCE_LABELS,
} from '@/domain/timeline';
import { motionTokens } from '@/app/theme';

// ─────────────────────────────────────────────
// Source チップカラー
// ─────────────────────────────────────────────

const SOURCE_CHIP_COLORS: Record<
  TimelineEventSource,
  { bg: string; text: string }
> = {
  daily: { bg: '#E8F0E4', text: '#3D6B3C' },
  incident: { bg: '#FDE8E8', text: '#C94A4A' },
  isp: { bg: '#E8EEF9', text: '#3B5998' },
  handoff: { bg: '#FFF3E0', text: '#B45309' },
};

// ─────────────────────────────────────────────
// Severity インジケーター
// ─────────────────────────────────────────────

const SEVERITY_COLORS: Record<TimelineSeverity, string> = {
  info: '#5B8C5A',
  warning: '#D4A843',
  critical: '#C94A4A',
};

// ─────────────────────────────────────────────
// 日時表示
// ─────────────────────────────────────────────

function formatOccurredAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    // T00:00:00 の場合は時刻を省略（Daily など日付のみのソース）
    if (hours === '00' && minutes === '00') {
      return `${month}/${day}`;
    }
    return `${month}/${day} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export interface TimelineEventCardProps {
  event: TimelineEvent;
}

export const TimelineEventCard: React.FC<TimelineEventCardProps> = ({
  event,
}) => {
  const chipColor = SOURCE_CHIP_COLORS[event.source];
  const severityColor = SEVERITY_COLORS[event.severity];

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 2,
        py: 1.5,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        transition: motionTokens.transition.hoverAll,
        '&:hover': {
          borderColor: severityColor,
          boxShadow: `0 0 0 1px ${severityColor}20`,
        },
      }}
    >
      {/* Severity indicator bar */}
      <Box
        sx={{
          width: 4,
          minHeight: '100%',
          bgcolor: severityColor,
          borderRadius: 1,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Header row: source chip + date */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0.5,
          }}
        >
          <Chip
            label={TIMELINE_SOURCE_LABELS[event.source]}
            size="small"
            sx={{
              bgcolor: chipColor.bg,
              color: chipColor.text,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
              '& .MuiChip-label': { px: 1 },
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0 }}
          >
            {formatOccurredAt(event.occurredAt)}
          </Typography>
        </Box>

        {/* Title */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            lineHeight: 1.4,
            mb: event.description ? 0.5 : 0,
          }}
        >
          {event.title}
        </Typography>

        {/* Description (optional, max 2 lines) */}
        {event.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
            }}
          >
            {event.description}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

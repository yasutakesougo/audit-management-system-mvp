/**
 * TimelineEventList — タイムラインイベント一覧
 *
 * 責務:
 *   - event 配列をレンダリング
 *   - 日付降順の一覧表示（日付グループ区切り付き）
 *   - empty state は呼び出し元で処理する前提
 */

import React from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import type { TimelineEvent } from '@/domain/timeline';
import { TimelineEventCard, type TimelineEventCardProps } from './TimelineEventCard';

// ─────────────────────────────────────────────
// 日付グループヘルパー
// ─────────────────────────────────────────────

function toDateKey(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '不明';
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '不明';
  }
}

function formatDateLabel(dateKey: string): string {
  const today = new Date();
  const todayKey = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}/${yesterday.getMonth() + 1}/${yesterday.getDate()}`;

  if (dateKey === todayKey) return '今日';
  if (dateKey === yesterdayKey) return '昨日';
  return dateKey;
}

/** 日付グループに分割（入力は降順ソート済み前提） */
function groupByDate(
  events: readonly TimelineEvent[],
): { dateLabel: string; events: TimelineEvent[] }[] {
  const groups: { dateLabel: string; events: TimelineEvent[] }[] = [];
  let currentKey = '';

  for (const event of events) {
    const key = toDateKey(event.occurredAt);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ dateLabel: formatDateLabel(key), events: [] });
    }
    groups[groups.length - 1].events.push(event);
  }

  return groups;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export interface TimelineEventListProps {
  events: readonly TimelineEvent[];
  /** イベントクリック時のハンドラ */
  onOpen?: TimelineEventCardProps['onOpen'];
}

export const TimelineEventList: React.FC<TimelineEventListProps> = ({
  events,
  onOpen,
}) => {
  if (events.length === 0) return null;

  const groups = groupByDate(events);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {groups.map((group, gi) => (
        <Box key={group.dateLabel}>
          {/* 日付セパレーター */}
          {gi > 0 && <Divider sx={{ mb: 2 }} />}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 1,
              display: 'block',
            }}
          >
            {group.dateLabel}
          </Typography>

          {/* イベントカード群 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {group.events.map((event) => (
              <TimelineEventCard key={event.id} event={event} onOpen={onOpen} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

/**
 * 朝会/夕会タブの共通本体
 *
 * mode ('morning' | 'evening') だけで表示差分をすべて切り替える。
 * 実際の差異は MEETING_CONFIG + MEETING_GUIDES で宣言的に定義されている。
 *
 * 構成:
 * 1. 今日の要点チップ（handoff summary）
 * 2. 安全/記録に関する案内 Alert
 * 3. 申し送りタイムライン（TodayHandoffTimelineList）
 * 4. 進行ガイド（Accordion チェックリスト）
 */

import type { HandoffStats } from '@/features/handoff/TodayHandoffTimelineList';
import { TodayHandoffTimelineList } from '@/features/handoff/TodayHandoffTimelineList';
import type { HandoffRecord, HandoffStatus } from '@/features/handoff/handoffTypes';
import { TESTIDS } from '@/testids';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { MEETING_CONFIG, MEETING_GUIDES } from '../constants';
import type { MeetingMode } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type MeetingTabContentProps = {
  /** 朝会 or 夕会 */
  mode: MeetingMode;

  // -- 今日の要点チップ --
  hasSummaryInfo: boolean;
  total: number;
  criticalCount: number;
  byStatus: Record<string, number>;

  // -- タイムライン --
  timeline: {
    todayHandoffs: HandoffRecord[];
    loading: boolean;
    error: string | null;
    updateHandoffStatus: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
  };
  handoffStats: HandoffStats | null;
  onStatsChange: (stats: HandoffStats | null) => void;
  previewLimit: number;

  // -- Navigation --
  onOpenTimeline: () => void;
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export const MeetingTabContent: React.FC<MeetingTabContentProps> = ({
  mode,
  hasSummaryInfo,
  total,
  criticalCount,
  byStatus,
  timeline,
  handoffStats,
  onStatsChange,
  previewLimit,
  onOpenTimeline,
}) => {
  const config = MEETING_CONFIG[mode];
  const guide = MEETING_GUIDES[mode];

  const summaryTestId = mode === 'morning'
    ? TESTIDS['dashboard-briefing-summary-morning']
    : TESTIDS['dashboard-briefing-summary-evening'];

  const guideTestId = mode === 'morning'
    ? TESTIDS['dashboard-briefing-guide-morning']
    : TESTIDS['dashboard-briefing-guide-evening'];

  return (
    <Stack spacing={3}>
      {/* ── 今日の要点チップ ───────────────────────────── */}
      {hasSummaryInfo && (
        <Paper elevation={3} sx={{ p: 2, mb: 1.5 }} data-testid={summaryTestId}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 700 }}>
              今日の要点
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {criticalCount > 0 && (
                <Chip size="small" color="error" label={`注意 ${criticalCount}`} />
              )}
              {(byStatus['未対応'] ?? 0) > 0 && (
                <Chip size="small" color="warning" label={`未対応 ${byStatus['未対応']}`} />
              )}
              <Chip size="small" color="default" label={`合計 ${total}`} />
            </Stack>
            <Button
              size="small"
              variant="text"
              onClick={onOpenTimeline}
              sx={{ ml: { sm: 'auto' } }}
            >
              タイムラインを見る
            </Button>
          </Stack>
        </Paper>
      )}

      {/* ── 案内 Alert ─────────────────────────────────── */}
      <Alert severity="info">{config.alertText}</Alert>

      {/* ── 申し送りタイムライン ────────────────────────── */}
      <Paper elevation={3} sx={{ p: 2, mb: 1.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 700 }}>
              {config.timelineLabel}
            </Typography>
            <Chip size="small" label={config.chipLabel} color={config.chipColor} />
          </Stack>
          <TodayHandoffTimelineList
            items={timeline.todayHandoffs}
            loading={timeline.loading}
            error={timeline.error}
            updateHandoffStatus={timeline.updateHandoffStatus}
            dayScope={config.dayScope}
            maxItems={previewLimit}
            onStatsChange={onStatsChange}
          />
          {(handoffStats?.total ?? 0) > previewLimit && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" variant="text" onClick={onOpenTimeline}>
                申し送りをもっと見る
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* ── 進行ガイド（チェックリスト） ────────────────── */}
      <Accordion elevation={3} defaultExpanded={false} data-testid={guideTestId}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 700 }}>
            進行ガイド（チェックリスト）
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            {guide.steps.map((step) => (
              <Typography key={step} variant="body2">
                • {step}
              </Typography>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};

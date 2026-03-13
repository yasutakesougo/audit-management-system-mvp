/**
 * HandoffDayView — 日ビュー専用コンポーネント
 *
 * 以下の責務をページから引き受ける:
 * - meetingMode / timeFilter / displayMode (timeline vs grouped) の state 管理
 * - data hook (useHandoffTimeline) の呼び出しと DI 注入
 * - 日ビュー固有のフィルタ UI
 * - handoffStats サマリー
 * - TodayHandoffTimelineList / HandoffUserGroupedView の描画切替
 * - HandoffCategorySummaryCard の表示
 */
import { TESTIDS, tid } from '@/testids';
import {
  Nightlight as EveningIcon,
  Groups as MeetingIcon,
  Person as PersonIcon,
  ViewList as ViewListIcon,
  WbSunny as MorningIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import HandoffCategorySummaryCard from '../HandoffCategorySummaryCard';
import { TodayHandoffTimelineList } from '../TodayHandoffTimelineList';
import { HandoffUserGroupedView } from '../components/HandoffUserGroupedView';
import { HANDOFF_TIME_FILTER_LABELS } from '../handoffTypes';
import type { HandoffDayScope, MeetingMode } from '../handoffTypes';
import { addDays, formatDateLocal } from '../hooks/useHandoffDateNav';
import { useHandoffTimeline } from '../useHandoffTimeline';
import { useHandoffTimelineViewModel } from '../useHandoffTimelineViewModel';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** 表示モード: 時系列フラット or 利用者グループ */
type HandoffDisplayMode = 'timeline' | 'grouped';

export type HandoffDayViewProps = {
  /** 表示用の日付ラベル (例: "3月13日(木)") */
  dateLabel: string;
  /** dayScope 値 ('today' | 'yesterday') — data hook に渡す */
  dayScope: HandoffDayScope;
  /** /today からの遷移かどうか — デフォルト表示モードに影響 */
  fromToday: boolean;
  /** dateNav の日付移動関数 — 会議モード切替時に使用 */
  goToDate: (date: string) => void;
  /** dateNav の今日移動関数 — 会議モード切替時に使用 */
  goToToday: () => void;
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function HandoffDayView({
  dateLabel,
  dayScope,
  fromToday,
  goToDate,
  goToToday,
}: HandoffDayViewProps) {
  // ── Day 固有 state ──
  const [displayMode, setDisplayMode] = useState<HandoffDisplayMode>(
    fromToday ? 'grouped' : 'timeline',
  );

  // VM: timeFilter / meetingMode / workflowActions
  const {
    timeFilter,
    handoffStats,
    setHandoffStats,
    handleTimeFilterChange,
    meetingMode,
    handleMeetingModeChange: vmHandleMeetingModeChange,
    workflowActions,
    injectDI,
  } = useHandoffTimelineViewModel({
    navState: {
      dayScope,
      timeFilter: undefined,
    },
  });

  // 会議モード切替時に dateNav の日付も連動移動
  const handleMeetingModeChange = useCallback(
    (event: React.MouseEvent<HTMLElement>, newMode: string) => {
      vmHandleMeetingModeChange(event, newMode as MeetingMode);
      if (newMode === 'morning') {
        goToDate(addDays(formatDateLocal(), -1));
      } else if (newMode === 'evening') {
        goToToday();
      }
    },
    [vmHandleMeetingModeChange, goToDate, goToToday],
  );

  // データ取得
  const {
    todayHandoffs,
    loading: timelineLoading,
    error: timelineError,
    updateHandoffStatus,
  } = useHandoffTimeline(timeFilter, dayScope);

  // DI 注入
  injectDI({ updateHandoffStatus, currentRecords: todayHandoffs });

  return (
    <>
      {/* ── Day 固有フィルタ群 ── */}
      <Box
        sx={{
          mt: 2,
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flexWrap: 'wrap',
          rowGap: 1.5,
        }}
      >
        {/* 会議モード切替 */}
        <ToggleButtonGroup
          value={meetingMode}
          exclusive
          onChange={handleMeetingModeChange}
          size="small"
          color="primary"
        >
          <ToggleButton value="normal">
            <MeetingIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            通常
          </ToggleButton>
          <ToggleButton value="evening">
            <EveningIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            🌆 夕会
          </ToggleButton>
          <ToggleButton value="morning">
            <MorningIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            🌅 朝会
          </ToggleButton>
        </ToggleButtonGroup>

        {/* 時間帯フィルタ */}
        <ToggleButtonGroup
          value={timeFilter}
          exclusive
          onChange={handleTimeFilterChange}
          size="small"
          color="primary"
        >
          <ToggleButton value="all">
            📅 全て
          </ToggleButton>
          <ToggleButton value="morning" {...tid(TESTIDS['agenda-filter-morning'])}>
            <MorningIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            朝〜午前
          </ToggleButton>
          <ToggleButton value="evening" {...tid(TESTIDS['agenda-filter-evening'])}>
            <EveningIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            午後〜夕方
          </ToggleButton>
        </ToggleButtonGroup>

        {/* 表示モード切替: 時系列 / 利用者別 */}
        <ToggleButtonGroup
          value={displayMode}
          exclusive
          onChange={(_, v) => { if (v) setDisplayMode(v as HandoffDisplayMode); }}
          size="small"
          color="primary"
        >
          <ToggleButton value="timeline" data-testid="handoff-mode-timeline">
            <ViewListIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            時系列
          </ToggleButton>
          <ToggleButton value="grouped" data-testid="handoff-mode-grouped">
            <PersonIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            利用者別
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ── Stats サマリー ── */}
      {handoffStats && (
        <Box
          sx={{
            mt: 1.5,
            mb: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 1.5,
            bgcolor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.200',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            📊 {dateLabel}の申し送り状況
          </Typography>
          <Typography variant="body2">全{handoffStats.total}件</Typography>
          {handoffStats.pending > 0 && (
            <Chip size="small" label={`未対応 ${handoffStats.pending}件`} />
          )}
          {handoffStats.inProgress > 0 && (
            <Chip size="small" label={`対応中 ${handoffStats.inProgress}件`} color="warning" />
          )}
          {handoffStats.completed > 0 && (
            <Chip size="small" label={`対応済 ${handoffStats.completed}件`} color="success" />
          )}
        </Box>
      )}

      {/* ── メインコンテンツ ── */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        alignItems="flex-start"
        sx={{ mt: 2 }}
      >
        {/* 左カラム: タイムライン */}
        <Box flex={{ xs: 'none', md: 2 }} width="100%">
          <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
            {dateLabel}の申し送り
            <Typography
              variant="body2"
              color="text.secondary"
              component="span"
              sx={{ ml: 1 }}
            >
              ({HANDOFF_TIME_FILTER_LABELS[timeFilter]})
            </Typography>
          </Typography>
          {displayMode === 'timeline' ? (
            <TodayHandoffTimelineList
              items={todayHandoffs}
              loading={timelineLoading}
              error={timelineError}
              updateHandoffStatus={updateHandoffStatus}
              dayScope={dayScope}
              onStatsChange={setHandoffStats}
              meetingMode={meetingMode}
              workflowActions={workflowActions}
            />
          ) : (
            <HandoffUserGroupedView
              items={todayHandoffs}
              loading={timelineLoading}
              error={timelineError}
              updateHandoffStatus={updateHandoffStatus}
              meetingMode={meetingMode}
              workflowActions={workflowActions}
            />
          )}
        </Box>

        {/* 右カラム: カテゴリ別サマリー */}
        <Box
          flex={{ xs: 'none', md: 1 }}
          width="100%"
          sx={{ position: { xs: 'static', md: 'sticky' }, top: { xs: 'auto', md: 96 } }}
        >
          <Typography variant="h6" component="h3" sx={{ mb: 2, fontWeight: 600 }}>
            {dateLabel}の傾向
          </Typography>
          <HandoffCategorySummaryCard dayScope={dayScope} />
        </Box>
      </Stack>
    </>
  );
}

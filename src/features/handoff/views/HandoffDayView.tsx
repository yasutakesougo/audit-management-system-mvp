/**
 * HandoffDayView — 日ビュー専用コンポーネント (v3: Hero/Queue 三層構造)
 *
 * Phase 3 (C-1 / C-2):
 *  - State 管理を useHandoffDayViewState に委譲
 *  - fromToday: boolean → entryMode: 'from-today' | 'direct' に意味明確化
 *
 * v3:
 *  - ZONE A: UrgentHandoffHero（最優先の未対応1件）
 *  - ZONE B: HandoffActionQueue（残りの要対応を重要度順）
 *  - ZONE C: 既存フィルタ + タイムライン/利用者別（温存）
 *
 * このファイルは描画のみを担当するオーケストレーター。
 */
import { useMemo } from 'react';
import { TESTIDS, tid } from '@/testids';
import type { HandoffRecord } from '../handoffTypes';
import {
  FilterList as FilterListIcon,
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
import HandoffCategorySummaryCard from '../HandoffCategorySummaryCard';
import { TodayHandoffTimelineList } from '../TodayHandoffTimelineList';
import { HandoffUserGroupedView } from '../components/HandoffUserGroupedView';
import { UrgentHandoffHero } from '../components/UrgentHandoffHero';
import { HandoffActionQueue } from '../components/HandoffActionQueue';
import { resolveNextHandoffAction } from '../domain/resolveNextHandoffAction';
import { groupHandoffsByPriority } from '../domain/groupHandoffsByPriority';
import {
  STATUS_FILTER_LABELS,
  type HandoffStatusFilter,
} from '../domain/filterHandoffsByStatus';
import { HANDOFF_TIME_FILTER_LABELS } from '../handoffTypes';
import type { HandoffDayScope } from '../handoffTypes';
import {
  useHandoffDayViewState,
  type EntryMode,
  type HandoffDisplayMode,
} from '../hooks/useHandoffDayViewState';
import { recordCtaClick, CTA_EVENTS } from '@/features/today/telemetry/recordCtaClick';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

export type HandoffDayViewProps = {
  /** 表示用の日付ラベル (例: "3月13日(木)") */
  dateLabel: string;
  /** dayScope 値 ('today' | 'yesterday') — data hook に渡す */
  dayScope: HandoffDayScope;
  /**
   * 画面への遷移経路
   * - 'from-today': /today からの遷移 → デフォルト grouped 表示
   * - 'direct': 直接アクセスまたは URL 遷移 → デフォルト timeline 表示
   */
  entryMode: EntryMode;
  /** dateNav の日付移動関数 — 会議モード切替時に使用 */
  goToDate: (date: string) => void;
  /** dateNav の今日移動関数 — 会議モード切替時に使用 */
  goToToday: () => void;
  /** Phase 8-A: 利用者状態登録コールバック */
  onRegisterStatus?: (handoff: HandoffRecord) => void;
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function HandoffDayView({
  dateLabel,
  dayScope,
  entryMode,
  goToDate,
  goToToday,
  onRegisterStatus,
}: HandoffDayViewProps) {
  const state = useHandoffDayViewState({
    dayScope,
    entryMode,
    goToDate,
    goToToday,
  });

  // ── ZONE A/B: Hero + Queue データ計算 ──
  const heroAction = useMemo(
    () => resolveNextHandoffAction(state.todayHandoffs),
    [state.todayHandoffs],
  );
  const heroLogId = heroAction?.record.id;
  const queueGroups = useMemo(
    () => groupHandoffsByPriority(state.todayHandoffs, heroLogId),
    [state.todayHandoffs, heroLogId],
  );

  // ── ZONE A/B: ハンドラー（テレメトリ → ステータス更新） ──
  const handleHeroConfirm = (recordId: number) => {
    recordCtaClick({
      ctaId: CTA_EVENTS.HANDOFF_HERO_CONFIRM,
      sourceComponent: 'UrgentHandoffHero',
      stateType: 'scene-action',
      priority: heroAction?.reason,
    });
    // 将来的には詳細画面へ遷移する想定
    void recordId;
  };
  const handleHeroDone = async (recordId: number) => {
    recordCtaClick({
      ctaId: CTA_EVENTS.HANDOFF_HERO_DONE,
      sourceComponent: 'UrgentHandoffHero',
      stateType: 'scene-action',
      priority: heroAction?.reason,
    });
    await state.updateHandoffStatus(recordId, '対応済');
  };
  const handleQueueItemClick = (recordId: number) => {
    recordCtaClick({
      ctaId: CTA_EVENTS.HANDOFF_PRIORITY_ITEM,
      sourceComponent: 'HandoffActionQueue',
      stateType: 'navigation',
    });
    // 将来的には詳細画面へ遷移する想定
    void recordId;
  };
  const handleQueueDone = async (recordId: number) => {
    recordCtaClick({
      ctaId: CTA_EVENTS.HANDOFF_PRIORITY_DONE,
      sourceComponent: 'HandoffActionQueue',
      stateType: 'widget-action',
    });
    await state.updateHandoffStatus(recordId, '対応済');
  };

  return (
    <>
      {/* ── ZONE A: 最優先の未対応1件 ── */}
      <UrgentHandoffHero
        action={heroAction}
        onConfirm={handleHeroConfirm}
        onMarkDone={handleHeroDone}
      />

      {/* ── ZONE B: 残りの要対応（重要度順） ── */}
      <HandoffActionQueue
        groups={queueGroups}
        onItemClick={handleQueueItemClick}
        onMarkDone={handleQueueDone}
      />

      {/* ── ZONE C: 既存フィルタ + タイムライン（温存） ── */}
      {/* ── Day 固有フィルタ群 ── */}
      <Box sx={{ mt: 2, mb: 1 }}>
        {/* 上段: コンテキスト系フィルタ（会議モード + 時間帯） */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            rowGap: 1,
          }}
        >
          {/* 会議モード切替 */}
          <ToggleButtonGroup
            value={state.meetingMode}
            exclusive
            onChange={state.handleMeetingModeChange}
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
            value={state.timeFilter}
            exclusive
            onChange={state.handleTimeFilterChange}
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
        </Box>

        {/* 下段: 表示制御系フィルタ（表示モード + ステータス） */}
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            rowGap: 1,
          }}
        >
          {/* 表示モード切替: 時系列 / 利用者別 */}
          <ToggleButtonGroup
            value={state.displayMode}
            exclusive
            onChange={(_, v) => { if (v) state.setDisplayMode(v as HandoffDisplayMode); }}
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

          {/* ステータスフィルタ */}
          <ToggleButtonGroup
            value={state.statusFilter}
            exclusive
            onChange={(_, v) => { if (v) state.setStatusFilter(v as HandoffStatusFilter); }}
            size="small"
            color="primary"
            data-testid="handoff-status-filter"
          >
            <ToggleButton value="actionRequired" data-testid="handoff-filter-action">
              <FilterListIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
              {STATUS_FILTER_LABELS.actionRequired}
            </ToggleButton>
            <ToggleButton value="pending" data-testid="handoff-filter-pending">
              {STATUS_FILTER_LABELS.pending}
            </ToggleButton>
            <ToggleButton value="all" data-testid="handoff-filter-all">
              {STATUS_FILTER_LABELS.all}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* ── Stats サマリー ── */}
      {state.handoffStats && (
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
          <Typography variant="body2">{state.filteredCountInfo.label}</Typography>
          {state.handoffStats.pending > 0 && (
            <Chip size="small" label={`未対応 ${state.handoffStats.pending}件`} />
          )}
          {state.handoffStats.inProgress > 0 && (
            <Chip size="small" label={`対応中 ${state.handoffStats.inProgress}件`} color="warning" />
          )}
          {state.handoffStats.completed > 0 && (
            <Chip size="small" label={`対応済 ${state.handoffStats.completed}件`} color="success" />
          )}
          {state.filteredCountInfo.isFiltered && (
            <Chip
              size="small"
              label="フィルタ中"
              color="info"
              variant="outlined"
              onDelete={() => state.setStatusFilter('all')}
              sx={{ height: 24 }}
            />
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
              ({HANDOFF_TIME_FILTER_LABELS[state.timeFilter]})
            </Typography>
          </Typography>
          {state.displayMode === 'timeline' ? (
            <TodayHandoffTimelineList
              items={state.filteredHandoffs}
              loading={state.timelineLoading}
              error={state.timelineError}
              updateHandoffStatus={state.updateHandoffStatus}
              dayScope={dayScope}
              onStatsChange={state.setHandoffStats}
              meetingMode={state.meetingMode}
              workflowActions={state.workflowActions}
              onRegisterStatus={onRegisterStatus}
              highlightedHandoffId={state.highlightedHandoffId}
            />
          ) : (
            <HandoffUserGroupedView
              items={state.filteredHandoffs}
              loading={state.timelineLoading}
              error={state.timelineError}
              updateHandoffStatus={state.updateHandoffStatus}
              meetingMode={state.meetingMode}
              workflowActions={state.workflowActions}
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

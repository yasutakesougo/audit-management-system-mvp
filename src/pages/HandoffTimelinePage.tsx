import { TESTIDS, tid } from '@/testids';
import { AccessTime as AccessTimeIcon, EditNote as EditNoteIcon, Nightlight as EveningIcon, Groups as MeetingIcon, WbSunny as MorningIcon } from '@mui/icons-material';
import { Box, Button, Chip, Container, Divider, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import HandoffCategorySummaryCard from '../features/handoff/HandoffCategorySummaryCard';
import type { HandoffDayScope, HandoffTimeFilter } from '../features/handoff/handoffTypes';
import { HANDOFF_DAY_SCOPE_LABELS, HANDOFF_TIME_FILTER_LABELS } from '../features/handoff/handoffTypes';
import { TodayHandoffTimelineList } from '../features/handoff/TodayHandoffTimelineList';
import { useHandoffTimeline } from '../features/handoff/useHandoffTimeline';
import { useHandoffTimelineViewModel } from '../features/handoff/useHandoffTimelineViewModel';

/**
 * 申し送りタイムラインページ
 *
 * 機能概要：
 * - 今すぐ申し送りボタン → FooterQuickActions の Dialog を開く（UI統一）
 * - 今日の申し送りタイムライン表示と状態管理
 * - 時間帯別の申し送り整理（Step 7B: 朝会・夕会連携）
 * - 日付スコープ対応（Step 7C: MeetingGuideDrawer連携）
 *
 * 現場の都合に寄り添った設計：
 * - ワンクリック申し送り作成（全ページ共通の Dialog UI）
 * - カテゴリー・重要度チップ選択
 * - 楽観的更新でストレスフリー
 * - 時間帯フィルタ（朝会は朝のことをちゃんと振り返る会）
 * - 朝会→昨日、夕会→今日の自然な導線
 */
export default function HandoffTimelinePage() {
  // Step 7C: navigation state からの初期値取得
  const location = useLocation();
  const navState = location.state as
    | { dayScope?: HandoffDayScope; timeFilter?: HandoffTimeFilter }
    | undefined;

  // v3: VM → データ hook → useRef late-binding DI
  //
  // 1) VM: dayScope / timeFilter / meetingMode を管理
  //    - workflowActions は内部 useRef で DI を late-binding
  //    - 初回は updateHandoffStatus=undefined だが console.warn fallback
  // 2) data hook: VM の dayScope/timeFilter でデータ取得
  //    → updateHandoffStatus / todayHandoffs が返される
  // 3) VM の useRef が毎レンダー同期されるため、
  //    ボタンクリック時には常に最新の updateHandoffStatus が使われる

  // データ hook を先に呼び（navState でデフォルト値を設定済み）、
  // VM に DI 注入する。VM は dayScope/timeFilter を内部管理するが、
  // data hook はそれを引数で受け取るため「VM → data hook」の順が必要。
  // → useRef late-binding で解決: VM を先に呼んでも DI は毎レンダー同期される。

  const {
    dayScope,
    timeFilter,
    handoffStats,
    setHandoffStats,
    handleDayScopeChange,
    handleTimeFilterChange,
    meetingMode,
    handleMeetingModeChange,
    workflowActions,
    injectDI,
  } = useHandoffTimelineViewModel({ navState });

  // データ hook: VM が管理する dayScope/timeFilter でデータ取得
  const {
    todayHandoffs,
    loading: timelineLoading,
    error: timelineError,
    updateHandoffStatus,
  } = useHandoffTimeline(timeFilter, dayScope);

  // v3: DI 注入 — data hook の関数を VM の workflowActions に接続
  // useRef 経由の late-binding なので同期的に呼んでOK
  injectDI({ updateHandoffStatus, currentRecords: todayHandoffs });

  // Dialog は FooterQuickActions が唯一のオーナー。
  // ページ内ボタンからはグローバルイベントで Dialog を開く。
  const openQuickNoteDialog = useCallback(() => {
    window.dispatchEvent(new CustomEvent('handoff-open-quicknote-dialog'));
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} {...tid(TESTIDS['agenda-page-root'])}>
      {/* ページヘッダー */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <AccessTimeIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            申し送りタイムライン
          </Typography>
          {(dayScope === 'yesterday' || navState?.dayScope) && (
            <Chip
              label={HANDOFF_DAY_SCOPE_LABELS[dayScope]}
              color={dayScope === 'yesterday' ? 'secondary' : 'primary'}
              variant="filled"
              sx={{ fontSize: '0.875rem' }}
            />
          )}
        </Box>
        <Typography variant="body1" color="text.secondary">
          {dayScope === 'yesterday'
            ? '前日からの申し送り事項を確認できます（朝会での引き継ぎ確認用）'
            : 'いつでも簡単に申し送りを記録・確認できます'
          }
        </Typography>

        {/* Step 7B: 時間帯フィルタ + Step 7C: 日付スコープ切り替え */}
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            flexWrap: 'wrap',
            rowGap: 1.5,
          }}
        >
          {/* v3: 会議モード切替 (🌅朝会 / 🌆夕会 / 通常) */}
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

          {/* 日付スコープ切り替え（昨日←→今日）*/}
          <ToggleButtonGroup
            value={dayScope}
            exclusive
            onChange={handleDayScopeChange}
            size="small"
            color="secondary"
          >
            <ToggleButton value="yesterday">
              📅 昨日
            </ToggleButton>
            <ToggleButton value="today">
              📅 今日
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
        </Box>

        {handoffStats && (
          <Box
            sx={{
              mt: 1.5,
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
              📊 {HANDOFF_DAY_SCOPE_LABELS[dayScope]}の申し送り状況
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
      </Box>

      {/* 申し送り入力ボタン → FooterQuickActions の Dialog を開く */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-start' }}>
        <Button
          variant="outlined"
          startIcon={<EditNoteIcon />}
          onClick={openQuickNoteDialog}
          data-testid="handoff-page-quicknote-open"
        >
          今すぐ申し送り
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* メインコンテンツ: 2カラムレイアウト */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        alignItems="flex-start"
      >
        {/* 左カラム: 今日のタイムライン */}
        <Box flex={{ xs: 'none', md: 2 }} width="100%">
          <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
            {HANDOFF_DAY_SCOPE_LABELS[dayScope]}の申し送り
            <Typography
              variant="body2"
              color="text.secondary"
              component="span"
              sx={{ ml: 1 }}
            >
              ({HANDOFF_TIME_FILTER_LABELS[timeFilter]})
            </Typography>
          </Typography>
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
        </Box>

        {/* 右カラム: カテゴリ別サマリー */}
        <Box
          flex={{ xs: 'none', md: 1 }}
          width="100%"
          sx={{ position: { xs: 'static', md: 'sticky' }, top: { xs: 'auto', md: 96 } }}
        >
          <Typography variant="h6" component="h3" sx={{ mb: 2, fontWeight: 600 }}>
            {HANDOFF_DAY_SCOPE_LABELS[dayScope]}の傾向
          </Typography>
          <HandoffCategorySummaryCard dayScope={dayScope} />
        </Box>
      </Stack>
    </Container>
  );
}

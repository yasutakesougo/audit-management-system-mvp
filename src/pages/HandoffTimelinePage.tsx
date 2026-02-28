import { TESTIDS, tid } from '@/testids';
import { AccessTime as AccessTimeIcon, Close as CloseIcon, EditNote as EditNoteIcon, Nightlight as EveningIcon, WbSunny as MorningIcon } from '@mui/icons-material';
import { Alert, Box, Button, Chip, Collapse, Container, Divider, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import HandoffCategorySummaryCard from '../features/handoff/HandoffCategorySummaryCard';
import { HandoffQuickNoteCard } from '../features/handoff/HandoffQuickNoteCard';
import type { HandoffDayScope, HandoffTimeFilter, MeetingMode } from '../features/handoff/handoffTypes';
import { HANDOFF_DAY_SCOPE_LABELS, HANDOFF_TIME_FILTER_LABELS, MEETING_MODE_LABELS } from '../features/handoff/handoffTypes';
import { TodayHandoffTimelineList } from '../features/handoff/TodayHandoffTimelineList';
import { useHandoffTimelineViewModel } from '../features/handoff/useHandoffTimelineViewModel';

/**
 * 申し送りタイムラインページ
 *
 * 機能概要：
 * - いつでも画面を開けば入力しやすい申し送り作成
 * - 今日の申し送りタイムライン表示と状態管理
 * - 時間帯別の申し送り整理（Step 7B: 朝会・夕会連携）
 * - 日付スコープ対応（Step 7C: MeetingGuideDrawer連携）
 *
 * 現場の都合に寄り添った設計：
 * - ワンクリック申し送り作成（時間帯自動判定）
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
  const {
    dayScope,
    timeFilter,
    isQuickNoteOpen,
    handoffStats,
    setHandoffStats,
    quickNoteRef,
    handleDayScopeChange,
    handleTimeFilterChange,
    openQuickNote,
    closeQuickNote,
    meetingMode,
    handleMeetingModeChange,
  } = useHandoffTimelineViewModel({ navState });

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

          {/* ミーティングモード切り替え */}
          <ToggleButtonGroup
            value={meetingMode}
            exclusive
            onChange={handleMeetingModeChange}
            size="small"
            color="primary"
          >
            {(Object.keys(MEETING_MODE_LABELS) as MeetingMode[]).map(mode => (
              <ToggleButton key={mode} value={mode}>
                {MEETING_MODE_LABELS[mode]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* モード別サブヘッダー */}
        {meetingMode !== 'normal' && (
          <Alert
            severity="info"
            sx={{ mt: 1.5 }}
            icon={meetingMode === 'evening' ? <EveningIcon /> : <MorningIcon />}
          >
            {meetingMode === 'evening'
              ? '🌆 夕会モード: 未対応の申し送りを確認し、「確認済」「明日へ」「完了」を選択してください'
              : '🌅 朝会モード: 昨日からの持越事項を確認し、処理完了したら「完了」を押してください'
            }
          </Alert>
        )}

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

      {/* 即入力カード（画面上部固定配置 + 折りたたみ対応） */}
      <Box ref={quickNoteRef}>
        <Collapse in={isQuickNoteOpen} unmountOnExit>
          <Paper
            elevation={1}
            sx={{
              mb: 3,
              position: { xs: 'static', md: 'sticky' },
              top: { xs: 'auto', md: 16 },
              zIndex: { xs: 'auto', md: 10 },
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              maxHeight: { xs: 'none', md: '80vh' },
              overflow: { xs: 'visible', md: 'auto' },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
              <IconButton
                aria-label="申し送り入力カードを閉じる"
                onClick={closeQuickNote}
                size="small"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <HandoffQuickNoteCard />
          </Paper>
        </Collapse>
      </Box>
      {!isQuickNoteOpen && (
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            variant="outlined"
            startIcon={<EditNoteIcon />}
            onClick={openQuickNote}
          >
            今すぐ申し送り入力カードを開く
          </Button>
        </Box>
      )}

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
            timeFilter={timeFilter}
            dayScope={dayScope}
            meetingMode={meetingMode}
            onStatsChange={setHandoffStats}
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

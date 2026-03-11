import { PageHeader } from '@/components/PageHeader';
import { TESTIDS, tid } from '@/testids';
import {
  AccessTime as AccessTimeIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarIcon,
  CalendarViewWeek as WeekIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  EditNote as EditNoteIcon,
  Nightlight as EveningIcon,
  Groups as MeetingIcon,
  Person as PersonIcon,
  Today as TodayIcon,
  ViewDay as DayIcon,
  ViewList as ViewListIcon,
  WbSunny as MorningIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  Popover,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HandoffCategorySummaryCard from '../features/handoff/HandoffCategorySummaryCard';
import { HandoffUserGroupedView } from '../features/handoff/components/HandoffUserGroupedView';
import { HandoffWeekView } from '../features/handoff/components/HandoffWeekView';
import { HANDOFF_TIME_FILTER_LABELS } from '../features/handoff/handoffTypes';
import { addDays, formatDateLocal, useHandoffDateNav } from '../features/handoff/hooks/useHandoffDateNav';
import type { DateRange } from '../features/handoff/hooks/useHandoffDateNav';
import { useHandoffWeekViewModel } from '../features/handoff/hooks/useHandoffWeekViewModel';
import { TodayHandoffTimelineList } from '../features/handoff/TodayHandoffTimelineList';
import { useHandoffTimeline } from '../features/handoff/useHandoffTimeline';
import { useHandoffTimelineViewModel } from '../features/handoff/useHandoffTimelineViewModel';

/** 表示モード: 時系列フラット or 利用者グループ */
type HandoffDisplayMode = 'timeline' | 'grouped';

/**
 * 申し送りタイムラインページ
 *
 * P0: date ベースの日付ナビゲーション
 * - URL: ?range=day&date=YYYY-MM-DD
 * - 前日/翌日ボタンで移動
 * - DatePicker で任意日を選択
 * - 旧 dayScope (today/yesterday) の互換性を維持
 */
export default function HandoffTimelinePage() {
  const navigate = useNavigate();

  // ── 日付ナビゲーション (新: URL ?date= ベース) ──
  const dateNav = useHandoffDateNav();

  // 表示モード — /today からの遷移時はグループ表示をデフォルト
  const [displayMode, setDisplayMode] = useState<HandoffDisplayMode>(
    dateNav.fromToday ? 'grouped' : 'timeline',
  );

  // VM: timeFilter / meetingMode を管理 (dayScope は dateNav から注入)
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
      dayScope: dateNav.dayScope,
      timeFilter: undefined,
    },
  });

  // 会議モード切替時に dateNav の日付も連動移動
  const handleMeetingModeChange = useCallback(
    (event: React.MouseEvent<HTMLElement>, newMode: string) => {
      vmHandleMeetingModeChange(event, newMode as 'normal' | 'evening' | 'morning');
      if (newMode === 'morning') {
        // 朝会 → 昨日に移動
        dateNav.goToDate(addDays(formatDateLocal(), -1));
      } else if (newMode === 'evening') {
        // 夕会 → 今日に移動
        dateNav.goToToday();
      }
    },
    [vmHandleMeetingModeChange, dateNav],
  );

  // データ hook: dateNav.dayScope + timeFilter でデータ取得 (day ビュー用)
  const {
    todayHandoffs,
    loading: timelineLoading,
    error: timelineError,
    updateHandoffStatus,
  } = useHandoffTimeline(timeFilter, dateNav.dayScope);

  // 週ビュー ViewModel
  const weekVM = useHandoffWeekViewModel(dateNav.date);

  // 日カードクリック → day ビューへ遷移
  const handleWeekDayClick = useCallback(
    (clickedDate: string) => {
      dateNav.goToDate(clickedDate);
    },
    [dateNav],
  );

  // range 切替ハンドラ
  const handleRangeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newRange: string | null) => {
      if (newRange) {
        dateNav.setRange(newRange as DateRange);
      }
    },
    [dateNav],
  );

  // DI 注入
  injectDI({ updateHandoffStatus, currentRecords: todayHandoffs });

  // Dialog は FooterQuickActions が唯一のオーナー。
  const openQuickNoteDialog = useCallback(() => {
    window.dispatchEvent(new CustomEvent('handoff-open-quicknote-dialog'));
  }, []);

  // ── DatePicker popover state ──
  const [datePickerAnchor, setDatePickerAnchor] = useState<HTMLElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleDatePickerOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setDatePickerAnchor(event.currentTarget);
  }, []);

  const handleDatePickerClose = useCallback(() => {
    setDatePickerAnchor(null);
  }, []);

  const handleDatePickerChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = event.target.value;
      if (newDate) {
        dateNav.goToDate(newDate);
        handleDatePickerClose();
      }
    },
    [dateNav, handleDatePickerClose],
  );

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} {...tid(TESTIDS['agenda-page-root'])}>
      {/* ページヘッダー */}
      <Box sx={{ mb: 3 }}>
        {/* /today からの遷移時: 戻り導線 */}
        {dateNav.fromToday && (
          <Chip
            icon={<ArrowBackIcon />}
            label="今日の業務へ戻る"
            onClick={() => navigate('/today')}
            variant="outlined"
            color="primary"
            size="small"
            clickable
            data-testid="handoff-back-to-today"
            sx={{ mb: 1.5 }}
          />
        )}
        <PageHeader
          title="申し送りタイムライン"
          subtitle="申し送りの記録・確認・会議進行ができます"
          icon={<AccessTimeIcon />}
        />

        {/* ── 日付ナビゲーション ─────────────────────────── */}
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {/* 前へ (day / week) */}
          <Tooltip title={dateNav.range === 'week' ? '前週' : '前日'}>
            <IconButton
              onClick={dateNav.range === 'week' ? dateNav.goToPreviousWeek : dateNav.goToPreviousDay}
              size="small"
              data-testid="handoff-date-prev"
            >
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>

          <Chip
            icon={<CalendarIcon />}
            label={dateNav.dateLabel}
            onClick={handleDatePickerOpen}
            variant="outlined"
            color="primary"
            clickable
            data-testid="handoff-date-label"
            sx={{
              fontSize: '0.95rem',
              fontWeight: 600,
              px: 1,
            }}
          />

          {/* 次へ (day / week) */}
          <Tooltip title={dateNav.range === 'week' ? '翌週' : '翌日'}>
            <span>
              <IconButton
                onClick={dateNav.range === 'week' ? dateNav.goToNextWeek : dateNav.goToNextDay}
                size="small"
                disabled={dateNav.isToday}
                data-testid="handoff-date-next"
              >
                <ChevronRightIcon />
              </IconButton>
            </span>
          </Tooltip>

          {!dateNav.isToday && (
            <Chip
              icon={<TodayIcon />}
              label="今日"
              onClick={dateNav.goToToday}
              variant="filled"
              color="secondary"
              size="small"
              clickable
              data-testid="handoff-date-today"
            />
          )}

          {/* range 切替: 日 / 週 */}
          <ToggleButtonGroup
            value={dateNav.range}
            exclusive
            onChange={handleRangeChange}
            size="small"
            color="primary"
            sx={{ ml: 1 }}
          >
            <ToggleButton value="day" data-testid="handoff-range-day">
              <DayIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
              日
            </ToggleButton>
            <ToggleButton value="week" data-testid="handoff-range-week">
              <WeekIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
              週
            </ToggleButton>
          </ToggleButtonGroup>

          {/* DatePicker Popover */}
          <Popover
            open={Boolean(datePickerAnchor)}
            anchorEl={datePickerAnchor}
            onClose={handleDatePickerClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Box sx={{ p: 2 }}>
              <TextField
                ref={dateInputRef}
                type="date"
                value={dateNav.date}
                onChange={handleDatePickerChange}
                size="small"
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  max: new Date().toISOString().split('T')[0],
                  'data-testid': 'handoff-date-picker-input',
                }}
              />
            </Box>
          </Popover>
        </Box>

        {/* ── フィルタ群 ──────────────────────────────────── */}
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
              📊 {dateNav.dateLabel}の申し送り状況
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

      {/* 申し送り入力ボタン */}
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

      {/* ── メインコンテンツ ── */}
      {dateNav.range === 'week' ? (
        /* ── 週ビュー ── */
        <Box>
          <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
            {dateNav.dateLabel}の申し送り
          </Typography>
          <HandoffWeekView
            summary={weekVM.summary}
            loading={weekVM.loading}
            error={weekVM.error}
            onDayClick={handleWeekDayClick}
          />
        </Box>
      ) : (
        /* ── 日ビュー (既存) ── */
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          alignItems="flex-start"
        >
          {/* 左カラム: タイムライン */}
          <Box flex={{ xs: 'none', md: 2 }} width="100%">
            <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
              {dateNav.dateLabel}の申し送り
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
                dayScope={dateNav.dayScope}
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
              {dateNav.dateLabel}の傾向
            </Typography>
            <HandoffCategorySummaryCard dayScope={dateNav.dayScope} />
          </Box>
        </Stack>
      )}
    </Container>
  );
}

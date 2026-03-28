/* eslint-disable @typescript-eslint/no-explicit-any */
import { PageHeader } from '@/components/PageHeader';
import { TESTIDS, tid } from '@/testids';
import {
  AccessTime as AccessTimeIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarIcon,
  CalendarViewMonth as MonthIcon,
  CalendarViewWeek as WeekIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  EditNote as EditNoteIcon,
  Today as TodayIcon,
  ViewDay as DayIcon,
} from '@mui/icons-material';
import { Alert, Box, Button, Chip, Container, Dialog, DialogContent, DialogTitle, IconButton, Popover, Snackbar, TextField, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { useCallback, useRef, useState } from 'react';
import { HandoffQuickNoteCard } from '../features/handoff/HandoffQuickNoteCard';
import { useNavigate } from 'react-router-dom';
import type { DateRange } from '../features/handoff/hooks/useHandoffDateNav';
import { useHandoffDateNav } from '../features/handoff/hooks/useHandoffDateNav';
import {
  HandoffDayView,
  HandoffMonthViewSection,
  HandoffWeekViewSection,
} from '../features/handoff/views';
import type { HandoffRecord } from '../features/handoff/handoffTypes';
import { suggestStatusFromHandoffCategory } from '../features/schedules/domain/mappers/userStatus';
import type { UserStatusType } from '../features/schedules/domain/mappers/userStatus';
import { useUserStatusActions } from '../features/schedules/hooks/useUserStatusActions';
import { UserStatusQuickDialog } from '../features/schedules/components/dialogs/UserStatusQuickDialog';

/**
 * 申し送りタイムラインページ（薄いオーケストレーター）
 *
 * 責務:
 * - DateNav — URL ?range=&date= の管理、前後移動、DatePicker
 * - Range 切替タブ (日 / 週 / 月)
 * - Active view のスイッチ (day → HandoffDayView, week → ...Section, month → ...Section)
 * - ページヘッダーと QuickNote ボタン
 *
 * 各ビューの固有ロジック（フィルタ / データ取得 / 表示モード）は
 * それぞれのビューコンポーネントに閉じ込めている。
 */
export default function HandoffTimelinePage() {
  const navigate = useNavigate();

  // ── 日付ナビゲーション (URL ?date= ベース) ──
  const dateNav = useHandoffDateNav();

  // ── Range 切替ハンドラ ──
  const handleRangeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newRange: string | null) => {
      if (newRange) {
        dateNav.setRange(newRange as DateRange);
      }
    },
    [dateNav],
  );

  // ── 日カードクリック → day ビューへ遷移 (week/month 共通) ──
  const handleDayClick = useCallback(
    (clickedDate: string) => {
      dateNav.goToDate(clickedDate);
    },
    [dateNav],
  );

  // ── QuickNote dialog (自前管理) ──
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const openQuickNoteDialog = useCallback(() => {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
    setQuickNoteOpen(true);
  }, []);
  const closeQuickNoteDialog = useCallback(() => {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
    setQuickNoteOpen(false);
  }, []);

  // ── Phase 8-A: User Status Quick Dialog ──
  const userStatusActions = useUserStatusActions();
  const [userStatusDialogOpen, setUserStatusDialogOpen] = useState(false);
  const [userStatusPreset, setUserStatusPreset] = useState<{
    userId: string;
    userName: string;
    statusType: UserStatusType;
  } | null>(null);
  const [userStatusSuccessMsg, setUserStatusSuccessMsg] = useState<string | null>(null);

  const handleRegisterStatusFromHandoff = useCallback(
    (handoff: HandoffRecord) => {
      setUserStatusPreset({
        userId: handoff.userCode,
        userName: handoff.userDisplayName,
        statusType: suggestStatusFromHandoffCategory(handoff.category),
      });
      setUserStatusDialogOpen(true);
    },
    [],
  );

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
        {dateNav.entryMode === 'from-today' && (
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

        {/* ── 日付ナビゲーション + 申し送りボタン ── */}
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {/* 前へ */}
          <Tooltip title={dateNav.range === 'month' ? '前月' : dateNav.range === 'week' ? '前週' : '前日'}>
            <IconButton
              onClick={
                dateNav.range === 'month'
                  ? dateNav.goToPreviousMonth
                  : dateNav.range === 'week'
                    ? dateNav.goToPreviousWeek
                    : dateNav.goToPreviousDay
              }
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

          {/* 次へ */}
          <Tooltip title={dateNav.range === 'month' ? '翌月' : dateNav.range === 'week' ? '翌週' : '翌日'}>
            <span>
              <IconButton
                onClick={
                  dateNav.range === 'month'
                    ? dateNav.goToNextMonth
                    : dateNav.range === 'week'
                      ? dateNav.goToNextWeek
                      : dateNav.goToNextDay
                }
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

          {/* range 切替: 日 / 週 / 月 */}
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
            <ToggleButton value="month" data-testid="handoff-range-month">
              <MonthIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
              月
            </ToggleButton>
          </ToggleButtonGroup>

          {/* 申し送り入力ボタン — 右寄せ */}
          <Button
            variant="outlined"
            startIcon={<EditNoteIcon />}
            onClick={openQuickNoteDialog}
            data-testid="handoff-page-quicknote-open"
            sx={{ ml: 'auto' }}
          >
            今すぐ申し送り
          </Button>

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
      </Box>

      {/* ── Active View Switch ── */}
      {dateNav.range === 'month' ? (
        <HandoffMonthViewSection
          date={dateNav.date}
          dateLabel={dateNav.dateLabel}
          onDayClick={handleDayClick}
        />
      ) : dateNav.range === 'week' ? (
        <HandoffWeekViewSection
          date={dateNav.date}
          dateLabel={dateNav.dateLabel}
          onDayClick={handleDayClick}
        />
      ) : (
        <HandoffDayView
          dateLabel={dateNav.dateLabel}
          dayScope={dateNav.dayScope}
          entryMode={dateNav.entryMode}
          goToDate={dateNav.goToDate}
          goToToday={dateNav.goToToday}
          onRegisterStatus={handleRegisterStatusFromHandoff}
        />
      )}

      {/* Phase 8-A: 利用者状態 Quick Dialog */}
      {userStatusPreset && (
        <UserStatusQuickDialog
          open={userStatusDialogOpen}
          onClose={() => setUserStatusDialogOpen(false)}
          userId={userStatusPreset.userId}
          userName={userStatusPreset.userName}
          initialStatusType={userStatusPreset.statusType}
          source="handoff"
          actions={userStatusActions}
          onSuccess={(msg) => setUserStatusSuccessMsg(msg)}
        />
      )}

      <Snackbar
        open={!!userStatusSuccessMsg}
        autoHideDuration={3000}
        onClose={() => setUserStatusSuccessMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setUserStatusSuccessMsg(null)}
          severity="success"
          variant="filled"
          sx={{ width: '100%', fontWeight: 'bold' }}
        >
          {userStatusSuccessMsg}
        </Alert>
      </Snackbar>

      {/* ── 申し送り追加ダイアログ (自前管理) ── */}
      <Dialog
        open={quickNoteOpen}
        onClose={closeQuickNoteDialog}
        fullWidth
        maxWidth="sm"
        data-testid="handoff-page-quicknote-dialog"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          今すぐ申し送り
          <IconButton aria-label="申し送りダイアログを閉じる" onClick={closeQuickNoteDialog}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <HandoffQuickNoteCard />
        </DialogContent>
      </Dialog>
    </Container>
  );
}

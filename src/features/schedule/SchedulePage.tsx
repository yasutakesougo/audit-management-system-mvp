import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { startOfWeek } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
// Schedule View Icons
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarViewWeekRoundedIcon from '@mui/icons-material/CalendarViewWeekRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';

import BriefingPanel from '@/features/schedule/components/BriefingPanel';
import { assignLocalDateKey } from '@/features/schedule/dateutils.local';
import { moveScheduleToDay } from '@/features/schedule/move';
import ScheduleDialog from '@/features/schedule/ScheduleDialog';
import type { ExtendedScheduleForm, Schedule, ScheduleStatus, Status } from '@/features/schedule/types';
import ScheduleListView from '@/features/schedule/views/ListView';
import MonthView from '@/features/schedule/views/MonthView';
import OrgTab from '@/features/schedule/views/OrgTab';
import StaffTab from '@/features/schedule/views/StaffTab';
import TimelineDay from '@/features/schedule/views/TimelineDay';
import TimelineWeek, { type EventMovePayload } from '@/features/schedule/views/TimelineWeek';
import UserTab from '@/features/schedule/views/UserTab';
import { getAppConfig } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { useStaff } from '@/stores/useStaff';
import FilterToolbar from '@/ui/filters/FilterToolbar';
import { formatRangeLocal } from '@/utils/datetime';
import { useEnsureScheduleList } from './ensureScheduleList';
import { getUserCareSchedules } from './spClient.schedule';
import { getOrgSchedules } from './spClient.schedule.org';
import { getStaffSchedules } from './spClient.schedule.staff';
import { buildStaffPatternIndex, collectBaseShiftWarnings } from './workPattern';

type ViewMode = 'month' | 'week' | 'day' | 'list' | 'userCare';

type RangeState = {
  start: Date;
  end: Date;
};

export default function SchedulePage() {
  const sp = useSP();
  useEnsureScheduleList(sp);
  const { data: staffData } = useStaff();
  const [view, setView] = useState<ViewMode>('week');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<RangeState>(() => {
    const now = new Date();
    // 月曜始まりの今週を設定
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  });
  const [timelineEvents, setTimelineEvents] = useState<Schedule[]>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
  const [timelineError, setTimelineError] = useState<Error | null>(null);

  // Schedule Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<ExtendedScheduleForm | undefined>(undefined);


  const staffPatterns = useMemo(() => buildStaffPatternIndex(staffData), [staffData]);

  const annotatedTimelineEvents = useMemo(() => {
    if (!staffPatterns) {
      return timelineEvents;
    }
    return timelineEvents.map((event) => {
      const warnings = collectBaseShiftWarnings(event, staffPatterns);
      return warnings.length ? { ...event, baseShiftWarnings: warnings } : event;
    });
  }, [timelineEvents, staffPatterns]);

  const rangeLabel = useMemo(() => {
    return formatRangeLocal(range.start.toISOString(), range.end.toISOString());
  }, [range.start.getTime(), range.end.getTime()]);
  const loadTimeline = useCallback(async () => {
    const startIso = range.start.toISOString();
    const endIso = range.end.toISOString();
    setTimelineLoading(true);
    setTimelineError(null);

  // 開発環境での無限エラーを防ぐため、CORS エラーが発生した場合はモックデータに切り替える
  const { isDev: isDevelopment } = getAppConfig();

    try {
      const [userRows, orgRows, staffRows] = await Promise.all([
        getUserCareSchedules(sp, { start: startIso, end: endIso }),
        getOrgSchedules(sp, { start: startIso, end: endIso }),
        getStaffSchedules(sp, { start: startIso, end: endIso }),
      ]);
      const combined: Schedule[] = [...userRows, ...orgRows, ...staffRows]
        .map((event) => assignLocalDateKey({ ...event }))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      setTimelineEvents(combined);
      // 成功時のリトライカウントリセットは useEffect で行う
    } catch (cause) {
      const err = cause instanceof Error ? cause : new Error('予定の取得に失敗しました');
      console.warn('SharePoint API エラー:', err.message);

      // 開発環境では SharePoint エラーの場合、無限リトライを避けて空データを使用
      if (isDevelopment) {
        console.info('開発環境: SharePoint接続エラーのためモックデータを使用します');
        setTimelineEvents([]); // 空のデータセット
        setTimelineError(null); // エラーをクリア
      } else {
        setTimelineError(err);
        // エラーを再スローしない（useEffect内で追加処理が不要なため）
      }
    } finally {
      setTimelineLoading(false);
    }
  }, [range.start.getTime(), range.end.getTime(), sp]);

  // データ読み込み用の useEffect（状態更新の重複を避けるため、loadTimeline内部の状態管理に委ねる）
  useEffect(() => {
    // loadTimeline()内でエラーハンドリングと状態更新が完結しているので、
    // useEffectでは追加の状態更新は行わない
    loadTimeline().catch(() => {
      // エラーはloadTimeline内で既に処理済み
      // 追加の状態更新は行わない（無限ループを防ぐため）
    });
  }, [range.start.getTime(), range.end.getTime(), sp]);

  const dayViewDate = useMemo(() => new Date(range.start.getTime()), [range.start.getTime()]);

  const handleEventMove = useCallback(({ id, to }: EventMovePayload) => {
    setTimelineEvents((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) {
        return prev;
      }
      const original = prev[index];
      if (original.category !== to.category) {
        return prev;
      }
      const updated = moveScheduleToDay(original, to.dayKey);
      const next = [...prev];
      next.splice(index, 1, updated);
      next.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      return next;
    });
  }, []);

  // Schedule Dialog Handlers
  const handleCreateSchedule = useCallback(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later

    setDialogInitial({
      category: 'User',
      userId: '',
      status: 'planned',
      start: now.toISOString(),
      end: end.toISOString(),
      title: '',
      note: '',
    });
    setDialogOpen(true);
  }, []);

  const _handleEditSchedule = useCallback((schedule: Schedule) => {
    // Convert Schedule to ScheduleForm
    // Extract userId from different schedule categories
    let userId = '';
    if (schedule.category === 'User') {
      userId = schedule.personId ?? '';
    } else if (schedule.category === 'Staff') {
      userId = schedule.staffIds?.[0] ?? '';
    }

    // Map Status to ScheduleStatus
    const statusMap: Record<Status, ScheduleStatus> = {
      '下書き': 'planned',
      '申請中': 'planned',
      '承認済み': 'confirmed',
      '完了': 'confirmed'
    };

    setDialogInitial({
      category: schedule.category,
      id: parseInt(schedule.id) || undefined,
      userId,
      status: statusMap[schedule.status] || 'planned',
      start: schedule.start,
      end: schedule.end,
      title: schedule.title,
      note: schedule.notes || '',
    });
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setDialogInitial(undefined);
  }, []);

  const handleDialogSubmit = useCallback(async (values: ExtendedScheduleForm) => {
    try {
      console.log('Schedule submission:', values);
      // TODO: Implement actual API calls for create/update

      // For now, simulate success and close dialog
      setDialogOpen(false);
      setDialogInitial(undefined);

      // Reload timeline data to reflect changes
      await loadTimeline();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      throw error; // Re-throw to allow ScheduleDialog to handle error display
    }
  }, [loadTimeline]);

  const handleDateClick = useCallback((date: Date) => {
    const start = date.toISOString();
    const end = new Date(date.getTime() + 60 * 60 * 1000).toISOString(); // 1時間後

    setDialogInitial({
      category: 'User',
      userId: '',
      status: 'planned',
      start,
      end,
      title: '',
      note: '',
    });
    setDialogOpen(true);
  }, []);

  // Timeline specific handlers
  const handleEventCreate = useCallback((payload: { category: Schedule['category']; date: string }) => {
    const startDate = new Date(payload.date);
    startDate.setHours(9, 0, 0, 0); // デフォルトで9:00から開始
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1時間後

    setDialogInitial({
      category: payload.category,
      userId: '',
      status: 'planned',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      title: '',
      note: '',
    });
    setDialogOpen(true);
  }, []);

  const handleEventEdit = useCallback((schedule: Schedule) => {
    // Convert Schedule to ScheduleForm
    let userId = '';
    if (schedule.category === 'User') {
      userId = schedule.personId ?? '';
    } else if (schedule.category === 'Staff') {
      userId = schedule.staffIds?.[0] ?? '';
    }

    // Map Status to ScheduleStatus
    const statusMap: Record<Status, ScheduleStatus> = {
      '下書き': 'planned',
      '申請中': 'planned',
      '承認済み': 'confirmed',
      '完了': 'confirmed'
    };

    setDialogInitial({
      category: schedule.category,
      id: parseInt(schedule.id) || undefined,
      userId,
      status: statusMap[schedule.status] || 'planned',
      start: schedule.start,
      end: schedule.end,
      title: schedule.title,
      note: schedule.notes || '',
    });
    setDialogOpen(true);
  }, []);

  const handleEventClick = useCallback((event: { id: string; title: string; startIso: string }) => {
    // 既存の予定を編集モードで開く
    setDialogInitial({
      category: 'User',
      id: event.id ? parseInt(event.id) : undefined,
      userId: '',
      status: 'planned',
      start: event.startIso,
      end: new Date(new Date(event.startIso).getTime() + 60 * 60 * 1000).toISOString(),
      title: event.title,
      note: '',
    });
    setDialogOpen(true);
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Header with title and period navigation */}
        <Box sx={{ p: 3, pb: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h5" component="h1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonthRoundedIcon />
              スケジュール管理
            </Typography>

            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={handleCreateSchedule}
              sx={{ ml: 'auto' }}
            >
              新規作成
            </Button>

            {view !== 'userCare' && (
              <Stack direction="row" spacing={1}>
                <IconButton
                  onClick={() =>
                    setRange((prev) => {
                      const span = prev.end.getTime() - prev.start.getTime();
                      const nextStart = new Date(prev.start.getTime() - span);
                      const nextEnd = new Date(prev.end.getTime() - span);
                      return { start: nextStart, end: nextEnd };
                    })
                  }
                  aria-label="前の期間"
                >
                  <NavigateBeforeRoundedIcon />
                </IconButton>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const now = new Date();
                    // 月曜始まりの今週を取得
                    const start = startOfWeek(now, { weekStartsOn: 1 });
                    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
                    setRange({ start, end });
                  }}
                >
                  今週
                </Button>

                <IconButton
                  onClick={() =>
                    setRange((prev) => {
                      const span = prev.end.getTime() - prev.start.getTime();
                      const nextStart = new Date(prev.start.getTime() + span);
                      const nextEnd = new Date(prev.end.getTime() + span);
                      return { start: nextStart, end: nextEnd };
                    })
                  }
                  aria-label="次の期間"
                >
                  <NavigateNextRoundedIcon />
                </IconButton>
              </Stack>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary" mb={2}>
            {rangeLabel || '期間未設定'}
          </Typography>

          <FilterToolbar
            toolbarLabel="スケジュールの検索とフィルタ"
            query={query}
            onQueryChange={setQuery}
            searchPlaceholder="予定名、メモ、担当など"
            scope="schedule"
          />
        </Box>

        {/* MUI Tabs for view switching */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tabs
            value={view}
            onChange={(_, newValue) => setView(newValue)}
            aria-label="スケジュールビュー切り替え"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              value="month"
              label="月"
              icon={<CalendarMonthRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              value="week"
              label="週"
              icon={<CalendarViewWeekRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              value="day"
              label="日"
              icon={<TodayRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              value="list"
              label="リスト"
              icon={<ListAltRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              value="userCare"
              label="利用者ケア"
              icon={<PersonRoundedIcon />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
          </Tabs>
        </Box>

        {/* Content Area */}
        <Box sx={{ p: 3 }}>
          {timelineError && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', color: 'error.contrastText', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                予定の読み込みに失敗しました
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {timelineError.message}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', opacity: 0.8 }}>
                ページをリフレッシュ (Cmd+R / Ctrl+R) して再度お試しください。
              </Typography>
              {getAppConfig().isDev && (
                <Typography variant="body2" sx={{ fontSize: '0.875rem', opacity: 0.8, mt: 1 }}>
                  開発環境: SharePoint への接続に問題がある場合、モックデータが使用されます。
                </Typography>
              )}
            </Box>
          )}

          {view === 'month' && (
            <MonthView
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'week' && (
            <TimelineWeek
              events={annotatedTimelineEvents}
              startDate={range.start}
              onEventMove={handleEventMove}
              onEventCreate={handleEventCreate}
              onEventEdit={handleEventEdit}
            />
          )}
          {view === 'day' && (
            <TimelineDay
              events={annotatedTimelineEvents}
              date={dayViewDate}
              onEventCreate={handleEventCreate}
              onEventEdit={handleEventEdit}
            />
          )}
          {view === 'list' && <ScheduleListView />}
          {view === 'userCare' && (
            <Stack spacing={3}>
              <BriefingPanel />
              <UserTab />
              <OrgTab />
              <StaffTab />
            </Stack>
          )}

          {timelineLoading && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                予定を読み込んでいます…
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      <ScheduleDialog
        open={dialogOpen}
        initial={dialogInitial}
        existingSchedules={timelineEvents}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />
    </Container>
  );
}

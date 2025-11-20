import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarViewWeekRoundedIcon from '@mui/icons-material/CalendarViewWeekRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import MonthView from '@/features/schedule/views/MonthView';
import { ScheduleCreateDialog, type CreateScheduleEventInput, type ScheduleFormState, type ScheduleServiceType, type ScheduleUserOption } from '@/features/schedules/ScheduleCreateDialog';
import { useUsersStore } from '@/features/users/store';
import { useSchedules } from '@/stores/useSchedules';
import { createSchedule } from './adapter';
import type { ScheduleForm } from './types';

const QUICK_SERVICE_TYPE_LABELS: Record<ScheduleServiceType, string> = {
  normal: '通常利用',
  transport: '送迎',
  respite: '一時ケア・短期',
  nursing: '看護',
  absence: '欠席・休み',
  other: 'その他',
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'userMessage' in error) {
    const userMessage = (error as { userMessage?: string }).userMessage;
    if (userMessage) return String(userMessage);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const toLocalInputValue = (date: Date): string => format(date, "yyyy-MM-dd'T'HH:mm");

const MonthPage: React.FC = () => {
  const navigate = useNavigate();
  const { reload } = useSchedules();
  const { data: usersData } = useUsersStore();
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [quickDialogInitialDate, setQuickDialogInitialDate] = useState<Date | null>(null);
  const [quickDialogOverride, setQuickDialogOverride] = useState<Partial<ScheduleFormState> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const scheduleUserOptions = useMemo<ScheduleUserOption[]>(() => {
    if (!Array.isArray(usersData)) {
      return [];
    }
    return usersData
      .map((user) => {
        if (!user) return null;
        const userId = typeof user.UserID === 'string' && user.UserID.trim().length
          ? user.UserID.trim()
          : (user.Id != null ? String(user.Id).trim() : '');
        const name = (user.FullName ?? '').trim() || (userId ? `利用者 ${userId}` : '');
        if (!userId || !name) {
          return null;
        }
        return { id: userId, name } satisfies ScheduleUserOption;
      })
      .filter((option): option is ScheduleUserOption => Boolean(option));
  }, [usersData]);

  const scheduleUserMap = useMemo(() => {
    const map = new Map<string, ScheduleUserOption>();
    for (const option of scheduleUserOptions) {
      map.set(option.id, option);
    }
    return map;
  }, [scheduleUserOptions]);

  const defaultQuickUser = scheduleUserOptions[0] ?? null;

  const navigateToRoute = (path: string) => {
    navigate(path);
  };

  const handleDateClick = (date: Date) => {
    const start = new Date(date);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setQuickDialogInitialDate(start);
    setQuickDialogOverride({
      startLocal: toLocalInputValue(start),
      endLocal: toLocalInputValue(end),
    });
    setQuickDialogOpen(true);
  };

  const handleQuickDialogClose = () => {
    setQuickDialogOpen(false);
    setQuickDialogInitialDate(null);
    setQuickDialogOverride(null);
  };

  const handleQuickDialogSubmit = async (input: CreateScheduleEventInput) => {
    try {
      setActionError(null);
      const userOption = scheduleUserMap.get(input.userId);
      const startIso = new Date(input.startLocal).toISOString();
      const endIso = new Date(input.endLocal).toISOString();
      const serviceLabel = QUICK_SERVICE_TYPE_LABELS[input.serviceType] ?? QUICK_SERVICE_TYPE_LABELS.other;

      const payload: ScheduleForm = {
        userId: input.userId,
        title: `${serviceLabel} / ${userOption?.name ?? '利用者'}`,
        note: input.notes ?? undefined,
        status: 'planned',
        start: startIso,
        end: endIso,
      } satisfies ScheduleForm;

      await createSchedule(payload);
      await reload();
    } catch (cause) {
      setActionError(extractErrorMessage(cause, 'スケジュールの作成に失敗しました。'));
      throw cause;
    }
  };

  const displayError = actionError;

  return (
    <Box sx={{ p: 2 }} data-testid="schedule-month-root">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <CalendarMonthRoundedIcon color="primary" />
        <Typography variant="h5" component="h1">
          月間スケジュール
        </Typography>
      </Stack>

      {/* Navigation Tabs and Actions */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', my: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Tabs value="month" aria-label="スケジュールビュー切り替え">
            <Tab
              label="週間"
              value="week"
              icon={<CalendarViewWeekRoundedIcon />}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
              onClick={() => navigateToRoute('/schedules/week')}
            />
            <Tab
              label="月間"
              value="month"
              icon={<CalendarMonthRoundedIcon />}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
            />
            <Tab
              label="日間"
              value="day"
              icon={<Box component="span">📅</Box>}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
              onClick={() => navigateToRoute('/schedules/day')}
            />
          </Tabs>

          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigateToRoute('/schedules/create')}
            sx={{ ml: 2 }}
          >
            新規作成
          </Button>
        </Stack>
      </Box>

      {displayError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {displayError}
        </Alert>
      ) : null}

      <Box mt={2}>
        <MonthView onDateClick={handleDateClick} />
      </Box>

      <ScheduleCreateDialog
        open={quickDialogOpen}
        onClose={handleQuickDialogClose}
        onSubmit={handleQuickDialogSubmit}
        users={scheduleUserOptions}
        initialDate={quickDialogInitialDate ?? undefined}
        defaultUser={defaultQuickUser}
        mode="create"
        initialOverride={quickDialogOverride ?? undefined}
      />
    </Box>
  );
};

export default MonthPage;

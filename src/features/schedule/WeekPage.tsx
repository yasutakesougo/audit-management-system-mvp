import type { Schedule } from '@/lib/mappers';
import { useSchedules } from '@/stores/useSchedules';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ScheduleCreateDialog, type CreateScheduleEventInput, type ScheduleFormState, type ScheduleServiceType, type ScheduleUserOption } from '@/features/schedules/ScheduleCreateDialog';
import { useUsersStore } from '@/features/users/store';
import { createSchedule, updateSchedule } from './adapter';
import ScheduleDialog from './ScheduleDialog';
import type { Category, ExtendedScheduleForm, ScheduleForm, ScheduleStatus } from './types';
import { getWeekRange, WeekView } from './WeekView';

const formatRangeLabel = (start: Date, end: Date): string => {
  const fmt = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const startLabel = fmt.format(start).replace(/\//g, '/');
  const endLabel = fmt.format(end).replace(/\//g, '/');
  return `${startLabel} – ${endLabel}`;
};

const buildDraft = (start: Date, end: Date, seed?: Partial<ExtendedScheduleForm>): ExtendedScheduleForm => ({
  id: seed?.id,
  category: 'User', // デフォルトはUser
  userId: seed?.userId ?? '',
  status: seed?.status ?? 'planned',
  start: start.toISOString(),
  end: end.toISOString(),
  title: seed?.title ?? '',
  note: seed?.note ?? '',
});

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

const WEEK_BUTTON_CLASSES =
  'rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';

const STATUS_MAP: Record<Schedule['status'], ScheduleStatus> = {
  draft: 'planned',
  submitted: 'confirmed',
  approved: 'confirmed',
};

const QUICK_SERVICE_TYPE_LABELS: Record<ScheduleServiceType, string> = {
  normal: '通常利用',
  transport: '送迎',
  respite: '一時ケア・短期',
  nursing: '看護',
  absence: '欠席・休み',
  other: 'その他',
};

const QUICK_SERVICE_TYPE_BY_LABEL: Record<string, ScheduleServiceType> = Object.entries(QUICK_SERVICE_TYPE_LABELS).reduce(
  (acc, [key, label]) => {
    acc[label] = key as ScheduleServiceType;
    return acc;
  },
  {} as Record<string, ScheduleServiceType>
);

const parseIso = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const scheduleOverlapsRange = (schedule: Schedule, start: Date, end: Date): boolean => {
  const eventStart = parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
  const eventEnd = parseIso(schedule.endLocal ?? schedule.endUtc ?? schedule.startLocal ?? schedule.startUtc ?? undefined) ?? eventStart;
  if (!eventStart || !eventEnd) {
    return false;
  }
  return eventStart <= end && eventEnd >= start;
};

const toScheduleForm = (schedule: Schedule): ExtendedScheduleForm => {
  const startIso = schedule.startUtc ?? schedule.startLocal ?? new Date().toISOString();
  const endIso = schedule.endUtc ?? schedule.endLocal ?? startIso;
  return {
    id: schedule.id,
    category: (schedule.category as Category) || 'User',
    userId: schedule.personId ?? (schedule.userId != null ? String(schedule.userId) : ''),
    status: STATUS_MAP[schedule.status] ?? 'planned',
    start: startIso,
    end: endIso,
    title: schedule.title ?? '',
    note: schedule.notes ?? undefined,
  } satisfies ExtendedScheduleForm;
};

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekRange(new Date()).start);
  const weekRange = useMemo(() => getWeekRange(weekStart), [weekStart]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<ExtendedScheduleForm | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [quickDialogInitialDate, setQuickDialogInitialDate] = useState<Date | null>(null);
  const [quickDialogOverride, setQuickDialogOverride] = useState<Partial<ScheduleFormState> | null>(null);
  const [quickDialogMode, setQuickDialogMode] = useState<'create' | 'edit'>('create');
  const [quickDialogEditingSchedule, setQuickDialogEditingSchedule] = useState<Schedule | null>(null);

  const { data: scheduleData, loading: schedulesLoading, error: schedulesError, reload } = useSchedules();
  const { data: usersData } = useUsersStore();

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

  const weekSchedules = useMemo<Schedule[]>(() => {
    if (!scheduleData?.length) {
      return [];
    }
    const start = weekRange.start;
    const end = weekRange.end;
    return scheduleData
      .filter((schedule) => scheduleOverlapsRange(schedule, start, end))
      .sort((a, b) => {
        const aStart = parseIso(a.startLocal ?? a.startUtc ?? undefined)?.getTime() ?? 0;
        const bStart = parseIso(b.startLocal ?? b.startUtc ?? undefined)?.getTime() ?? 0;
        return aStart - bStart;
      });
  }, [scheduleData, weekRange.end, weekRange.start]);

  const handlePrevWeek = () => {
    setWeekStart((prev: Date) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setWeekStart((prev: Date) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  };

  const handleToday = () => {
    setWeekStart(getWeekRange(new Date()).start);
  };

  const openCreateDialog = (start: Date, end: Date) => {
    setDialogInitial(buildDraft(start, end));
    setDialogOpen(true);
  };

  const handleQuickDialogClose = () => {
    setQuickDialogOpen(false);
    setQuickDialogInitialDate(null);
    setQuickDialogOverride(null);
    setQuickDialogMode('create');
    setQuickDialogEditingSchedule(null);
  };

  const toLocalInputValue = (date: Date): string => format(date, "yyyy-MM-dd'T'HH:mm");

  const buildQuickEditOverride = (schedule: Schedule): Partial<ScheduleFormState> | null => {
    if ((schedule.category ?? 'User') !== 'User') {
      return null;
    }
    const userId = schedule.personId?.trim() || (schedule.userId != null ? String(schedule.userId) : '');
    if (!userId) {
      return null;
    }
    const startDate = parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
    const endDate = parseIso(schedule.endLocal ?? schedule.endUtc ?? undefined) ?? startDate;
    if (!startDate || !endDate) {
      return null;
    }
    const serviceType = (() => {
      const label = (schedule.serviceType ?? '').trim();
      if (!label) return 'other';
      return QUICK_SERVICE_TYPE_BY_LABEL[label] ?? 'other';
    })();

    return {
      userId,
      startLocal: toLocalInputValue(startDate),
      endLocal: toLocalInputValue(endDate),
      serviceType,
      locationName: schedule.location ?? '',
      notes: schedule.notes ?? '',
    } satisfies Partial<ScheduleFormState>;
  };

  const openQuickEditDialog = (schedule: Schedule, override?: Partial<ScheduleFormState>): boolean => {
    const baseOverride = buildQuickEditOverride(schedule);
    if (!baseOverride) {
      return false;
    }
    const nextOverride = override ? { ...baseOverride, ...override } : baseOverride;
    const startInput = nextOverride.startLocal ?? baseOverride.startLocal;
    const startDate = startInput ? new Date(startInput) : parseIso(schedule.startLocal ?? schedule.startUtc ?? undefined);
    setQuickDialogMode('edit');
    setQuickDialogEditingSchedule(schedule);
    setQuickDialogInitialDate(startDate ?? null);
    setQuickDialogOverride(nextOverride);
    setQuickDialogOpen(true);
    return true;
  };

  const handleSlotQuickCreate = (start: Date, end: Date) => {
    if (!scheduleUserOptions.length) {
      openCreateDialog(start, end);
      return;
    }
    setQuickDialogMode('create');
    setQuickDialogEditingSchedule(null);
    setQuickDialogInitialDate(new Date(start));
    setQuickDialogOverride({
      startLocal: toLocalInputValue(start),
      endLocal: toLocalInputValue(end),
    });
    setQuickDialogOpen(true);
  };

  const openEditDialog = (schedule: Schedule) => {
    if (openQuickEditDialog(schedule)) {
      return;
    }
    setDialogInitial(toScheduleForm(schedule));
    setDialogOpen(true);
  };

  const handleEventDragEnd = (schedule: Schedule, range: { start: Date; end: Date }) => {
    const overrides: Partial<ScheduleFormState> = {
      startLocal: toLocalInputValue(range.start),
      endLocal: toLocalInputValue(range.end),
    };
    if (openQuickEditDialog(schedule, overrides)) {
      return;
    }
    const fallback = { ...toScheduleForm(schedule), start: range.start.toISOString(), end: range.end.toISOString() };
    setDialogInitial(fallback);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogInitial(undefined);
    setActionError(null);
  };

  const handleDialogSubmit = async (values: ExtendedScheduleForm) => {
    try {
      setActionError(null);
      // ExtendedScheduleFormからScheduleFormに変換
      const scheduleForm: ScheduleForm = {
        id: values.id,
        userId: values.userId || '',
        title: values.title,
        note: values.note,
        status: values.status,
        start: values.start,
        end: values.end,
      };

      if (scheduleForm.id != null) {
        await updateSchedule(scheduleForm.id, scheduleForm);
      } else {
        await createSchedule(scheduleForm);
      }
      await reload();
    } catch (cause) {
      setActionError(extractErrorMessage(cause, '予定の保存に失敗しました。'));
      throw cause;
    }
  };

  const handleQuickDialogSubmit = async (input: CreateScheduleEventInput) => {
    try {
      setActionError(null);
      const userOption = scheduleUserMap.get(input.userId);
      const startIso = new Date(input.startLocal).toISOString();
      const endIso = new Date(input.endLocal).toISOString();
      const serviceLabel = QUICK_SERVICE_TYPE_LABELS[input.serviceType] ?? QUICK_SERVICE_TYPE_LABELS.other;
      const baseStatus: ScheduleStatus = quickDialogMode === 'edit' && quickDialogEditingSchedule
        ? STATUS_MAP[quickDialogEditingSchedule.status] ?? 'planned'
        : 'planned';

      const payload: ScheduleForm = {
        userId: input.userId,
        title: `${serviceLabel} / ${userOption?.name ?? '利用者'}`,
        note: input.notes ?? undefined,
        status: baseStatus,
        start: startIso,
        end: endIso,
      } satisfies ScheduleForm;

      if (quickDialogMode === 'edit' && quickDialogEditingSchedule?.id != null) {
        payload.id = quickDialogEditingSchedule.id;
        await updateSchedule(quickDialogEditingSchedule.id, payload);
      } else {
        await createSchedule(payload);
      }
      await reload();
    } catch (cause) {
      const fallback = quickDialogMode === 'edit' ? '予定の更新に失敗しました。' : '予定の作成に失敗しました。';
      setActionError(extractErrorMessage(cause, fallback));
      throw cause;
    }
  };

  const weekLabel = useMemo(() => formatRangeLabel(weekRange.start, weekRange.end), [weekRange.start, weekRange.end]);
  const normalizedScheduleError = (() => {
    if (!schedulesError) return null;
    if (typeof schedulesError === 'object' && schedulesError && 'userMessage' in schedulesError) {
      const userMessage = (schedulesError as { userMessage?: string }).userMessage;
      if (userMessage) {
        return userMessage;
      }
    }
    return schedulesError.message ?? null;
  })();

  const displayError = actionError ?? normalizedScheduleError ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">スケジュール（週表示）</h1>
          <p className="text-sm text-slate-600">{weekLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`${WEEK_BUTTON_CLASSES} border-slate-300 text-slate-700 hover:bg-slate-100`}
            onClick={handlePrevWeek}
            aria-label="前の週へ移動"
          >
            前の週
          </button>
          <button
            type="button"
            className={`${WEEK_BUTTON_CLASSES} border-slate-300 text-slate-700 hover:bg-slate-100`}
            onClick={handleToday}
            aria-label="今週に移動"
          >
            今日
          </button>
          <button
            type="button"
            className={`${WEEK_BUTTON_CLASSES} border-slate-300 text-slate-700 hover:bg-slate-100`}
            onClick={handleNextWeek}
            aria-label="次の週へ移動"
          >
            次の週
          </button>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            onClick={() => {
              const baseStart = new Date(weekRange.start);
              baseStart.setHours(9, 0, 0, 0);
              const baseEnd = new Date(baseStart);
              baseEnd.setHours(baseStart.getHours() + 1);
              openCreateDialog(baseStart, baseEnd);
            }}
          >
            + 新規作成
          </button>
        </div>
      </header>

      {displayError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {displayError}
        </div>
      ) : null}

      <WeekView
        weekStart={weekRange.start}
        schedules={weekSchedules}
        onSelectSlot={(start, end) => handleSlotQuickCreate(start, end)}
        onSelectEvent={openEditDialog}
        loading={schedulesLoading}
        onEventDragEnd={handleEventDragEnd}
      />

      <div className="min-h-[1.5rem] text-sm text-slate-600" aria-live="polite">
        {schedulesLoading ? '予定を読み込んでいます…' : null}
      </div>

      <ScheduleDialog
        open={dialogOpen}
        initial={dialogInitial}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />

      <ScheduleCreateDialog
        open={quickDialogOpen}
        onClose={handleQuickDialogClose}
        onSubmit={handleQuickDialogSubmit}
        users={scheduleUserOptions}
        initialDate={quickDialogInitialDate ?? undefined}
        defaultUser={defaultQuickUser}
        {...(quickDialogMode === 'edit' && quickDialogEditingSchedule && quickDialogOverride
          ? {
              mode: 'edit' as const,
              eventId: String(quickDialogEditingSchedule.id),
              initialOverride: quickDialogOverride,
            }
          : {
              mode: 'create' as const,
              eventId: undefined,
              initialOverride: quickDialogOverride,
            })}
      />
    </div>
  );
}

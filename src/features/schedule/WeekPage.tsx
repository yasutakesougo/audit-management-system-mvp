import { useMemo, useState } from 'react';
import type { Schedule } from '@/lib/mappers';
import type { ScheduleForm, ScheduleStatus } from './types';
import { getWeekRange, WeekView } from './WeekView';
import ScheduleDialog from './ScheduleDialog';
import { createSchedule, updateSchedule } from './adapter';
import { useSchedules } from '@/stores/useSchedules';

const formatRangeLabel = (start: Date, end: Date): string => {
  const fmt = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const startLabel = fmt.format(start).replace(/\//g, '/');
  const endLabel = fmt.format(end).replace(/\//g, '/');
  return `${startLabel} – ${endLabel}`;
};

const buildDraft = (start: Date, end: Date, seed?: Partial<ScheduleForm>): ScheduleForm => ({
  id: seed?.id,
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

const toScheduleForm = (schedule: Schedule): ScheduleForm => {
  const startIso = schedule.startUtc ?? schedule.startLocal ?? new Date().toISOString();
  const endIso = schedule.endUtc ?? schedule.endLocal ?? startIso;
  return {
    id: schedule.id,
    userId: schedule.personId ?? (schedule.userId != null ? String(schedule.userId) : ''),
    status: STATUS_MAP[schedule.status] ?? 'planned',
    start: startIso,
    end: endIso,
    title: schedule.title ?? '',
    note: schedule.notes ?? undefined,
  } satisfies ScheduleForm;
};

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekRange(new Date()).start);
  const weekRange = useMemo(() => getWeekRange(weekStart), [weekStart]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<ScheduleForm | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: scheduleData, loading: schedulesLoading, error: schedulesError, reload } = useSchedules();

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

  const openEditDialog = (schedule: Schedule) => {
    setDialogInitial(toScheduleForm(schedule));
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogInitial(undefined);
    setActionError(null);
  };

  const handleDialogSubmit = async (values: ScheduleForm) => {
    try {
      setActionError(null);
      if (values.id != null) {
        await updateSchedule(values.id, values);
      } else {
        await createSchedule(values);
      }
      await reload();
    } catch (cause) {
      setActionError(extractErrorMessage(cause, '予定の保存に失敗しました。'));
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
        onSelectSlot={(start, end) => openCreateDialog(start, end)}
        onSelectEvent={openEditDialog}
        loading={schedulesLoading}
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
    </div>
  );
}

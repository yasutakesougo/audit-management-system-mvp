import type { ScheduleForm } from '@/features/schedule/types';
import type { Schedule } from '@/lib/mappers';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseSchedules, mockCreateSchedule, mockUpdateSchedule } = vi.hoisted(() => {
  return {
    mockUseSchedules: vi.fn(),
    mockCreateSchedule: vi.fn(),
    mockUpdateSchedule: vi.fn(),
  };
});

type WeekViewStubProps = {
  weekStart: Date;
  schedules: Schedule[];
  onSelectSlot: (start: Date, end: Date) => void;
  onSelectEvent: (schedule: Schedule) => void;
  loading?: boolean;
};

type ScheduleDialogStubProps = {
  open: boolean;
  initial?: ScheduleForm;
  onSubmit: (values: ScheduleForm) => Promise<void>;
  onClose: () => void;
};

let lastWeekViewProps: WeekViewStubProps | undefined;
let lastDialogProps: ScheduleDialogStubProps | undefined;

const ensureWeekViewProps = (): WeekViewStubProps => {
  if (!lastWeekViewProps) {
    throw new Error('WeekView props not captured');
  }
  return lastWeekViewProps;
};

const ensureDialogProps = (): ScheduleDialogStubProps => {
  if (!lastDialogProps) {
    throw new Error('Dialog props not captured');
  }
  return lastDialogProps;
};

vi.mock('@/stores/useSchedules', () => ({ useSchedules: mockUseSchedules }));
vi.mock('@/features/schedule/adapter', () => ({
  createSchedule: (values: ScheduleForm) => mockCreateSchedule(values),
  updateSchedule: (id: number, values: ScheduleForm) => mockUpdateSchedule(id, values),
}));
vi.mock('@/features/schedule/WeekView', async () => {
  const actual = await vi.importActual<typeof import('@/features/schedule/WeekView')>('@/features/schedule/WeekView');
  return {
    ...actual,
    WeekView: (props: WeekViewStubProps) => {
      lastWeekViewProps = props;
      return (
        <div data-testid="stub-week-view">
          <button type="button" onClick={() => props.onSelectSlot(new Date('2025-03-03T00:00:00Z'), new Date('2025-03-03T01:00:00Z'))}>
            trigger-slot
          </button>
          {props.schedules.map((schedule: Schedule) => (
            <button key={schedule.id} type="button" onClick={() => props.onSelectEvent(schedule)}>
              open-event-{schedule.id}
            </button>
          ))}
          <span data-loading={props.loading ? '1' : '0'}>{props.weekStart.toISOString()}</span>
        </div>
      );
    },
  };
});
vi.mock('@/features/schedule/ScheduleDialog', () => ({
  default: (props: ScheduleDialogStubProps) => {
    lastDialogProps = props;
    return props.open ? (
      <div data-testid="schedule-dialog" data-initial-id={props.initial?.id ?? 'new'}>
        {props.initial?.title ?? '新規'}
      </div>
    ) : null;
  },
}));

import WeekPage from '@/features/schedule/WeekPage';

const buildSchedule = (overrides: Partial<Schedule>): Schedule => ({
  id: overrides.id ?? 1,
  etag: overrides.etag ?? null,
  title: overrides.title ?? '予定',
  startUtc: overrides.startUtc ?? '2025-03-03T00:00:00.000Z',
  endUtc: overrides.endUtc ?? '2025-03-03T01:00:00.000Z',
  startLocal: overrides.startLocal ?? '2025-03-03T09:00:00+09:00',
  endLocal: overrides.endLocal ?? '2025-03-03T10:00:00+09:00',
  startDate: overrides.startDate ?? '2025-03-03',
  endDate: overrides.endDate ?? '2025-03-03',
  allDay: overrides.allDay ?? false,
  location: overrides.location ?? null,
  staffId: overrides.staffId ?? null,
  userId: overrides.userId ?? null,
  status: overrides.status ?? 'draft',
  notes: overrides.notes ?? null,
  recurrenceRaw: overrides.recurrenceRaw ?? null,
  recurrence: overrides.recurrence,
  created: overrides.created,
  modified: overrides.modified,
  category: overrides.category ?? 'ショートステイ',
  serviceType: overrides.serviceType ?? null,
  personType: overrides.personType ?? null,
  personId: overrides.personId ?? null,
  personName: overrides.personName ?? null,
  staffIds: overrides.staffIds,
  staffNames: overrides.staffNames,
  dayPart: overrides.dayPart ?? null,
  billingFlags: overrides.billingFlags,
  targetUserIds: overrides.targetUserIds,
  targetUserNames: overrides.targetUserNames,
  relatedResourceIds: overrides.relatedResourceIds,
  relatedResourceNames: overrides.relatedResourceNames,
  rowKey: overrides.rowKey ?? null,
  dayKey: overrides.dayKey ?? null,
  monthKey: overrides.monthKey ?? null,
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
  assignedStaffIds: overrides.assignedStaffIds,
  assignedStaffNames: overrides.assignedStaffNames,
  statusLabel: overrides.statusLabel,
});

describe('WeekPage branches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-05T00:00:00+09:00'));
    mockCreateSchedule.mockResolvedValue(undefined);
    mockUpdateSchedule.mockResolvedValue(undefined);
    lastWeekViewProps = undefined;
    lastDialogProps = undefined;
    mockUseSchedules.mockReset();
    mockCreateSchedule.mockClear();
    mockUpdateSchedule.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('filters schedules to the active week and completes create flow', async () => {
    const reload = vi.fn(async () => {});
    const schedules = [
      buildSchedule({ id: 1, title: '週内', startLocal: '2025-03-03T09:00:00+09:00', endLocal: '2025-03-03T10:00:00+09:00' }),
      buildSchedule({ id: 2, title: '週外', startLocal: '2025-02-20T09:00:00+09:00', endLocal: '2025-02-20T10:00:00+09:00' }),
      buildSchedule({ id: 3, title: '無効', startLocal: 'invalid', endLocal: 'invalid' }),
    ];
    mockUseSchedules.mockReturnValue({ data: schedules, loading: false, error: undefined, reload });

    render(<WeekPage />);

    await act(async () => {
      expect(ensureWeekViewProps().schedules).toHaveLength(1);
    });

    const initialWeekStart = ensureWeekViewProps().weekStart;
    fireEvent.click(screen.getByRole('button', { name: '前の週へ移動' }));
    expect(ensureWeekViewProps().weekStart.getTime()).toBeLessThan(initialWeekStart.getTime());

    fireEvent.click(screen.getByRole('button', { name: '次の週へ移動' }));
    expect(ensureWeekViewProps().weekStart.getTime()).toBeGreaterThan(initialWeekStart.getTime() - 1);

    fireEvent.click(screen.getByRole('button', { name: '今週に移動' }));
    expect(ensureWeekViewProps().weekStart.toISOString()).toEqual(initialWeekStart.toISOString());

    await act(async () => {
      ensureWeekViewProps().onSelectSlot(new Date('2025-03-06T00:00:00Z'), new Date('2025-03-06T01:00:00Z'));
    });

    const dialog = ensureDialogProps();
    expect(dialog.open).toBe(true);
    expect(dialog.initial?.id).toBeUndefined();

    expect(dialog.initial).toBeDefined();
    await act(async () => {
      await ensureDialogProps().onSubmit(dialog.initial!);
    });
    expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);

    await act(async () => {
      ensureDialogProps().onClose();
    });
    expect(ensureDialogProps().open).toBe(false);

  });

  it('surfaces backend and action errors during update flow', async () => {
    const reload = vi.fn(async () => {});
    const schedules: Schedule[] = [
      buildSchedule({ id: 10, title: '更新対象', status: 'submitted', startLocal: '2025-03-05T09:00:00+09:00', endLocal: '2025-03-05T11:00:00+09:00', personId: '42' }),
    ];
    const storeError = { userMessage: '読み込みに失敗しました。' } as Error & { userMessage: string };
  mockUseSchedules.mockReturnValue({ data: schedules, loading: true, error: storeError, reload });
  mockUpdateSchedule.mockRejectedValueOnce({ userMessage: '保存に失敗しました。' });

  render(<WeekPage />);

    expect(screen.getByText('読み込みに失敗しました。')).toBeInTheDocument();
    expect(screen.getByText('予定を読み込んでいます…')).toBeInTheDocument();

    await act(async () => {
      ensureWeekViewProps().onSelectEvent(schedules[0]);
    });
    const dialog = ensureDialogProps();
    expect(dialog.initial?.id).toBe(10);
    expect(dialog.initial?.status).toBe('confirmed');
    expect(dialog.initial?.userId).toBe('42');

    expect(dialog.initial).toBeDefined();
    await expect(async () => {
      await ensureDialogProps().onSubmit(dialog.initial!);
    }).rejects.toBeDefined();

    expect(mockUpdateSchedule).toHaveBeenCalledWith(10, expect.objectContaining({ id: 10 }));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('保存に失敗しました。')).toBeInTheDocument();
  });
});

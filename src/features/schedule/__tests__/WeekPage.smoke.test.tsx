 import type { Schedule } from '@/lib/mappers';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WeekPage from '../WeekPage';

const MOCK_WEEK_START_ISO = '2025-01-06T00:00:00Z';
const MOCK_WEEK_END_ISO = '2025-01-12T23:59:59Z';

const buildSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: overrides.id ?? 100,
  etag: overrides.etag ?? 'etag-100',
  title: overrides.title ?? '既存予定',
  startUtc: overrides.startUtc ?? '2025-01-06T00:00:00Z',
  endUtc: overrides.endUtc ?? '2025-01-06T01:00:00Z',
  startLocal: overrides.startLocal ?? '2025-01-06T09:00:00',
  endLocal: overrides.endLocal ?? '2025-01-06T10:00:00',
  startDate: overrides.startDate ?? '2025-01-06',
  endDate: overrides.endDate ?? '2025-01-06',
  allDay: overrides.allDay ?? false,
  location: overrides.location ?? '生活介護室',
  staffId: overrides.staffId ?? null,
  userId: overrides.userId ?? 1,
  status: overrides.status ?? 'draft',
  notes: overrides.notes ?? '既存メモ',
  recurrenceRaw: overrides.recurrenceRaw ?? null,
  recurrence: overrides.recurrence,
  created: overrides.created ?? undefined,
  modified: overrides.modified ?? undefined,
  category: overrides.category ?? 'User',
  serviceType: overrides.serviceType ?? '通常利用',
  personType: overrides.personType ?? 'Internal',
  personId: overrides.personId ?? 'user-1',
  personName: overrides.personName ?? '利用者 一郎',
  staffIds: overrides.staffIds ?? [],
  staffNames: overrides.staffNames ?? [],
  dayPart: overrides.dayPart ?? null,
  billingFlags: overrides.billingFlags ?? [],
  targetUserIds: overrides.targetUserIds ?? [],
  targetUserNames: overrides.targetUserNames ?? [],
  relatedResourceIds: overrides.relatedResourceIds ?? [],
  relatedResourceNames: overrides.relatedResourceNames ?? [],
  rowKey: overrides.rowKey ?? null,
  dayKey: overrides.dayKey ?? '2025-01-06',
  monthKey: overrides.monthKey ?? '2025-01',
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
  assignedStaffIds: overrides.assignedStaffIds ?? [],
  assignedStaffNames: overrides.assignedStaffNames ?? [],
});

vi.mock('../adapter', () => ({
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
}));

vi.mock('../WeekView', () => {
  const MockWeekView = ({ schedules, onSelectSlot, onSelectEvent, onEventDragEnd }: {
    schedules: Schedule[];
    onSelectSlot(start: Date, end: Date): void;
    onSelectEvent(schedule: Schedule): void;
    onEventDragEnd?: (schedule: Schedule, window: { start: Date; end: Date }) => void;
  }) => (
    <div data-testid="mock-week-view">
      <button type="button" onClick={() => onSelectSlot(new Date('2025-01-06T09:00:00Z'), new Date('2025-01-06T10:00:00Z'))}>
        slot-trigger
      </button>
      <button
        type="button"
        disabled={!onEventDragEnd || !schedules.length}
        onClick={() => {
          if (onEventDragEnd && schedules[0]) {
            onEventDragEnd(schedules[0], {
              start: new Date('2025-01-07T09:00:00Z'),
              end: new Date('2025-01-07T10:00:00Z'),
            });
          }
        }}
      >
        drag-trigger
      </button>
      {schedules.map((item) => (
        <button key={item.id} type="button" onClick={() => onSelectEvent(item)}>
          編集:{item.title ?? '予定'}
        </button>
      ))}
    </div>
  );

  return {
    WeekView: MockWeekView,
    default: MockWeekView,
    getWeekRange: () => ({ start: new Date(MOCK_WEEK_START_ISO), end: new Date(MOCK_WEEK_END_ISO) }),
  };
});

vi.mock('@/features/users/store', () => ({
  useUsersStore: vi.fn(() => ({
    data: [
      { Id: 1, UserID: 'user-1', FullName: '利用者 一郎' },
    ],
  })),
}));

type MockQuickDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  eventId?: string;
  onSubmit: (input: { userId: string; startLocal: string; endLocal: string; serviceType: 'normal' }) => void;
  initialOverride?: { startLocal?: string; endLocal?: string; userId?: string } | null;
  onClose: () => void;
  users: Array<{ id: string }>;
};

vi.mock('@/features/schedules/ScheduleCreateDialog', () => {
  const MockQuickDialog = ({ open, onSubmit, initialOverride, onClose, users, mode, eventId }: MockQuickDialogProps) => {
    if (!open) return null;
    return (
      <div data-testid="quick-dialog-mock">
        <div data-testid="quick-dialog-mode">{mode}</div>
        <div data-testid="quick-dialog-event-id">{eventId ?? ''}</div>
        <div data-testid="quick-dialog-start">{initialOverride?.startLocal ?? ''}</div>
        <div data-testid="quick-dialog-user">{initialOverride?.userId ?? ''}</div>
        <button
          type="button"
          onClick={() =>
            onSubmit({
              userId: initialOverride?.userId ?? users[0]?.id ?? '',
              startLocal: initialOverride?.startLocal ?? '2025-01-06T09:00',
              endLocal: initialOverride?.endLocal ?? '2025-01-06T10:00',
              serviceType: 'normal',
            })
          }
        >
          quick-submit
        </button>
        <button type="button" onClick={onClose}>
          quick-close
        </button>
      </div>
    );
  };

  return {
    __esModule: true,
    ScheduleCreateDialog: MockQuickDialog,
  };
});

const reloadMock = vi.fn();
let schedulesRef: Schedule[] = [];

vi.mock('@/stores/useSchedules', () => ({
  useSchedules: vi.fn(() => ({
    data: schedulesRef,
    loading: false,
    error: null,
    source: 'sharepoint',
    fallbackKind: null,
    fallbackError: null,
    reload: reloadMock,
  })),
}));

import { createSchedule, updateSchedule } from '../adapter';

const createScheduleMock = vi.mocked(createSchedule);
const updateScheduleMock = vi.mocked(updateSchedule);

describe('WeekPage smoke test', () => {
  beforeEach(() => {
    schedulesRef = []; // Start with empty schedules for create flow test
    createScheduleMock.mockResolvedValue(undefined);
    updateScheduleMock.mockResolvedValue(undefined);
    reloadMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('supports create and edit flows', async () => {
    const user = userEvent.setup();
    render(<WeekPage />);

    // Find and click the specific create button
    const createButton = screen.getByRole('button', { name: '+ 新規作成' });
    await user.click(createButton);

    expect(await screen.findByRole('heading', { name: '予定を作成' })).toBeInTheDocument();

    // Wait for conditional fields to render
    await screen.findByLabelText(/利用者\s*ID/);

    await user.type(screen.getByLabelText(/利用者\s*ID/), 'NEW-001');

    // Select staff member (required for User category)
    const staffInput = screen.getByRole('combobox', { name: '担当職員' });
    await user.click(staffInput);

    // Wait for options to appear
    await waitFor(() => {
      const options = screen.queryAllByRole('option');
      console.log('Available options:', options.length);
      options.forEach((option, i) => {
        console.log(`  Option ${i}: ${option.textContent}`);
      });
    });

    // Try to click on first option if available
    const options = screen.queryAllByRole('option');
    if (options.length > 0) {
      await user.click(options[0]);
    } else {
      // Fallback: try typing and selecting
      await user.type(staffInput, 'S-001');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
    }

    await user.type(screen.getByLabelText('タイトル'), '新しい予定');
    await user.type(screen.getByLabelText('メモ'), '詳細メモ');

    // Debug button state
    const saveButton = screen.getByRole('button', { name: '保存' });
    console.log('Save button disabled:', saveButton.getAttribute('disabled'));
    console.log('Save button text:', saveButton.textContent);
    console.log('Save button classes:', saveButton.className);

    // Wait for button to be enabled
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    }, { timeout: 5000 });

    // Submit the form
    await user.click(saveButton);

    await waitFor(() =>
      expect(createScheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'NEW-001',
          title: '新しい予定',
          note: '詳細メモ',
        })
      )
    );

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
  });

  it('opens quick create dialog from week slot and saves with overrides', async () => {
    const user = userEvent.setup();
    render(<WeekPage />);

    const slotTrigger = screen.getAllByText('slot-trigger')[0];
    await user.click(slotTrigger);

    const [quickDialog] = await screen.findAllByTestId('quick-dialog-mock');
    expect(quickDialog).toBeInTheDocument();
    expect(within(quickDialog).getByTestId('quick-dialog-mode')).toHaveTextContent('create');

    await user.click(within(quickDialog).getByText('quick-submit'));

    await waitFor(() =>
      expect(createScheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          start: '2025-01-06T09:00:00.000Z',
          end: '2025-01-06T10:00:00.000Z',
          title: expect.stringContaining('通常利用'),
        })
      )
    );

    expect(reloadMock).toHaveBeenCalled();
  });

  it('opens quick edit dialog for existing user schedules and updates via adapter', async () => {
    const user = userEvent.setup();
    schedulesRef = [buildSchedule()];
    render(<WeekPage />);

    const editButton = await screen.findByText('編集:既存予定');
    await user.click(editButton);

    const quickDialogs = await screen.findAllByTestId('quick-dialog-mock');
    const quickDialog = quickDialogs[quickDialogs.length - 1];
    expect(within(quickDialog).getByTestId('quick-dialog-mode')).toHaveTextContent('edit');
    expect(within(quickDialog).getByTestId('quick-dialog-event-id')).toHaveTextContent('100');
    expect(within(quickDialog).getByTestId('quick-dialog-user')).toHaveTextContent('user-1');

    await user.click(within(quickDialog).getByText('quick-submit'));

    await waitFor(() =>
      expect(updateScheduleMock).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          userId: 'user-1',
          status: 'planned',
        })
      )
    );
    expect(reloadMock).toHaveBeenCalled();
  });

  it('opens quick edit dialog with overridden times after drag drop', async () => {
    const user = userEvent.setup();
    schedulesRef = [buildSchedule()];
    render(<WeekPage />);

    const dragButtons = await screen.findAllByText('drag-trigger');
    const dragButton = dragButtons.find((button) => !button.hasAttribute('disabled')) ?? dragButtons[dragButtons.length - 1];
    await user.click(dragButton);

    const quickDialogs = await screen.findAllByTestId('quick-dialog-mock');
    const quickDialog = quickDialogs.find((dialog) =>
      within(dialog).getByTestId('quick-dialog-mode').textContent?.trim() === 'edit',
    );
    expect(quickDialog).toBeDefined();
    expect(within(quickDialog as HTMLElement).getByTestId('quick-dialog-event-id')).toHaveTextContent('100');

    expect(updateScheduleMock).not.toHaveBeenCalled();

    await user.click(within(quickDialog as HTMLElement).getByText('quick-submit'));

    await waitFor(() =>
      expect(updateScheduleMock).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          start: '2025-01-07T09:00:00.000Z',
          end: '2025-01-07T10:00:00.000Z',
        })
      )
    );
    expect(reloadMock).toHaveBeenCalled();
  });
});

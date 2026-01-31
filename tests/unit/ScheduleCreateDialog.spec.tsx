import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScheduleCreateDialog } from '@/features/schedules/ScheduleCreateDialog';
import {
  createInitialScheduleFormState,
  toCreateScheduleInput,
  validateScheduleForm,
  type ScheduleFormState,
  type ScheduleUserOption
} from '@/features/schedules/scheduleFormState';
import { TESTIDS } from '@/testids';

const mockUsers: ScheduleUserOption[] = [
  { id: 'user-1', name: '利用者 一郎', lookupId: '101' },
  { id: 'user-2', name: '利用者 二郎', lookupId: '102' }
];

const buildForm = (overrides: Partial<ScheduleFormState> = {}): ScheduleFormState => ({
  title: 'テスト予定',
  category: 'User',
  userId: 'user-1',
  startLocal: '2025-11-12T10:00',
  endLocal: '2025-11-12T11:00',
  serviceType: 'normal',
  locationName: '',
  notes: '',
  assignedStaffId: '',
  vehicleId: '',
  status: 'Planned',
  statusReason: '',
  ...overrides
});

afterEach(() => {
  cleanup();
});

describe('createInitialScheduleFormState', () => {
  it('uses provided initial date and default user while setting a 1-hour slot', () => {
    const initialDate = new Date(2025, 10, 12, 9, 15, 0);
    const form = createInitialScheduleFormState({
      initialDate,
      defaultUserId: 'user-2'
    });

    expect(form.title).toBe('');
    expect(form.userId).toBe('user-2');
    expect(form.startLocal.startsWith('2025-11-12')).toBe(true);
    expect(form.startLocal.endsWith('10:00')).toBe(true);
    expect(form.endLocal.endsWith('11:00')).toBe(true);
    expect(form.status).toBe('Planned');
  });
});

describe('validateScheduleForm', () => {
  it('collects errors for missing required fields', () => {
    const result = validateScheduleForm(
      buildForm({ title: '', startLocal: '', endLocal: '', serviceType: '' })
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      '予定タイトルを入力してください',
      '開始日時を入力してください',
      '終了日時を入力してください',
      'サービス種別を選択してください'
    ]);
  });

  it('rejects ranges where end is not after start', () => {
    const result = validateScheduleForm(
      buildForm({ startLocal: '2025-11-12T11:00', endLocal: '2025-11-12T10:00' })
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('終了日時は開始日時より後にしてください');
  });

  it('passes for a well-formed payload', () => {
    const result = validateScheduleForm(buildForm());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('toCreateScheduleInput', () => {
  it('throws when required fields are missing', () => {
    expect(() =>
      toCreateScheduleInput(buildForm({ title: '', serviceType: 'normal' }))
    ).toThrowError(/title is required/);

    expect(() =>
      toCreateScheduleInput(buildForm({ startLocal: '', serviceType: 'normal' }))
    ).toThrowError(/startLocal and endLocal are required/);

    expect(() =>
      toCreateScheduleInput(buildForm({ startLocal: 'a', endLocal: 'b', serviceType: '' }))
    ).toThrowError(/serviceType is required/);
  });

  it('maps optional fields to undefined when empty', () => {
    const result = toCreateScheduleInput(buildForm({ locationName: '', notes: '' }));
    expect(result).toMatchObject({
      title: 'テスト予定',
      userId: 'user-1',
      startLocal: '2025-11-12T10:00',
      endLocal: '2025-11-12T11:00',
      serviceType: 'normal',
      status: 'Planned',
    });
  });

  it('includes lookup metadata when the selected user is provided', () => {
    const result = toCreateScheduleInput(buildForm(), mockUsers[0]);
    expect(result.userLookupId).toBe('101');
    expect(result.userName).toBe('利用者 一郎');
  });
});

describe('ScheduleCreateDialog component', () => {
  it('links aria-labelledby/aria-describedby to heading and description test ids', () => {
    render(
      <ScheduleCreateDialog
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        users={mockUsers}
        defaultUser={mockUsers[0]}
        mode="create"
      />
    );

    const dialog = screen.getByTestId(TESTIDS['schedule-create-dialog']);
    const heading = screen.getByTestId(TESTIDS['schedule-create-heading']);
    const description = screen.getByTestId(TESTIDS['schedule-create-description']);
    const headingId = heading.getAttribute('id');
    const descriptionId = description.getAttribute('id');

    expect(headingId).toBeTruthy();
    expect(descriptionId).toBeTruthy();
    expect(dialog).toHaveAttribute('aria-labelledby', headingId ?? undefined);
    expect(dialog).toHaveAttribute('aria-describedby', descriptionId ?? undefined);
  });

  it('extends aria-describedby with error summary id when validation fails', async () => {
    render(
      <ScheduleCreateDialog
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        users={mockUsers}
        defaultUser={mockUsers[0]}
        mode="create"
      />
    );

    fireEvent.click(screen.getByTestId(TESTIDS['schedule-create-save']));

    const alert = await screen.findByTestId(TESTIDS['schedule-create-error-alert']);
    const alertId = alert.getAttribute('id');
    const dialog = screen.getByTestId(TESTIDS['schedule-create-dialog']);
    const expectedDescriptionId = `${TESTIDS['schedule-create-dialog']}-description`;

    expect(alertId).toBe(`${TESTIDS['schedule-create-dialog']}-errors`);
    const resolvedAlertId = alertId as string;
    expect(dialog).toHaveAttribute('aria-describedby', `${expectedDescriptionId} ${resolvedAlertId}`);
  });

  it('renders dialog with default values and selects default user', () => {
    render(
      <ScheduleCreateDialog
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        users={mockUsers}
        initialDate={new Date(2025, 10, 12)}
        defaultUser={mockUsers[1]}
        mode="create"
      />
    );

    expect(screen.getByTestId(TESTIDS['schedule-create-dialog'])).toBeInTheDocument();

    const titleInput = screen.getByTestId(TESTIDS['schedule-create-title']) as HTMLInputElement;
    expect(titleInput.value).toBe('利用者 二郎の予定');

    const userInput = screen.getByTestId(
      TESTIDS['schedule-create-user-input']
    ) as HTMLInputElement;
    expect(userInput.value).toBe('利用者 二郎');

    const startInput = screen.getByTestId(TESTIDS['schedule-create-start']) as HTMLInputElement;
    const endInput = screen.getByTestId(TESTIDS['schedule-create-end']) as HTMLInputElement;
    expect(startInput.value.endsWith('10:00')).toBe(true);
    expect(endInput.value.endsWith('11:00')).toBe(true);
  });

  it('applies initial overrides when provided', () => {
    render(
      <ScheduleCreateDialog
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        users={mockUsers}
        defaultUser={mockUsers[0]}
        initialDate={new Date(2025, 10, 12)}
        initialOverride={{
          startLocal: '2025-12-24T14:00',
          endLocal: '2025-12-24T15:30',
          serviceType: 'absence',
        }}
        mode="create"
      />
    );

    const startInput = screen.getByTestId(TESTIDS['schedule-create-start']) as HTMLInputElement;
    const endInput = screen.getByTestId(TESTIDS['schedule-create-end']) as HTMLInputElement;
    expect(startInput.value).toBe('2025-12-24T14:00');
    expect(endInput.value).toBe('2025-12-24T15:30');

    const serviceTypeCombo = screen.getByRole('combobox', { name: 'サービス種別' });
    expect(serviceTypeCombo).toHaveTextContent('欠席');
  });

  it('shows validation errors when attempting to submit an empty form', async () => {
    const onSubmit = vi.fn();
    render(
      <ScheduleCreateDialog open onClose={vi.fn()} onSubmit={onSubmit} users={mockUsers} mode="create" />
    );

    // clear title to trigger validation
    fireEvent.change(screen.getByTestId(TESTIDS['schedule-create-title']), { target: { value: '' } });
    fireEvent.click(screen.getByTestId(TESTIDS['schedule-create-save']));

    const alert = await screen.findByTestId(TESTIDS['schedule-create-error-alert']);
    expect(alert).toHaveTextContent('予定タイトルを入力してください');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prevents submission when end time is before start time', async () => {
    render(
      <ScheduleCreateDialog
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        users={mockUsers}
        defaultUser={mockUsers[0]}
        mode="create"
      />
    );

    const startInput = screen.getByTestId(TESTIDS['schedule-create-start']) as HTMLInputElement;
    const endInput = screen.getByTestId(TESTIDS['schedule-create-end']) as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: '2025-11-12T12:00' } });
    fireEvent.change(endInput, { target: { value: '2025-11-12T11:00' } });

    fireEvent.click(screen.getByTestId(TESTIDS['schedule-create-save']));

    const alert = await screen.findByTestId(TESTIDS['schedule-create-error-alert']);
    expect(alert).toHaveTextContent('終了日時は開始日時より後にしてください');
  });

  it('selects service type, submits payload, and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ScheduleCreateDialog
        open
        onClose={onClose}
        onSubmit={onSubmit}
        users={mockUsers}
        defaultUser={mockUsers[0]}
        initialDate={new Date(2025, 10, 12)}
        mode="create"
      />
    );

    fireEvent.change(screen.getByTestId(TESTIDS['schedule-create-title']), {
      target: { value: '送迎（午前）' },
    });
    const serviceTypeCombo = screen.getByRole('combobox', { name: 'サービス種別' });
    fireEvent.mouseDown(serviceTypeCombo);
    const listbox = await screen.findByRole('listbox');
    fireEvent.click(within(listbox).getByText('欠席'));
    expect(serviceTypeCombo).toHaveTextContent('欠席');

    fireEvent.change(screen.getByTestId(TESTIDS['schedule-create-location']), {
      target: { value: '生活介護室' }
    });
    fireEvent.change(screen.getByTestId(TESTIDS['schedule-create-notes']), {
      target: { value: '送迎後に看護対応' }
    });

    fireEvent.click(screen.getByTestId(TESTIDS['schedule-create-save']));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: '送迎（午前）',
      userId: 'user-1',
      serviceType: 'absence',
      locationName: '生活介護室',
      notes: '送迎後に看護対応'
    });
    expect(payload.startLocal.endsWith('10:00')).toBe(true);
    expect(payload.endLocal.endsWith('11:00')).toBe(true);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
  it('renders edit mode labels, override values, and keeps user selection', () => {
    render(
      <ScheduleCreateDialog
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        users={mockUsers}
        mode="edit"
        eventId="evt-1"
        initialOverride={{
          userId: 'user-2',
          startLocal: '2025-12-01T10:00',
          endLocal: '2025-12-01T11:00',
          serviceType: 'transport',
          locationName: '第1作業室',
          notes: '経管栄養',
        }}
      />
    );

    expect(screen.getByText('スケジュール更新')).toBeInTheDocument();
    const saveButton = screen.getByTestId(TESTIDS['schedule-create-save']);
    expect(saveButton).toHaveTextContent('更新');

    const titleInput = screen.getByTestId(TESTIDS['schedule-create-title']) as HTMLInputElement;
    expect(titleInput.value).toBe('利用者 二郎の予定');
    const userInput = screen.getByTestId(TESTIDS['schedule-create-user-input']) as HTMLInputElement;
    expect(userInput.value).toBe('利用者 二郎');
    expect((screen.getByTestId(TESTIDS['schedule-create-start']) as HTMLInputElement).value).toBe('2025-12-01T10:00');
    expect((screen.getByTestId(TESTIDS['schedule-create-end']) as HTMLInputElement).value).toBe('2025-12-01T11:00');
  });
});

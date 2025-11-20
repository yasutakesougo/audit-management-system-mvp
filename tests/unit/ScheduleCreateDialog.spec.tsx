import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ScheduleCreateDialog,
  createInitialScheduleFormState,
  validateScheduleForm,
  toCreateScheduleInput,
  type ScheduleFormState,
  type ScheduleUserOption
} from '@/features/schedules/ScheduleCreateDialog';
import { TESTIDS } from '@/testids';

const mockUsers: ScheduleUserOption[] = [
  { id: 'user-1', name: '利用者 一郎' },
  { id: 'user-2', name: '利用者 二郎' }
];

const buildForm = (overrides: Partial<ScheduleFormState> = {}): ScheduleFormState => ({
  userId: 'user-1',
  startLocal: '2025-11-12T10:00',
  endLocal: '2025-11-12T11:00',
  serviceType: 'normal',
  locationName: '',
  notes: '',
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

    expect(form.userId).toBe('user-2');
    expect(form.startLocal.startsWith('2025-11-12')).toBe(true);
    expect(form.startLocal.endsWith('10:00')).toBe(true);
    expect(form.endLocal.endsWith('11:00')).toBe(true);
  });
});

describe('validateScheduleForm', () => {
  it('collects errors for missing required fields', () => {
    const result = validateScheduleForm(
      buildForm({ userId: '', startLocal: '', endLocal: '', serviceType: '' })
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        '利用者を選択してください',
        '開始日時を入力してください',
        '終了日時を入力してください',
        'サービス種別を選択してください'
      ])
    );
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
      toCreateScheduleInput(buildForm({ userId: '', serviceType: '' }))
    ).toThrowError(/userId is required/);

    expect(() =>
      toCreateScheduleInput(buildForm({ userId: 'user-1', startLocal: '', serviceType: 'normal' }))
    ).toThrowError(/startLocal and endLocal are required/);

    expect(() =>
      toCreateScheduleInput(
        buildForm({ userId: 'user-1', startLocal: 'a', endLocal: 'b', serviceType: '' })
      )
    ).toThrowError(/serviceType is required/);
  });

  it('maps optional fields to undefined when empty', () => {
    const result = toCreateScheduleInput(buildForm({ locationName: '', notes: '' }));
    expect(result).toEqual({
      userId: 'user-1',
      startLocal: '2025-11-12T10:00',
      endLocal: '2025-11-12T11:00',
      serviceType: 'normal'
    });
  });
});

describe('ScheduleCreateDialog component', () => {
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
          serviceType: 'transport',
        }}
        mode="create"
      />
    );

    const startInput = screen.getByTestId(TESTIDS['schedule-create-start']) as HTMLInputElement;
    const endInput = screen.getByTestId(TESTIDS['schedule-create-end']) as HTMLInputElement;
    expect(startInput.value).toBe('2025-12-24T14:00');
    expect(endInput.value).toBe('2025-12-24T15:30');

    const serviceTypeCombo = screen.getByRole('combobox', { name: 'サービス種別' });
    expect(serviceTypeCombo).toHaveTextContent('送迎');
  });

  it('shows validation errors when attempting to submit an empty form', async () => {
    const onSubmit = vi.fn();
    render(
      <ScheduleCreateDialog open onClose={vi.fn()} onSubmit={onSubmit} users={mockUsers} mode="create" />
    );

    fireEvent.click(screen.getByTestId(TESTIDS['schedule-create-save']));

    const alert = await screen.findByTestId(TESTIDS['schedule-create-error-alert']);
    expect(alert).toHaveTextContent('利用者を選択してください');
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

    const serviceTypeCombo = screen.getByRole('combobox', { name: 'サービス種別' });
    fireEvent.mouseDown(serviceTypeCombo);
    const listbox = await screen.findByRole('listbox');
    fireEvent.click(within(listbox).getByText('看護'));
    expect(serviceTypeCombo).toHaveTextContent('看護');

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
      userId: 'user-1',
      serviceType: 'nursing',
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
          serviceType: 'nursing',
          locationName: '第1作業室',
          notes: '経管栄養',
        }}
      />
    );

    expect(screen.getByText('スケジュール更新')).toBeInTheDocument();
    const saveButton = screen.getByTestId(TESTIDS['schedule-create-save']);
    expect(saveButton).toHaveTextContent('更新');

    const userInput = screen.getByTestId(TESTIDS['schedule-create-user-input']) as HTMLInputElement;
    expect(userInput.value).toBe('利用者 二郎');
    expect((screen.getByTestId(TESTIDS['schedule-create-start']) as HTMLInputElement).value).toBe('2025-12-01T10:00');
    expect((screen.getByTestId(TESTIDS['schedule-create-end']) as HTMLInputElement).value).toBe('2025-12-01T11:00');
  });
});

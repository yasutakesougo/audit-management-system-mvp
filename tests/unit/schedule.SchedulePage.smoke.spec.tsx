import * as schedulesClient from '@/features/schedule/api/schedulesClient';
import * as snackbarHost from '@/features/nurse/components/SnackbarHost';
import SchedulePage from '@/features/schedule/SchedulePage';
import * as spUserCare from '@/features/schedule/spClient.schedule';
import * as spOrg from '@/features/schedule/spClient.schedule.org';
import * as spStaff from '@/features/schedule/spClient.schedule.staff';
import type { ScheduleUserCare } from '@/features/schedule/types';
import { TESTIDS } from '@/testids';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({
    account: {
      username: 'self@example.com',
      name: '自分',
      idTokenClaims: { email: 'self@example.com' },
    },
  }),
}));

const spStub = { spFetch: vi.fn() };

vi.mock('@/lib/spClient', () => ({
  useSP: () => spStub,
}));

vi.mock('@/stores/useStaff', () => ({
  useStaff: () => ({
    data: [
      {
        id: 1,
        name: '自分',
        email: 'self@example.com',
        staffId: 'self',
      },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock('@/features/schedule/ensureScheduleList', () => ({
  useEnsureScheduleList: () => undefined,
}));

vi.mock('@/features/users/store', () => ({
  useUsersStore: () => ({
    data: [
      { Id: 1, UserID: 'user-1', FullName: '利用者 一郎' },
      { Id: 2, UserID: 'user-2', FullName: '利用者 二郎' },
    ],
    status: 'success',
    error: null,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: () => ({
      ...actual.getAppConfig(),
      isDev: false,
    }),
  };
});

vi.mock('@/features/schedule/components/BriefingPanel', () => ({
  default: () => <div data-testid="briefing-panel" />,
}));

vi.mock('@/features/schedule/views/MonthView', () => ({
  default: () => <div data-testid="month-view" />,
}));

vi.mock('@/features/schedule/views/TimelineDay', () => ({
  default: () => <div data-testid="timeline-day" />,
}));

vi.mock('@/features/schedule/views/ListView', () => ({
  default: () => <div data-testid="list-view" />,
}));

vi.mock('@/features/schedule/views/UserTab', () => ({
  default: () => <div data-testid="user-tab" />,
}));

vi.mock('@/features/schedule/views/OrgTab', () => ({
  default: () => <div data-testid="org-tab" />,
}));

vi.mock('@/features/schedule/views/StaffTab', () => ({
  default: () => <div data-testid="staff-tab" />,
}));

vi.mock('@/ui/filters/FilterToolbar', () => ({
  default: () => <div data-testid="filter-toolbar" />,
}));

describe('SchedulePage user schedule smoke', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-11-12T09:00:00+09:00'));
    vi.clearAllMocks();
    vi.spyOn(schedulesClient, 'isScheduleFixturesMode').mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates and updates user schedules through existing helpers and shows snackbars', async () => {
    const existing: ScheduleUserCare = {
      id: 'existing-1',
      etag: 'etag-1',
      category: 'User',
      title: '既存予定',
      start: '2025-11-11T00:00:00.000Z',
      end: '2025-11-11T01:00:00.000Z',
      allDay: false,
      status: '下書き',
      location: '第1作業室',
      notes: undefined,
      recurrenceRule: undefined,
      dayKey: '2025-11-11',
      fiscalYear: undefined,
      serviceType: '一時ケア',
      personType: 'Internal',
      personId: 'user-1',
      personName: '利用者 一郎',
      externalPersonName: undefined,
      externalPersonOrg: undefined,
      externalPersonContact: undefined,
      staffIds: ['1'],
      staffNames: ['自分'],
    };

    const createUserCareSpy = vi
      .spyOn(spUserCare, 'createUserCare')
      .mockResolvedValue({ ...existing, id: 'created-1', title: 'テスト予定' });
    const updateUserCareSpy = vi
      .spyOn(spUserCare, 'updateUserCare')
      .mockResolvedValue({ ...existing, title: '更新後' });
    vi.spyOn(spUserCare, 'getUserCareSchedules').mockResolvedValue([existing]);
    vi.spyOn(spOrg, 'getOrgSchedules').mockResolvedValue([]);
    vi.spyOn(spStaff, 'getStaffSchedules').mockResolvedValue([]);

    const showMock = vi.fn();
    vi.spyOn(snackbarHost, 'useSnackbarHost').mockReturnValue({
      show: showMock,
      open: vi.fn(),
      message: '',
      ui: null,
    });

    render(
      <MemoryRouter initialEntries={['/schedule/week']}>
        <SchedulePage />
      </MemoryRouter>
    );

    const quickButton = await screen.findByTestId(TESTIDS['schedule-create-quick-button']);
    fireEvent.click(quickButton);

    const quickDialog = await screen.findByTestId(TESTIDS['schedule-create-dialog']);
    const serviceTypeCombo = within(quickDialog).getByRole('combobox', { name: 'サービス種別' });
    fireEvent.mouseDown(serviceTypeCombo);
    const serviceTypeList = await screen.findByRole('listbox');
    fireEvent.click(within(serviceTypeList).getByText('欠席'));

    fireEvent.change(within(quickDialog).getByTestId(TESTIDS['schedule-create-location']), {
      target: { value: '生活介護室' },
    });
    fireEvent.change(within(quickDialog).getByTestId(TESTIDS['schedule-create-notes']), {
      target: { value: '送迎後に看護対応' },
    });

    fireEvent.click(within(quickDialog).getByTestId(TESTIDS['schedule-create-save']));

    await waitFor(() => expect(createUserCareSpy).toHaveBeenCalledTimes(1));
    const quickPayload = createUserCareSpy.mock.calls[0][1];
    expect(quickPayload).toMatchObject({
      personId: 'user-1',
      personName: '利用者 一郎',
      serviceType: '欠席・休み',
      location: '生活介護室',
      notes: '送迎後に看護対応',
    });

    const createButton = await screen.findByRole('button', { name: /新規作成/ });
    fireEvent.click(createButton);

    const dialogTitle = await screen.findByText('予定を作成');
    const createDialog = dialogTitle.closest('[role="dialog"]');
    expect(createDialog).not.toBeNull();
    const createDialogScope = within(createDialog as HTMLElement);

    const titleInput = createDialogScope.getByLabelText('タイトル');
    fireEvent.change(titleInput, { target: { value: 'テスト予定' } });

    const userCombo = createDialogScope.getByRole('combobox', { name: '利用者の選択' });
    fireEvent.mouseDown(userCombo);
    const userOption = await screen.findByRole('option', { name: '利用者 一郎' });
    fireEvent.click(userOption);

    const startInput = createDialogScope.getByLabelText(/開始日時/);
    fireEvent.change(startInput, { target: { value: '2025-11-12T09:00' } });
    const endInput = createDialogScope.getByLabelText(/終了日時/);
    fireEvent.change(endInput, { target: { value: '2025-11-12T10:00' } });

    const saveButton = createDialogScope.getByRole('button', { name: '保存' });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(createUserCareSpy).toHaveBeenCalledTimes(2));
    expect(showMock).toHaveBeenCalledWith('予定を作成しました', 'success');

    const createPayload = createUserCareSpy.mock.calls[1][1];
    expect(Array.isArray(createPayload.staffIds)).toBe(true);
    expect(createPayload.staffIds.length).toBeGreaterThan(0);

    const timelineItems = await screen.findAllByTestId('schedule-item');
    expect(timelineItems[0]).toHaveTextContent('一時ケア');
    fireEvent.click(timelineItems[0]);

    const editQuickDialog = await screen.findByTestId(TESTIDS['schedule-create-dialog']);
    const notesInput = within(editQuickDialog).getByTestId(TESTIDS['schedule-create-notes']);
    fireEvent.change(notesInput, { target: { value: '更新メモ' } });

    const updateButton = within(editQuickDialog).getByTestId(TESTIDS['schedule-create-save']);
    fireEvent.click(updateButton);

    await waitFor(() => expect(updateUserCareSpy).toHaveBeenCalledTimes(1));
    expect(showMock).toHaveBeenCalledWith('予定を更新しました', 'success');
  }, 20000);
});

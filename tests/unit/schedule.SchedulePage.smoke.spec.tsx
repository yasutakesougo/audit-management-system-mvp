import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SchedulePage from '@/features/schedule/SchedulePage';
import type { ScheduleUserCare } from '@/features/schedule/types';
import * as spUserCare from '@/features/schedule/spClient.schedule';
import * as spOrg from '@/features/schedule/spClient.schedule.org';
import * as spStaff from '@/features/schedule/spClient.schedule.staff';
import * as snackbarHost from '@/features/nurse/components/SnackbarHost';

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
    vi.clearAllMocks();
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
      location: undefined,
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
    const getUserCareSchedulesSpy = vi
      .spyOn(spUserCare, 'getUserCareSchedules')
      .mockResolvedValue([existing]);
    vi.spyOn(spOrg, 'getOrgSchedules').mockResolvedValue([]);
    vi.spyOn(spStaff, 'getStaffSchedules').mockResolvedValue([]);

    const showMock = vi.fn();
    vi.spyOn(snackbarHost, 'useSnackbarHost').mockReturnValue({
      show: showMock,
      open: vi.fn(),
      message: '',
      ui: null,
    });

    render(<SchedulePage />);

    const createButton = await screen.findByRole('button', { name: /新規作成/ });
    fireEvent.click(createButton);

  const titleInput = await screen.findByLabelText('タイトル');
    fireEvent.change(titleInput, { target: { value: 'テスト予定' } });

  const userIdInput = await screen.findByPlaceholderText('U-001');
  fireEvent.change(userIdInput, { target: { value: 'user-123' } });

  const startInput = await screen.findByLabelText(/開始日時/);
  fireEvent.change(startInput, { target: { value: '2025-11-12T09:00' } });
  const endInput = await screen.findByLabelText(/終了日時/);
  fireEvent.change(endInput, { target: { value: '2025-11-12T10:00' } });

    const saveButton = screen.getByRole('button', { name: '保存' });
  expect(saveButton).not.toBeDisabled();
  fireEvent.click(saveButton);

    await waitFor(() => expect(createUserCareSpy).toHaveBeenCalledTimes(1));
    expect(showMock).toHaveBeenCalledWith('予定を作成しました', 'success');

    const createPayload = createUserCareSpy.mock.calls[0][1];
    expect(Array.isArray(createPayload.staffIds)).toBe(true);
    expect(createPayload.staffIds.length).toBeGreaterThan(0);

    const timelineItems = await screen.findAllByTestId('schedule-item');
    fireEvent.click(timelineItems[0]);

    const editTitleInput = await screen.findByLabelText('タイトル');
    fireEvent.change(editTitleInput, { target: { value: '更新後' } });

    const updateButton = screen.getByRole('button', { name: '保存' });
    fireEvent.click(updateButton);

    await waitFor(() => expect(updateUserCareSpy).toHaveBeenCalledTimes(1));
    expect(showMock).toHaveBeenCalledWith('予定を更新しました', 'success');

    expect(getUserCareSchedulesSpy).toHaveBeenCalled();
  });
});

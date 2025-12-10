import { TESTIDS } from '@/testids';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableDailyRecordForm } from '../TableDailyRecordForm';

// Mock useUsers hook
const mockUsers = [
  {
    id: 1,
    userId: 'U001',
    name: '田中 太郎',
    furigana: 'たなか たろう',
    attendanceDays: ['月', '水', '金'] // 月水金通所
  },
  {
    id: 2,
    userId: 'U002',
    name: '佐藤 花子',
    furigana: 'さとう はなこ',
    attendanceDays: ['火', '木'] // 火木通所
  },
  {
    id: 3,
    userId: 'U003',
    name: '山田 一郎',
    furigana: 'やまだ いちろう'
    // attendanceDays未設定（毎日通所）
  }
];

vi.mock('@/stores/useUsers', () => ({
  useUsers: () => ({
    data: mockUsers
  })
}));

const WEEKDAY_TOKENS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const getWeekdayToken = (date: Date) => WEEKDAY_TOKENS[date.getDay()];
const getAttendingUsersForDate = (date: Date) =>
  mockUsers.filter((user) => {
    if (!user.attendanceDays || user.attendanceDays.length === 0) {
      return true;
    }
    return user.attendanceDays.includes(getWeekdayToken(date));
  });
const getDefaultAttendingUsers = () => getAttendingUsersForDate(new Date());
const getDefaultSelectionCount = () => getDefaultAttendingUsers().length;

describe('TableDailyRecordForm', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn()
  };

  const renderForm = (overrideProps: Partial<typeof defaultProps> = {}) =>
    render(<TableDailyRecordForm {...defaultProps} {...overrideProps} />);

  const getSearchInput = () => screen.getAllByPlaceholderText('名前またはIDで検索')[0];
  const getReporterInput = () => screen.getAllByLabelText('記録者名')[0];
  const getDateInput = () => screen.getAllByLabelText('記録日')[0];
  const getFilterButton = () => screen.getByRole('button', { name: '今日の通所者のみ表示' });
  const getUserList = () => screen.getByTestId(TESTIDS['daily-table-record-form-user-list']);
  const getTableContainer = () => screen.getByTestId(TESTIDS['daily-table-record-form-table']);
  const withinUserList = () => within(getUserList());
  const waitForTable = () =>
    waitFor(() => {
      expect(screen.getByTestId(TESTIDS['daily-table-record-form-table'])).toBeInTheDocument();
    });
  const waitForSelectionInfo = (count: number) =>
    waitFor(() => {
      expect(screen.getByText(new RegExp(`${count}人の利用者が選択されています`))).toBeInTheDocument();
    });
  const setRecordDate = async (value: string) => {
    const input = getDateInput();
    fireEvent.change(input, { target: { value } });
    await waitFor(() => {
      expect(input).toHaveValue(value);
    });
  };
  const createUser = () => userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render table daily record form when open', () => {
    renderForm();

    expect(screen.getByTestId(TESTIDS['daily-table-record-form'])).toBeInTheDocument();
    expect(screen.getByText('一覧形式ケース記録入力')).toBeInTheDocument();
    expect(screen.getByText('利用者を行として並べて、各項目を効率的に一覧入力できます')).toBeInTheDocument();
  });

  it('should not render when closed', async () => {
    renderForm({ open: false });

    await waitFor(() => {
      expect(screen.queryByTestId(TESTIDS['daily-table-record-form'])).not.toBeInTheDocument();
    });
  });

  it('should display all users in the selection list', async () => {
    const user = createUser();
    renderForm();

    const filterButton = getFilterButton();
    if (filterButton.textContent?.includes('通所')) {
      await user.click(filterButton);
    }

    const list = withinUserList();
    expect(list.getByText('田中 太郎 (U001)')).toBeInTheDocument();
    expect(list.getByText('佐藤 花子 (U002)')).toBeInTheDocument();
    expect(list.getByText('山田 一郎 (U003)')).toBeInTheDocument();
  });

  it('should filter users based on search query', async () => {
    const user = createUser();
    renderForm();

    const filterButton = getFilterButton();
    if (filterButton.textContent?.includes('通所')) {
      await user.click(filterButton);
      await waitFor(() => {
        expect(filterButton).toHaveTextContent('全利用者');
      });
    }

    const searchInput = getSearchInput();
    await user.type(searchInput, '田中');

    await waitFor(() => {
      expect(withinUserList().getByText('田中 太郎 (U001)')).toBeInTheDocument();
      expect(withinUserList().queryByText('佐藤 花子 (U002)')).not.toBeInTheDocument();
      expect(withinUserList().queryByText('山田 一郎 (U003)')).not.toBeInTheDocument();
    });
  });

  it('should auto-select todays attendees on open', async () => {
    renderForm();

    const expectedCount = getDefaultSelectionCount();
    await waitForSelectionInfo(expectedCount);
    if (expectedCount > 0) {
      await waitForTable();
    }
  });

  it('should show table immediately with auto-selected attendees', async () => {
    renderForm();

    await waitForTable();
    const table = within(getTableContainer());
    expect(table.getByText('利用者')).toBeInTheDocument();
    expect(table.getByText('午前活動')).toBeInTheDocument();
    expect(table.getByText('午後活動')).toBeInTheDocument();
    expect(table.getByText('昼食摂取')).toBeInTheDocument();
    expect(table.getByText('問題行動')).toBeInTheDocument();
    expect(table.getByText('特記事項')).toBeInTheDocument();
  });

  it('should allow input in table fields', async () => {
    const user = createUser();
    renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const amActivityInput = table.getAllByPlaceholderText('午前の活動')[0];
    const pmActivityInput = table.getAllByPlaceholderText('午後の活動')[0];

    await user.type(amActivityInput, '朝の体操');
    await user.type(pmActivityInput, '作業活動');

    expect(amActivityInput).toHaveValue('朝の体操');
    expect(pmActivityInput).toHaveValue('作業活動');
  });

  it('should handle lunch amount selection', async () => {
    const user = createUser();
    renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const lunchSelect = table.getAllByRole('combobox')[0];
    await user.click(lunchSelect);
    await user.click(screen.getByRole('option', { name: '完食' }));

    await waitFor(() => {
      expect(table.getByText('完食')).toBeInTheDocument();
    });
  });

  it('should handle problem behavior chips', async () => {
    const user = createUser();
    renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const firstRow = table.getAllByRole('row')[1];
    const selfHarmChip = within(firstRow).getByText('自傷');
    await user.click(selfHarmChip);

    expect(selfHarmChip).toBeInTheDocument();
  });

  it('should handle special notes input', async () => {
    const user = createUser();
    renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const specialNotesInput = table.getAllByPlaceholderText('特記事項')[0];
    await user.type(specialNotesInput, '今日は元気でした');

    expect(specialNotesInput).toHaveValue('今日は元気でした');
  });

  it('should clear row data when clear button is clicked', async () => {
    const user = createUser();
    renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const amActivityInput = table.getAllByPlaceholderText('午前の活動')[0];
    await user.type(amActivityInput, '朝の体操');

    const clearButton = table.getAllByLabelText('この行をクリア')[0];
    await user.click(clearButton);

    await waitFor(() => {
      expect(amActivityInput).toHaveValue('');
    });
  });

  it('should call onSave with correct data when saved', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    const user = createUser();

    renderForm({ onSave: mockOnSave });

    await setRecordDate('2024-01-01');
    const mondayCount = getAttendingUsersForDate(new Date('2024-01-01')).length;
    await waitForSelectionInfo(mondayCount);

    const reporterInput = getReporterInput();
    await user.type(reporterInput, '支援員A');

    await waitForTable();

    const table = within(getTableContainer());
    const amActivityInput = table.getAllByPlaceholderText('午前の活動')[0];
    await user.type(amActivityInput, '朝の体操');

    const saveButton = screen.getByRole('button', { name: `${mondayCount}人分保存` });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          reporter: expect.objectContaining({
            name: '支援員A'
          }),
          userRows: expect.arrayContaining([
            expect.objectContaining({
              userId: 'U001',
              amActivity: '朝の体操'
            })
          ])
        })
      );
    });
  });

  it('should prevent saving without selected users', async () => {
    const mockOnSave = vi.fn();
    const user = createUser();

    renderForm({ onSave: mockOnSave });

    await waitForTable();

    const clearAllButton = screen.getByLabelText(/選択をクリア/);
    await user.click(clearAllButton);

    const reporterInput = getReporterInput();
    await user.type(reporterInput, '支援員A');

    const saveButton = screen.getByRole('button', { name: '0人分保存' });
    expect(saveButton).toBeDisabled();

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should prevent saving without reporter name', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const mockOnSave = vi.fn();
    const user = createUser();

    renderForm({ onSave: mockOnSave });

    await waitForTable();

    const saveButton = screen.getByRole('button', { name: `${getDefaultSelectionCount()}人分保存` });
    await user.click(saveButton);

    expect(alertMock).toHaveBeenCalledWith('記録者名を入力してください');
    expect(mockOnSave).not.toHaveBeenCalled();

    alertMock.mockRestore();
  });

  it('should handle select all functionality', async () => {
    const user = createUser();
    renderForm();

    await waitForTable();

    const clearAllButton = screen.getByLabelText(/選択をクリア/);
    await user.click(clearAllButton);

    const selectAllButton = screen.getByLabelText(/表示中の利用者を全選択/);
    await user.click(selectAllButton);

    await waitForSelectionInfo(getDefaultSelectionCount());
  });

  it('should handle clear all functionality', async () => {
    const user = createUser();
    renderForm();

    await waitForSelectionInfo(getDefaultSelectionCount());

    const clearAllButton = screen.getByLabelText(/選択をクリア/);
    await user.click(clearAllButton);

    await waitFor(() => {
      expect(screen.queryByText(/人の利用者が選択されています/)).not.toBeInTheDocument();
    });
  });

  describe('Attendance Day Filter', () => {
    it('should show attendance filter button', () => {
      renderForm();

      const filterButton = getFilterButton();
      expect(filterButton).toBeInTheDocument();
      expect(filterButton).toHaveTextContent('通所日のみ');
    });

    it('should toggle filter between attendance day and all users', async () => {
      const user = createUser();
      renderForm();

      const filterButton = getFilterButton();
      await user.click(filterButton);

      await waitFor(() => {
        expect(filterButton).toHaveTextContent('全利用者');
      });
    });

    it('should filter users based on attendance days when date is Monday', async () => {
      renderForm();

      await setRecordDate('2024-01-01');

      // Should show only Monday attendees and users without attendance days
      await waitFor(() => {
        expect(screen.getByText(/1月1日.*通所者のみ表示中/)).toBeInTheDocument();
      });

      // Should show 田中太郎 (Monday attendee) and 山田一郎 (no attendance days set)
      const list = withinUserList();
      expect(list.getByText('田中 太郎 (U001)')).toBeInTheDocument();
      expect(list.getByText('山田 一郎 (U003)')).toBeInTheDocument();
      expect(list.queryByText('佐藤 花子 (U002)')).not.toBeInTheDocument();
    });

    it('should filter users based on attendance days when date is Tuesday', async () => {
      renderForm();

      await setRecordDate('2024-01-02');

      // Should show only Tuesday attendees and users without attendance days
      await waitFor(() => {
        expect(screen.getByText(/1月2日.*通所者のみ表示中/)).toBeInTheDocument();
      });

      // Should show 佐藤花子 (Tuesday attendee) and 山田一郎 (no attendance days set)
      const list = withinUserList();
      expect(list.getByText('佐藤 花子 (U002)')).toBeInTheDocument();
      expect(list.getByText('山田 一郎 (U003)')).toBeInTheDocument();
      expect(list.queryByText('田中 太郎 (U001)')).not.toBeInTheDocument();
    });

    it('should auto-update selected users when date changes with attendance filter on', async () => {
      renderForm();

      await setRecordDate('2024-01-01');

      await waitFor(() => {
        const table = within(getTableContainer());
        expect(table.getByText('田中 太郎')).toBeInTheDocument();
      });

      await setRecordDate('2024-01-02');

      await waitFor(() => {
        const table = within(getTableContainer());
        expect(table.queryByText('田中 太郎')).not.toBeInTheDocument();
        expect(table.getByText('佐藤 花子')).toBeInTheDocument();
      });
    });

    it('should show all users when attendance filter is disabled', async () => {
      const user = createUser();
      renderForm();

      // Disable attendance filter
      const filterButton = getFilterButton();
      await user.click(filterButton);

      // Should show all users regardless of attendance days
      const list = withinUserList();
      expect(list.getByText('田中 太郎 (U001)')).toBeInTheDocument();
      expect(list.getByText('佐藤 花子 (U002)')).toBeInTheDocument();
      expect(list.getByText('山田 一郎 (U003)')).toBeInTheDocument();

      // Should not show attendance filter alert
      await waitFor(() => {
        expect(screen.queryByText(/の通所者のみ表示中/)).not.toBeInTheDocument();
      });
    });
  });
});
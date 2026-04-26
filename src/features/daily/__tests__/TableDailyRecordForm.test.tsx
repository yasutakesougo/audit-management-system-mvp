import { TESTIDS } from '@/testids';
import { TextField } from '@mui/material';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableDailyRecordForm } from '../forms/TableDailyRecordForm';
import { useTableDailyRecordForm } from '../hooks/view-models/useTableDailyRecordForm';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock useUsers hook
const mockUsers = [
  {
    Id: 1,
    id: 1, // Legacy fallback
    UserID: 'U001',
    userId: 'U001', // Legacy fallback
    FullName: '田中 太郎',
    name: '田中 太郎', // Legacy fallback
    Furigana: 'たなか たろう',
    furigana: 'たなか たろう', // Legacy fallback
    AttendanceDays: ['月', '水', '金'],
    attendanceDays: ['月', '水', '金'], // Legacy fallback
    UsageStatus: '利用中',
  },
  {
    Id: 2,
    id: 2,
    UserID: 'U002',
    userId: 'U002',
    FullName: '佐藤 花子',
    name: '佐藤 花子',
    Furigana: 'さとう はなこ',
    furigana: 'さとう はなこ',
    AttendanceDays: ['火', '木'],
    attendanceDays: ['火', '木'],
    UsageStatus: '利用中',
  },
  {
    Id: 3,
    id: 3,
    UserID: 'U003',
    userId: 'U003',
    FullName: '山田 一郎',
    name: '山田 一郎',
    Furigana: 'やまだ いちろう',
    furigana: 'やまだ いちろう',
    AttendanceDays: [],
    // attendanceDays未設定（毎日通所）
    UsageStatus: '利用中',
  }
];

vi.mock('@/features/users/store', () => ({
  useUsers: () => ({
    data: mockUsers
  })
}));

const FIXED_DATE = '2024-01-01';
const FIXED_DATE_SELECTION_COUNT = 2; // Deterministic expected auto-selection count for FIXED_DATE

import type { DailyRecordRepository } from '../domain/legacy/DailyRecordRepository';

/**
 * テスト用ラッパー:
 * AppBarに移動した date / reporter フィールドをテスト内に再構成
 */
function TableDailyRecordFormTestWrapper(props: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  repository: DailyRecordRepository;
}) {
  const formState = useTableDailyRecordForm(props);

  if (!props.open) return null;

  return (
    <>
      {/* AppBar相当のメタ情報フィールド */}
      <TextField
        type="date"
        label="記録日"
        size="small"
        value={formState.formData.date}
        onChange={(e) =>
          formState.setFormData((prev) => ({ ...prev, date: e.target.value }))
        }
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="記録者名"
        size="small"
        value={formState.formData.reporter.name}
        onChange={(e) =>
          formState.setFormData((prev) => ({
            ...prev,
            reporter: { ...prev.reporter, name: e.target.value },
          }))
        }
      />

      <TableDailyRecordForm
        open={props.open}
        variant="content"
        onClose={props.onClose}
        onSave={props.repository.save}
        controlledState={formState}
      />

      {/* AppBar相当のアクションボタン（variant="content"ではフッターが出ないため） */}
      <button
        onClick={formState.handleSave}
        disabled={formState.saving || formState.selectedUserIds.length === 0}
      >
        {formState.saving ? '保存中...' : `${formState.selectedUserIds.length}人分保存`}
      </button>
    </>
  );
}

describe('TableDailyRecordForm', () => {
  vi.setConfig({ testTimeout: 30000 });

  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockLoad = vi.fn().mockResolvedValue(null);
  const mockRepository = { save: mockSave, load: mockLoad } as unknown as DailyRecordRepository;

  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    repository: mockRepository,
  };

  const renderForm = async (overrideProps: Partial<typeof defaultProps> = {}) => {
    await act(async () => {
      render(<TableDailyRecordFormTestWrapper {...defaultProps} {...overrideProps} />);
    });
  };

  const getReporterInput = () => screen.getAllByLabelText('記録者名')[0];
  const getDateInput = () => screen.getAllByLabelText('記録日')[0];
  const getTableContainer = () => screen.getByTestId(TESTIDS['daily-table-record-form-table']);
  const waitForTable = () =>
    waitFor(() => {
      expect(screen.getByTestId(TESTIDS['daily-table-record-form-table'])).toBeInTheDocument();
    });
  const waitForSelectionInfo = (count: number) =>
    waitFor(
      () => {
        const el = screen.getByTestId('selection-count');
        expect(el).toHaveTextContent(`${count}人選択中`);
      },
      { timeout: 10000 }
    );
  const setRecordDate = async (value: string) => {
    const input = getDateInput();
    fireEvent.change(input, { target: { value } });
    await waitFor(() => {
      expect(input).toHaveValue(value);
    });
  };

  /**
   * Helper to expand the UserPicker accordion.
   * The search input and filter button are inside the expandable panel.
   */
  const expandUserPicker = async () => {
    // Click the summary bar directly via its test ID
    const summaryBar = screen.getByTestId('user-picker-summary');
    await act(async () => {
      fireEvent.click(summaryBar);
    });
    // Wait for the search input to appear (inside Collapse)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('名前またはIDで検索')).toBeInTheDocument();
    });
  };

  const getUserList = () => screen.getByTestId(TESTIDS['daily-table-record-form-user-list']);
  const withinUserList = () => within(getUserList());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render table daily record form when open', async () => {
    await renderForm();

    await waitFor(() => {
      expect(screen.getByTestId(TESTIDS['daily-table-record-form'])).toBeInTheDocument();
      // The form shows a selection-count chip
      expect(screen.getByTestId('selection-count')).toBeInTheDocument();
    });
  });

  it('should not render when closed', async () => {
    await renderForm({ open: false });

    await waitFor(() => {
      expect(screen.queryByTestId(TESTIDS['daily-table-record-form'])).not.toBeInTheDocument();
    });
  });

  it('should display all users in the selection list', async () => {
    await renderForm();

    // Expand user picker to see user list
    await expandUserPicker();

    // Toggle filter to show all users if needed
    const filterButton = screen.getByText(/^(全利用者|通所日のみ)$/);
    await act(async () => {
      fireEvent.click(filterButton);
    });

    const list = withinUserList();
    expect(list.getByText('田中 太郎 (U001)')).toBeInTheDocument();
    expect(list.getByText('佐藤 花子 (U002)')).toBeInTheDocument();
    expect(list.getByText('山田 一郎 (U003)')).toBeInTheDocument();
  });

  it('should filter users based on search query', async () => {
    await renderForm();

    // Expand user picker
    await expandUserPicker();

    // Toggle to show all users first
    const filterButton = screen.getByText(/^(全利用者|通所日のみ)$/);
    if (filterButton.textContent?.includes('通所日のみ')) {
      await act(async () => {
        fireEvent.click(filterButton);
      });
      await waitFor(() => {
        expect(filterButton).toHaveTextContent('全利用者');
      });
    }

    const searchInput = screen.getByPlaceholderText('名前またはIDで検索');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '田中' } });
    });

    await waitFor(() => {
      expect(withinUserList().getByText('田中 太郎 (U001)')).toBeInTheDocument();
      expect(withinUserList().queryByText('佐藤 花子 (U002)')).not.toBeInTheDocument();
      expect(withinUserList().queryByText('山田 一郎 (U003)')).not.toBeInTheDocument();
    });
  });

  it(
    'should auto-select todays attendees on open',
    async () => {
      await renderForm();

      await setRecordDate(FIXED_DATE);

      const expectedCount = FIXED_DATE_SELECTION_COUNT;
      await waitForSelectionInfo(expectedCount);
      if (expectedCount > 0) {
        await waitForTable();
      }
    }
  );

  it('should show table immediately with auto-selected attendees', async () => {
    await renderForm();

    await waitForTable();
    const table = within(getTableContainer());
    expect(table.getByText('利用者')).toBeInTheDocument();
    expect(table.getByText('午前活動')).toBeInTheDocument();
    expect(table.getByText('午後活動')).toBeInTheDocument();
    expect(table.getByText('昼食')).toBeInTheDocument();
    expect(table.getByText('問題行動')).toBeInTheDocument();
    expect(table.getByText('特記事項')).toBeInTheDocument();
  });

  it('should allow input in table fields', async () => {
    await renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const amActivityInput = table.getAllByPlaceholderText('午前')[0];
    const pmActivityInput = table.getAllByPlaceholderText('午後')[0];

    await act(async () => {
      fireEvent.change(amActivityInput, { target: { value: '朝の体操' } });
      fireEvent.change(pmActivityInput, { target: { value: '作業活動' } });
    });

    expect(amActivityInput).toHaveValue('朝の体操');
    expect(pmActivityInput).toHaveValue('作業活動');
  });

  it('should handle lunch amount selection', async () => {
    await renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const lunchSelect = table.getAllByRole('combobox')[0];
    await act(async () => {
      fireEvent.mouseDown(lunchSelect);
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: '完食' }));
    });

    await waitFor(() => {
      expect(table.getByText('完食')).toBeInTheDocument();
    });
  });

  it('should handle problem behavior chips', async () => {
    await renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const firstRow = table.getAllByRole('row')[1];
    const selfHarmChip = within(firstRow).getByText('自傷');
    await act(async () => {
      fireEvent.click(selfHarmChip);
    });

    expect(selfHarmChip).toBeInTheDocument();
  });

  it('should handle special notes input', async () => {
    await renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const specialNotesInput = table.getAllByPlaceholderText('特記')[0];
    await act(async () => {
      fireEvent.change(specialNotesInput, { target: { value: '今日は元気でした' } });
    });

    expect(specialNotesInput).toHaveValue('今日は元気でした');
  });

  it('should clear row data when clear button is clicked', async () => {
    await renderForm();

    await waitForTable();

    const table = within(getTableContainer());
    const amActivityInput = table.getAllByPlaceholderText('午前')[0];
    await act(async () => {
      fireEvent.change(amActivityInput, { target: { value: '朝の体操' } });
    });

    const clearButton = table.getAllByLabelText('この行をクリア')[0];
    await act(async () => {
      fireEvent.click(clearButton);
    });

    await waitFor(() => {
      expect(amActivityInput).toHaveValue('');
    });
  });

  it('should call repository.save with correct data when saved', async () => {
    mockSave.mockClear();

    await renderForm();

    await setRecordDate(FIXED_DATE);
    await waitForSelectionInfo(FIXED_DATE_SELECTION_COUNT);

    const reporterInput = getReporterInput();
    await act(async () => {
      fireEvent.change(reporterInput, { target: { value: '支援員A' } });
    });

    await waitForTable();

    const table = within(getTableContainer());
    const amActivityInput = table.getAllByPlaceholderText('午前')[0];
    await act(async () => {
      fireEvent.change(amActivityInput, { target: { value: '朝の体操' } });
    });

    const saveButton = await screen.findByRole(
      'button',
      { name: `${FIXED_DATE_SELECTION_COUNT}人分保存` },
      { timeout: 5000 },
    );
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(
      () => {
        expect(mockSave).toHaveBeenCalledWith(
          expect.objectContaining({
            reporter: expect.objectContaining({ name: '支援員A' }),
            userRows: expect.arrayContaining([
              expect.objectContaining({
                userId: 'U001',
                amActivity: '朝の体操',
              }),
            ]),
          }),
        );
      },
      { timeout: 15000 },
    );
  });

  it('should prevent saving without selected users', async () => {
    mockSave.mockClear();

    await renderForm();

    await waitForTable();

    const clearAllButton = screen.getByLabelText(/選択をクリア/);
    await act(async () => {
      fireEvent.click(clearAllButton);
    });

    const reporterInput = getReporterInput();
    fireEvent.change(reporterInput, { target: { value: '支援員A' } });

    const saveButton = await screen.findByRole('button', { name: '0人分保存' }, { timeout: 5000 });
    expect(saveButton).toBeDisabled();

    expect(mockSave).not.toHaveBeenCalled();
  });

  it(
    'should prevent saving without reporter name',
    async () => {
      mockSave.mockClear();

      await renderForm();

      await setRecordDate(FIXED_DATE);
      await waitForTable();
      await waitForSelectionInfo(FIXED_DATE_SELECTION_COUNT);

      const saveButton = await screen.findByRole('button', { name: `${FIXED_DATE_SELECTION_COUNT}人分保存` }, { timeout: 5000 });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('記録者名を入力してください', { duration: 4000 });
      expect(mockSave).not.toHaveBeenCalled();
    }
  );

  it(
    'should handle select all functionality',
    async () => {
      await renderForm();

      await setRecordDate(FIXED_DATE);
      await waitForTable();

      const clearAllButton = screen.getByLabelText(/選択をクリア/);
      await act(async () => {
      fireEvent.click(clearAllButton);
    });

      const selectAllButton = screen.getByLabelText(/表示中の利用者を全選択/);
      await act(async () => {
        fireEvent.click(selectAllButton);
      });

      await waitForSelectionInfo(FIXED_DATE_SELECTION_COUNT);
    }
  );

  it(
    'should handle clear all functionality',
    { timeout: 15000 },
    async () => {
      await renderForm();

      await setRecordDate(FIXED_DATE);
      await waitForSelectionInfo(FIXED_DATE_SELECTION_COUNT);

      const clearAllButton = screen.getByLabelText(/選択をクリア/);
      await act(async () => {
      fireEvent.click(clearAllButton);
    });

      await waitFor(() => {
        const el = screen.getByTestId('selection-count');
        expect(el).toHaveTextContent('0人選択中');
      });
    }
  );

  describe('Attendance Day Filter', () => {
    it('should show attendance filter button in expanded panel', async () => {
      await renderForm();

      await expandUserPicker();

      // Filter button should be visible with either "通所日のみ" or "全利用者"
      const filterButton = screen.getByText(/^(全利用者|通所日のみ)$/);
      expect(filterButton).toBeInTheDocument();
    });

    it('should toggle filter between attendance day and all users', async () => {
      await renderForm();

      await expandUserPicker();

      const filterButton = screen.getByText(/^(全利用者|通所日のみ)$/);
      const currentText = filterButton.textContent;
    await act(async () => {
      fireEvent.click(filterButton);
    });

      await waitFor(() => {
        if (currentText?.includes('通所日のみ')) {
          expect(filterButton).toHaveTextContent('全利用者');
        } else {
          expect(filterButton).toHaveTextContent('通所日のみ');
        }
      });
    });

    it('should filter users based on attendance days when date is Monday', async () => {
      await renderForm();

      await setRecordDate('2024-01-01');
      await expandUserPicker();

      // Should show 田中太郎 (Monday attendee) and 山田一郎 (no attendance days set)
      const list = withinUserList();
      expect(list.getByText('田中 太郎 (U001)')).toBeInTheDocument();
      expect(list.getByText('山田 一郎 (U003)')).toBeInTheDocument();
      expect(list.queryByText('佐藤 花子 (U002)')).not.toBeInTheDocument();
    });

    it('should filter users based on attendance days when date is Tuesday', async () => {
      await renderForm();

      await setRecordDate('2024-01-02');
      await expandUserPicker();

      // Should show 佐藤花子 (Tuesday attendee) and 山田一郎 (no attendance days set)
      const list = withinUserList();
      expect(list.getByText('佐藤 花子 (U002)')).toBeInTheDocument();
      expect(list.getByText('山田 一郎 (U003)')).toBeInTheDocument();
      expect(list.queryByText('田中 太郎 (U001)')).not.toBeInTheDocument();
    });

    it('should auto-update selected users when date changes with attendance filter on', async () => {
      await renderForm();

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
      await renderForm();

      await expandUserPicker();

      // Disable attendance filter
      const filterButton = screen.getByText(/^(通所日のみ|全利用者)$/);
      if (filterButton.textContent?.includes('通所日のみ')) {
        await act(async () => {
          fireEvent.click(filterButton);
        });
      }

      // Should show all users regardless of attendance days
      const list = withinUserList();
      expect(list.getByText('田中 太郎 (U001)')).toBeInTheDocument();
      expect(list.getByText('佐藤 花子 (U002)')).toBeInTheDocument();
      expect(list.getByText('山田 一郎 (U003)')).toBeInTheDocument();
    });
  });
});

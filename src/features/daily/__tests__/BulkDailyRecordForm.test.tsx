import { TESTIDS } from '@/testids';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkDailyRecordForm } from '../BulkDailyRecordForm';

// Mock useUsers hook
const mockUsers = [
  {
    id: 1,
    userId: 'U001',
    name: '田中 太郎',
    furigana: 'たなか たろう'
  },
  {
    id: 2,
    userId: 'U002',
    name: '佐藤 花子',
    furigana: 'さとう はなこ'
  },
  {
    id: 3,
    userId: 'U003',
    name: '山田 一郎',
    furigana: 'やまだ いちろう'
  }
];

vi.mock('@/stores/useUsers', () => ({
  useUsers: () => ({
    data: mockUsers
  })
}));

describe('BulkDailyRecordForm', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined)
  };

  const rowTestId = (userId: string) => `${TESTIDS['bulk-daily-record-user-row-prefix']}${userId}`;

  const renderForm = (override: Partial<typeof defaultProps> = {}) =>
    render(<BulkDailyRecordForm {...defaultProps} {...override} />);

  const getDialog = () => screen.getByTestId(TESTIDS['bulk-daily-record-form']);
  const getUserList = () => screen.getByTestId(TESTIDS['bulk-daily-record-user-list']);
  const getUserRow = (userId: string) => within(getUserList()).getByTestId(rowTestId(userId));
  const getUserCheckbox = (userId: string) => within(getUserRow(userId)).getByRole('checkbox');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders bulk daily record form when open', () => {
    renderForm();

    expect(getDialog()).toBeInTheDocument();
    expect(screen.getByText('複数利用者支援記録（ケース記録）作成')).toBeInTheDocument();
    expect(screen.getByText('複数の利用者に対して共通の活動記録を効率的に作成できます')).toBeInTheDocument();
  });

  it('keeps the dialog mounted and toggles visibility when closed', async () => {
    const { rerender } = renderForm();

    expect(getDialog()).toBeVisible();

    rerender(<BulkDailyRecordForm {...defaultProps} open={false} />);

    await waitFor(() => {
      expect(getDialog()).toBeInTheDocument();
      expect(getDialog()).not.toBeVisible();
    });
  });

  it('displays all users in the list', () => {
    renderForm();

    const userList = getUserList();
    mockUsers.forEach((user) => {
      expect(within(userList).getByTestId(rowTestId(user.userId))).toHaveTextContent(user.name);
    });
  });

  it('filters users based on search query', async () => {
    const user = userEvent.setup();
    renderForm();

    const searchInput = screen.getByTestId(TESTIDS['bulk-daily-record-search']);
    await user.type(searchInput, '田中');

    const userList = getUserList();
    expect(within(userList).getByText('田中 太郎 (U001)')).toBeInTheDocument();
    expect(within(userList).queryByText('佐藤 花子 (U002)')).not.toBeInTheDocument();
    expect(within(userList).queryByText('山田 一郎 (U003)')).not.toBeInTheDocument();
  });

  it('selects and deselects users', async () => {
    const user = userEvent.setup();
    renderForm();

    const checkbox1 = getUserCheckbox('U001');
    await user.click(checkbox1);
    expect(checkbox1).toBeChecked();
    expect(screen.getByText('1人の利用者が選択されています')).toBeInTheDocument();

    const checkbox2 = getUserCheckbox('U002');
    await user.click(checkbox2);
    expect(checkbox2).toBeChecked();
    expect(screen.getByText('2人の利用者が選択されています')).toBeInTheDocument();

    await user.click(checkbox1);
    expect(checkbox1).not.toBeChecked();
    expect(screen.getByText('1人の利用者が選択されています')).toBeInTheDocument();
  });

  it('adds and removes AM activities', async () => {
    const user = userEvent.setup();
    renderForm();

    const amInput = screen.getByTestId(TESTIDS['bulk-daily-record-activity-input-am']);
    await user.type(amInput, '朝の体操{enter}');

    expect(screen.getByText('朝の体操')).toBeInTheDocument();

    const chip = screen.getByTestId(`${TESTIDS['bulk-daily-record-activity-chip-am']}-0`);
    const deleteButton = within(chip).getByTestId(`${TESTIDS['bulk-daily-record-activity-delete-am']}-0`);
    await user.click(deleteButton);
    expect(screen.queryByText('朝の体操')).not.toBeInTheDocument();
  });

  it('fills reporter information', async () => {
    const user = userEvent.setup();
    renderForm();

    const reporterInput = screen.getByRole('textbox', { name: '記録者名' });
    await user.type(reporterInput, '支援員A');
    expect(reporterInput).toHaveValue('支援員A');
  });

  it('shows individual notes for selected users', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(getUserCheckbox('U001'));

    const notesSection = screen.getByTestId(TESTIDS['bulk-daily-record-individual-notes']);
    expect(notesSection).toBeInTheDocument();
    expect(within(notesSection).getByText('田中 太郎 (U001)')).toBeInTheDocument();
  });

  it('calls onSave with correct data when saved', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<BulkDailyRecordForm {...defaultProps} onSave={mockOnSave} />);

    const reporterInput = screen.getByRole('textbox', { name: '記録者名' });
    await user.type(reporterInput, '支援員A');

    await user.click(getUserCheckbox('U001'));
    await user.click(getUserCheckbox('U002'));

    const amInput = screen.getByTestId(TESTIDS['bulk-daily-record-activity-input-am']);
    await user.type(amInput, '朝の体操{enter}');

    const saveButton = screen.getByRole('button', { name: '2人分保存' });
    await user.click(saveButton);

    await waitFor(() => expect(mockOnSave).toHaveBeenCalledTimes(1));
    const [payload, selectedIds] = mockOnSave.mock.calls[0];
    expect(selectedIds).toEqual(expect.arrayContaining(['U001', 'U002']));
    expect(payload).toMatchObject({
      reporter: { name: '支援員A' },
      commonActivities: { amActivities: ['朝の体操'] }
    });
  });

  it('prevents saving without selected users', async () => {
    const mockOnSave = vi.fn();
    const user = userEvent.setup();

    render(<BulkDailyRecordForm {...defaultProps} onSave={mockOnSave} />);

    const reporterInput = screen.getByRole('textbox', { name: '記録者名' });
    await user.type(reporterInput, '支援員A');

    const saveButton = screen.getByRole('button', { name: '0人分保存' });
    expect(saveButton).toBeDisabled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('prevents saving without reporter name', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const mockOnSave = vi.fn();
    const user = userEvent.setup();

    render(<BulkDailyRecordForm {...defaultProps} onSave={mockOnSave} />);

    await user.click(getUserCheckbox('U001'));
    const saveButton = screen.getByRole('button', { name: '1人分保存' });
    await user.click(saveButton);

    expect(alertSpy).toHaveBeenCalledWith('記録者名を入力してください');
    expect(mockOnSave).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('handles select all functionality', async () => {
    const user = userEvent.setup();
    renderForm();

    const selectAllButton = screen.getByTestId(TESTIDS['bulk-daily-record-select-all']);
    await user.click(selectAllButton);

    expect(screen.getByText('3人の利用者が選択されています')).toBeInTheDocument();
    ['U001', 'U002', 'U003'].forEach((id) => {
      expect(getUserCheckbox(id)).toBeChecked();
    });
  });

  it('handles clear all functionality', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(getUserCheckbox('U001'));
    await user.click(getUserCheckbox('U002'));
    expect(screen.getByText('2人の利用者が選択されています')).toBeInTheDocument();

    const clearAllButton = screen.getByTestId(TESTIDS['bulk-daily-record-clear-all']);
    await user.click(clearAllButton);

    expect(screen.queryByText(/人の利用者が選択されています/)).not.toBeInTheDocument();
    expect(getUserCheckbox('U001')).not.toBeChecked();
    expect(getUserCheckbox('U002')).not.toBeChecked();
  });
});
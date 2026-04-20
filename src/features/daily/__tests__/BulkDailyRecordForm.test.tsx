import { TESTIDS } from '@/testids';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkDailyRecordForm } from '../forms/BulkDailyRecordForm';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock useUsers hook
const mockUsers = [
  {
    Id: 1,
    UserID: 'U001',
    FullName: '田中 太郎',
    Furigana: 'たなか たろう',
    IsActive: true,
    lifecycleStatus: 'active' as const,
  },
  {
    Id: 2,
    UserID: 'U002',
    FullName: '佐藤 花子',
    Furigana: 'さとう はなこ',
    IsActive: true,
    lifecycleStatus: 'active' as const,
  },
  {
    Id: 3,
    UserID: 'U003',
    FullName: '山田 一郎',
    Furigana: 'やまだ いちろう',
    IsActive: true,
    lifecycleStatus: 'active' as const,
  },
];

vi.mock('@/features/users/store', () => ({
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
    expect(screen.getByText('複数利用者日々の記録作成')).toBeInTheDocument();
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
      expect(within(userList).getByTestId(rowTestId(user.UserID))).toHaveTextContent(user.FullName);
    });
  });

  it('filters users based on search query', async () => {
    renderForm();

    const searchInput = screen.getByTestId(TESTIDS['bulk-daily-record-search']);
    fireEvent.change(searchInput, { target: { value: '田中' } });

    const userList = getUserList();
    expect(within(userList).getByText('田中 太郎 (U001)')).toBeInTheDocument();
    expect(within(userList).queryByText('佐藤 花子 (U002)')).not.toBeInTheDocument();
    expect(within(userList).queryByText('山田 一郎 (U003)')).not.toBeInTheDocument();
  });

  it('selects and deselects users', async () => {
    renderForm();

    const checkbox1 = getUserCheckbox('U001');
    fireEvent.click(checkbox1);
    expect(checkbox1).toBeChecked();
    expect(screen.getByText('1人の利用者が選択されています')).toBeInTheDocument();

    const checkbox2 = getUserCheckbox('U002');
    fireEvent.click(checkbox2);
    expect(checkbox2).toBeChecked();
    expect(screen.getByText('2人の利用者が選択されています')).toBeInTheDocument();

    fireEvent.click(checkbox1);
    expect(checkbox1).not.toBeChecked();
    expect(screen.getByText('1人の利用者が選択されています')).toBeInTheDocument();
  });

  it('adds and removes AM activities', async () => {
    renderForm();

    const amInput = screen.getByTestId(TESTIDS['bulk-daily-record-activity-input-am']);
    fireEvent.change(amInput, { target: { value: '朝の体操' } });
    fireEvent.keyPress(amInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(screen.getByText('朝の体操')).toBeInTheDocument();

    const chip = screen.getByTestId(`${TESTIDS['bulk-daily-record-activity-chip-am']}-0`);
    const deleteButton = within(chip).getByTestId(`${TESTIDS['bulk-daily-record-activity-delete-am']}-0`);
    fireEvent.click(deleteButton);
    expect(screen.queryByText('朝の体操')).not.toBeInTheDocument();
  });

  it('fills reporter information', async () => {
    renderForm();

    const reporterInput = screen.getByRole('textbox', { name: '記録者名' });
    fireEvent.change(reporterInput, { target: { value: '支援員A' } });
    expect(reporterInput).toHaveValue('支援員A');
  });

  it('shows individual notes for selected users', async () => {
    renderForm();

    fireEvent.click(getUserCheckbox('U001'));

    const notesSection = screen.getByTestId(TESTIDS['bulk-daily-record-individual-notes']);
    expect(notesSection).toBeInTheDocument();
    expect(within(notesSection).getByText('田中 太郎 (U001)')).toBeInTheDocument();
  });

  it('calls onSave with correct data when saved', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    render(<BulkDailyRecordForm {...defaultProps} onSave={mockOnSave} />);

    const reporterInput = screen.getByRole('textbox', { name: '記録者名' });
    fireEvent.change(reporterInput, { target: { value: '支援員A' } });

    fireEvent.click(getUserCheckbox('U001'));
    fireEvent.click(getUserCheckbox('U002'));

    const amInput = screen.getByTestId(TESTIDS['bulk-daily-record-activity-input-am']);
    fireEvent.change(amInput, { target: { value: '朝の体操' } });
    fireEvent.keyPress(amInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    const saveButton = screen.getByRole('button', { name: '2人分保存' });
    fireEvent.click(saveButton);

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

    render(<BulkDailyRecordForm {...defaultProps} onSave={mockOnSave} />);

    const reporterInput = screen.getByRole('textbox', { name: '記録者名' });
    fireEvent.change(reporterInput, { target: { value: '支援員A' } });

    const saveButton = screen.getByRole('button', { name: '0人分保存' });
    expect(saveButton).toBeDisabled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('prevents saving without reporter name', async () => {
    const mockOnSave = vi.fn();

    render(<BulkDailyRecordForm {...defaultProps} onSave={mockOnSave} />);

    fireEvent.click(getUserCheckbox('U001'));
    const saveButton = screen.getByRole('button', { name: '1人分保存' });
    fireEvent.click(saveButton);

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('記録者名を入力してください', { duration: 4000 });
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('handles select all functionality', async () => {
    renderForm();

    const selectAllButton = screen.getByTestId(TESTIDS['bulk-daily-record-select-all']);
    fireEvent.click(selectAllButton);

    expect(screen.getByText('3人の利用者が選択されています')).toBeInTheDocument();
    ['U001', 'U002', 'U003'].forEach((id) => {
      expect(getUserCheckbox(id)).toBeChecked();
    });
  });

  it('handles clear all functionality', async () => {
    renderForm();

    fireEvent.click(getUserCheckbox('U001'));
    fireEvent.click(getUserCheckbox('U002'));
    expect(screen.getByText('2人の利用者が選択されています')).toBeInTheDocument();

    const clearAllButton = screen.getByTestId(TESTIDS['bulk-daily-record-clear-all']);
    fireEvent.click(clearAllButton);

    expect(screen.queryByText(/人の利用者が選択されています/)).not.toBeInTheDocument();
    expect(getUserCheckbox('U001')).not.toBeChecked();
    expect(getUserCheckbox('U002')).not.toBeChecked();
  });
});

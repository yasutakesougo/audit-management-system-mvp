import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { DailySupportUserFilter } from '@/features/daily/hooks/useDailySupportUserFilter';
import type { IUserMaster } from '@/features/users/types';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock hook
const mockUseUserSelectionStepData = vi.fn();
vi.mock('../wizard/hooks/useUserSelectionStepData', () => ({
  useUserSelectionStepData: () => mockUseUserSelectionStepData(),
}));

import { UserSelectionStep } from '../wizard/UserSelectionStep';

describe('UserSelectionStep', () => {
  const dummyUsers: IUserMaster[] = [
    {
      Id: 1,
      UserID: 'U001',
      FullName: '利用者 一郎',
      DisabilitySupportLevel: '区分3',
      IsHighIntensitySupportTarget: false,
      BehaviorScore: 5,
      ServiceStartDate: '2026-01-01',
      UsageStatus: 'active',
    },
    {
      Id: 2,
      UserID: 'U002',
      FullName: '利用者 二郎',
      DisabilitySupportLevel: '区分6',
      IsHighIntensitySupportTarget: true,
      BehaviorScore: 12,
      ServiceStartDate: '2026-01-01',
      UsageStatus: 'active',
    },
  ];

  const defaultFilter: DailySupportUserFilter = {
    supportLevel: '',
    usageStatus: '',
    highIntensityOnly: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserSelectionStepData.mockReturnValue({
      abcSummary: {
        todayCounts: new Map(),
        latestDates: new Map(),
      },
      planningSheets: new Map(),
    });
  });

  it('利用者リストが正しく表示されること（強度行動障害対象者、行動関連点数が上位にソートされる）', () => {
    render(
      <UserSelectionStep
        filteredUsers={dummyUsers}
        allUsersCount={2}
        filter={defaultFilter}
        hasActiveFilter={false}
        onUpdateFilter={vi.fn()}
        onResetFilter={vi.fn()}
        onSelectUser={vi.fn()}
      />,
    );

    // ソート順の確認: 強度行動障害対象の U002 が先頭に来るはず
    const userCards = screen.getAllByTestId(/wizard-user-card-/);
    expect(userCards[0]).toHaveAttribute('data-testid', 'wizard-user-card-U002');
    expect(userCards[1]).toHaveAttribute('data-testid', 'wizard-user-card-U001');

    expect(screen.getByText('利用者 二郎')).toBeInTheDocument();
    expect(screen.getByText('行動関連12点')).toBeInTheDocument();

    // 複数マッチするため getAllByText を使用
    const highIntensityLabels = screen.getAllByText('強度行動障害');
    expect(highIntensityLabels.length).toBeGreaterThan(0);

    expect(screen.getByText('利用者 一郎')).toBeInTheDocument();
    expect(screen.getByText('行動関連5点')).toBeInTheDocument();
  });

  it('計画未作成の場合に警告チップが表示されること', () => {
    // planningSheets に user-A が含まれていない場合、計画未作成チップが表示される
    render(
      <UserSelectionStep
        filteredUsers={dummyUsers}
        allUsersCount={2}
        filter={defaultFilter}
        hasActiveFilter={false}
        onUpdateFilter={vi.fn()}
        onResetFilter={vi.fn()}
        onSelectUser={vi.fn()}
      />,
    );

    expect(screen.getAllByText('計画未作成')).toHaveLength(2);
  });

  it('今日の ABC 記録がある場合に ABC 件数チップが表示されること', () => {
    const todayCounts = new Map<string, number>();
    todayCounts.set('U001', 3);

    mockUseUserSelectionStepData.mockReturnValue({
      abcSummary: {
        todayCounts,
        latestDates: new Map(),
      },
      planningSheets: new Map([
        ['U001', {} as unknown as SupportPlanningSheet],
        ['U002', {} as unknown as SupportPlanningSheet],
      ]),
    });

    render(
      <UserSelectionStep
        filteredUsers={dummyUsers}
        allUsersCount={2}
        filter={defaultFilter}
        hasActiveFilter={false}
        onUpdateFilter={vi.fn()}
        onResetFilter={vi.fn()}
        onSelectUser={vi.fn()}
      />,
    );

    expect(screen.getByText('ABC 3件')).toBeInTheDocument();
  });

  it('カードをクリックした時に onSelectUser が正しくトリガーされること', () => {
    const handleSelectUser = vi.fn();

    render(
      <UserSelectionStep
        filteredUsers={dummyUsers}
        allUsersCount={2}
        filter={defaultFilter}
        hasActiveFilter={false}
        onUpdateFilter={vi.fn()}
        onResetFilter={vi.fn()}
        onSelectUser={handleSelectUser}
      />,
    );

    const card = screen.getByTestId('wizard-user-card-U001');
    fireEvent.click(card);

    expect(handleSelectUser).toHaveBeenCalledWith('U001');
  });

  it('フィルター操作で onUpdateFilter がトリガーされること', () => {
    const handleUpdateFilter = vi.fn();

    render(
      <UserSelectionStep
        filteredUsers={dummyUsers}
        allUsersCount={2}
        filter={defaultFilter}
        hasActiveFilter={false}
        onUpdateFilter={handleUpdateFilter}
        onResetFilter={vi.fn()}
        onSelectUser={vi.fn()}
      />,
    );

    // 強度行動障害のトグルボタンをロールを指定して取得
    const toggleButton = screen.getByRole('button', { name: '強度行動障害支援対象者のみ表示' });
    fireEvent.click(toggleButton);

    expect(handleUpdateFilter).toHaveBeenCalledWith({ highIntensityOnly: true });
  });
});

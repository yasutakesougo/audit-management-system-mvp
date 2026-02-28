import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// DailyRecordMenuPage — 回帰防止テスト
//
// 「件数表示が出る」「モック % が出ない」をガードする最小テスト。
// ---------------------------------------------------------------------------

// Mock react-router-dom
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams('');

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}));

// Mock useAttendanceStore
vi.mock('@/features/attendance/store', () => ({
  useAttendanceStore: () => ({ visits: {} }),
}));

// Mock useUsersDemo with IsSupportProcedureTarget users
vi.mock('@/features/users/usersStoreDemo', () => ({
  useUsersDemo: () => ({
    data: [
      { Id: 1, UserID: 'U001', DisplayName: 'テスト太郎', IsSupportProcedureTarget: false },
      { Id: 2, UserID: 'U002', DisplayName: 'テスト花子', IsSupportProcedureTarget: true },
      { Id: 3, UserID: 'U003', DisplayName: 'テスト次郎', IsSupportProcedureTarget: true },
    ],
  }),
}));

// Suppress MUI container warnings
vi.mock('@mui/material/Container', () => ({
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
}));

import DailyRecordMenuPage from '@/pages/DailyRecordMenuPage';

describe('DailyRecordMenuPage — 統計パネル回帰防止', () => {
  it('件数表示（件）がレンダされる', () => {
    render(<DailyRecordMenuPage />);

    const statsPanel = screen.getByTestId('daily-stats-summary');

    // "件" 表記が統計パネル内に存在する
    expect(statsPanel.textContent).toMatch(/\d+件/);
  });

  it('モック % 表示が存在しない', () => {
    render(<DailyRecordMenuPage />);

    const statsPanel = screen.getByTestId('daily-stats-summary');

    // "% 完了" が統計パネル内に無い
    expect(statsPanel.textContent).not.toContain('% 完了');
  });

  it('件数ラベルが正しい', () => {
    render(<DailyRecordMenuPage />);

    const statsPanel = screen.getByTestId('daily-stats-summary');

    expect(statsPanel.textContent).toContain('未入力');
    expect(statsPanel.textContent).toContain('要確認');
    expect(statsPanel.textContent).toContain('未記入');
  });

  it('data-testid が各セクションに存在する', () => {
    render(<DailyRecordMenuPage />);

    expect(screen.getByTestId('daily-stats-activity')).toBeInTheDocument();
    expect(screen.getByTestId('daily-stats-attendance')).toBeInTheDocument();
    expect(screen.getByTestId('daily-stats-support')).toBeInTheDocument();
  });
});

describe('DailyRecordMenuPage — /today からの戻り導線', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('from=today のとき「今日の運用へ戻る」ボタンが表示される', () => {
    mockSearchParams = new URLSearchParams('from=today&date=2026-02-28');
    render(<DailyRecordMenuPage />);

    const returnBtn = screen.getByTestId('daily-hub-return-today');
    expect(returnBtn).toBeInTheDocument();
    expect(returnBtn.textContent).toContain('今日の運用へ戻る');
  });

  it('戻るボタンをクリックすると /today に navigate する', () => {
    mockSearchParams = new URLSearchParams('from=today&date=2026-02-28');
    render(<DailyRecordMenuPage />);

    const returnBtn = screen.getByTestId('daily-hub-return-today');
    fireEvent.click(returnBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/today?date=2026-02-28');
  });

  it('from が無いとき戻るボタンは表示されない', () => {
    mockSearchParams = new URLSearchParams('');
    render(<DailyRecordMenuPage />);

    expect(screen.queryByTestId('daily-hub-return-today')).not.toBeInTheDocument();
  });
});

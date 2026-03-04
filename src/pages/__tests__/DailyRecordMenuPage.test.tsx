import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// DailyRecordMenuPage — 回帰防止テスト
//
// Phase 1 リファクタ後:
//   - KPI は CommandBar に移動（data-testid="bento-command-bar"）
//   - ヘッダーはコンパクト化（日付ラベル付き）
//   - カード data-testid は維持
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

describe('DailyRecordMenuPage — CommandBar KPI 回帰防止', () => {
  it('CommandBar がレンダされる', () => {
    render(<DailyRecordMenuPage />);

    const commandBar = screen.getByTestId('bento-command-bar');
    expect(commandBar).toBeInTheDocument();
  });

  it('CommandBar 内に件数表示が含まれる', () => {
    render(<DailyRecordMenuPage />);

    const commandBar = screen.getByTestId('bento-command-bar');
    // 「件」表記がコマンドバー内に存在する
    expect(commandBar.textContent).toMatch(/\d+件/);
  });

  it('メニューカードの data-testid が存在する', () => {
    render(<DailyRecordMenuPage />);

    expect(screen.getByTestId('daily-card-table-activity')).toBeInTheDocument();
    expect(screen.getByTestId('daily-card-attendance')).toBeInTheDocument();
    expect(screen.getByTestId('daily-card-support')).toBeInTheDocument();
  });

  it('ヘッダーに日次記録タイトルがある', () => {
    render(<DailyRecordMenuPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('日次記録');
  });
});

describe('DailyRecordMenuPage — /today からの戻り導線', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('from=today のとき戻るボタンが表示される', () => {
    mockSearchParams = new URLSearchParams('from=today&date=2026-02-28');
    render(<DailyRecordMenuPage />);

    const returnBtn = screen.getByTestId('daily-hub-return-today');
    expect(returnBtn).toBeInTheDocument();
    expect(returnBtn.textContent).toContain('今日の運用へ');
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

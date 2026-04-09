import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DailyRecordMenuPage from '@/pages/DailyRecordMenuPage';

// ---------------------------------------------------------------------------
// DailyRecordMenuPage — Regression Tests
// ---------------------------------------------------------------------------

// Mock Hooks
vi.mock('@/features/users/hooks/useUsers', () => ({
  useUsers: () => ({
    data: [
      { Id: 1, UserID: 'U001', DisplayName: 'テスト太郎', IsSupportProcedureTarget: false },
      { Id: 2, UserID: 'U002', DisplayName: 'テスト花子', IsSupportProcedureTarget: true },
    ],
    loading: false,
  }),
}));

vi.mock('@/features/safety/hooks/useSafetyOperationsSummary', () => ({
  useSafetyOperationsSummary: () => ({
    summary: {
      overallLevel: 'good',
      actionRequiredCount: 0,
      alerts: [],
    },
    loading: false,
  }),
}));

vi.mock('@/features/attendance/store', () => ({
  useAttendanceStore: () => ({
    visits: {},
  }),
}));

// Mock Components
vi.mock('@/features/dashboard/components/CommandBar', () => ({
  CommandBar: ({ children }: any) => <div data-testid="bento-command-bar">{children}</div>,
}));

// Mock Navigate & SearchParams
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams('');

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as any;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

describe('DailyRecordMenuPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('');
  });

  it('正常にレンダリングされること', () => {
    render(
      <MemoryRouter>
        <DailyRecordMenuPage />
      </MemoryRouter>
    );

    // ヘッダーに日々の記録タイトルがある
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('日々の記録');
    // CommandBar が表示されていること
    expect(screen.getByTestId('bento-command-bar')).toBeInTheDocument();
  });

  it('メニューカードの data-testid が存在すること', () => {
    render(
      <MemoryRouter>
        <DailyRecordMenuPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('daily-card-table-activity')).toBeInTheDocument();
    expect(screen.getByTestId('daily-card-attendance')).toBeInTheDocument();
    expect(screen.getByTestId('daily-card-support')).toBeInTheDocument();
  });

  it('from=today のとき戻るボタンが表示され、クリックで遷移すること', () => {
    mockSearchParams = new URLSearchParams('from=today&date=2026-04-01');
    render(
      <MemoryRouter>
        <DailyRecordMenuPage />
      </MemoryRouter>
    );

    const returnBtn = screen.getByTestId('daily-hub-return-today');
    expect(returnBtn).toBeInTheDocument();
    expect(returnBtn.textContent).toContain('今日の運用へ');

    fireEvent.click(returnBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/today?date=2026-04-01');
  });

  it('from が無いとき戻るボタンは表示されない', () => {
    mockSearchParams = new URLSearchParams('');
    render(
      <MemoryRouter>
        <DailyRecordMenuPage />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('daily-hub-return-today')).not.toBeInTheDocument();
  });
});

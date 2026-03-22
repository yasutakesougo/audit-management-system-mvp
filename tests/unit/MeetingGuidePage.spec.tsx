import MeetingGuidePage from '@/pages/MeetingGuidePage';
import { TESTIDS } from '@/testids';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/handoff/HandoffSummaryForMeeting', () => ({
  default: () => null,
}));

vi.mock('@/features/handoff/RegulatoryFindingsForMeeting', () => ({
  default: () => null,
}));

vi.mock('@/features/meeting/useCurrentMeeting', () => ({
  useCurrentMeeting: () => ({
    sessionKey: '2026-03-22_morning',
    kind: 'morning',
    session: null,
    steps: [
      {
        id: 1,
        title: 'Safety HUD 確認',
        description: '今日の安全インジケーター・予定の重なり状況',
        completed: false,
        timeSpent: 0,
      },
    ],
    stats: {
      totalCount: 1,
      completedCount: 0,
      progressPercentage: 0,
    },
    toggleStep: vi.fn(),
    priorityUsers: [],
    handoffAlert: {
      criticalCount: 0,
      totalActiveCount: 0,
      hasAlerts: false,
    },
    loading: false,
    error: null,
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithRouter = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/meeting-guide']}>
        <MeetingGuidePage />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('MeetingGuidePage', () => {
  it('renders meeting guide page with tab interface', () => {
    renderWithRouter();

    // ページタイトルの確認
    expect(screen.getByText('朝会・夕会 進行ガイド')).toBeInTheDocument();
    expect(screen.getByText('司会者用')).toBeInTheDocument();

    // 説明文の確認
    expect(screen.getByText(/このページは、朝会・夕会の進行をサポートするための/)).toBeInTheDocument();

    // タブの確認
    expect(screen.getByRole('tab', { name: /朝会（始業前）/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /夕会（終業前）/ })).toBeInTheDocument();

    // デフォルトで朝会タブが選択されているかどうか
    const [morningCard] = screen.getAllByTestId(TESTIDS['meeting-guide-morning']);
    expect(
      within(morningCard).getByRole('heading', { name: /朝会進行ステップ/ })
    ).toBeVisible();

    // 重点フォロー欄の確認
    expect(screen.getByText('🎯 今日の重点フォロー')).toBeInTheDocument();

    // チェックリストリセットボタンの確認
    const clearButton = within(morningCard).getByRole('button', {
      name: 'チェックを全てクリア'
    });
    expect(clearButton).toBeVisible();
  });

  it('displays morning steps by default', () => {
    renderWithRouter();

    // 朝会のフッターテキストが表示されるか確認
    const [checklist] = screen.getAllByTestId(TESTIDS['meeting-guide-checklist']);
    expect(within(checklist).getByText('Safety HUD 確認')).toBeInTheDocument();
  });
});

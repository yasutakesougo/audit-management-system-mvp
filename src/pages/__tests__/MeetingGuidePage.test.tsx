import { TESTIDS } from '@/testids';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MeetingGuidePage from '../MeetingGuidePage';

vi.mock('@/features/handoff/HandoffSummaryForMeeting', () => ({
  default: () => <div data-testid="handoff-summary-stub" />,
}));

vi.mock('@/features/handoff/RegulatoryFindingsForMeeting', () => ({
  default: () => <div data-testid="regulatory-findings-stub" />,
}));

vi.mock('@/features/meeting/useCurrentMeeting', () => ({
  useCurrentMeeting: vi.fn((kind: 'morning' | 'evening') => ({
    sessionKey: `2026-03-21_${kind}`,
    session: {
      sessionKey: `2026-03-21_${kind}`,
      createdAt: '2026-03-21T09:00:00.000Z',
      updatedAt: '2026-03-21T09:30:00.000Z',
    },
    steps: [
      { id: `${kind}-1`, title: 'Safety HUD 確認', completed: false },
      { id: `${kind}-2`, title: '引き継ぎ要点確認', completed: true },
    ],
    stats: {
      completedCount: 1,
      totalCount: 2,
    },
    toggleStep: vi.fn(async () => {}),
    priorityUsers: [],
    handoffAlert: null,
    loading: false,
    error: null,
  })),
}));

const theme = createTheme({
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true,
      },
    },
  },
});
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/meeting-guide']}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {component}
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MeetingGuidePage', () => {
  it('Phase 3統合：useMeetingSteps hook とMeetingStepsChecklistが正常に動作する', () => {
    renderWithProviders(<MeetingGuidePage />);

    // ページタイトルが表示される
    expect(screen.getByText('朝会・夕会 進行ガイド')).toBeInTheDocument();
    expect(screen.getByText('司会者用')).toBeInTheDocument();

    // 説明テキストが表示される
    expect(screen.getByText(/このページは、朝会・夕会の進行をサポートするための/)).toBeInTheDocument();

    // タブが表示される
    expect(screen.getByText(/🌅 朝会（始業前）/)).toBeInTheDocument();
    expect(screen.getByText(/🌆 夕会（終業前）/)).toBeInTheDocument();

    // 重点フォロー部分が表示される
    expect(screen.getByText('🎯 今日の重点フォロー')).toBeInTheDocument();

    // 進行ステップ部分が表示される（within朝会カード）
    const [morningCard] = screen.getAllByTestId(TESTIDS['meeting-guide-morning']);
    expect(
      within(morningCard).getByRole('heading', { name: /朝会進行ステップ/ })
    ).toBeVisible();
    expect(
      within(morningCard).getByRole('button', { name: 'チェックを全てクリア' })
    ).toBeVisible();
  });

  it('朝会・夕会タブの切り替えが動作する', () => {
    renderWithProviders(<MeetingGuidePage />);

    // 初期状態は朝会
    const [morningCard] = screen.getAllByTestId(TESTIDS['meeting-guide-morning']);
    expect(
      within(morningCard).getByRole('heading', { name: /朝会進行ステップ/ })
    ).toBeVisible();

    // 夕会タブをクリック
    const [eveningTab] = screen.getAllByRole('tab', { name: /夕会（終業前）/ });
    fireEvent.click(eveningTab);

    // 夕会進行ステップに切り替わる
    const [eveningCard] = screen.getAllByTestId(TESTIDS['meeting-guide-evening']);
    expect(
      within(eveningCard).getByRole('heading', { name: /夕会進行ステップ/ })
    ).toBeVisible();
  });

  it('チェックを全てクリアボタンが動作する', () => {
    renderWithProviders(<MeetingGuidePage />);

    // チェックを全てクリアボタンが存在する
    const [morningCard] = screen.getAllByTestId(TESTIDS['meeting-guide-morning']);
    const clearButton = within(morningCard).getByRole('button', { name: 'チェックを全てクリア' });
    expect(clearButton).toBeInTheDocument();

    // ボタンがクリック可能
    fireEvent.click(clearButton);
    // エラーが発生しないことを確認（正常に動作）
  });

  it('useMeetingSteps hookからのstepsデータが表示される', () => {
    renderWithProviders(<MeetingGuidePage />);

    // MeetingStepsChecklistコンポーネントが描画される
    // （具体的なステップ内容は meetingSteps.ts から来るので、少なくとも構造は確認）
    const [checklist] = screen.getAllByTestId(TESTIDS['meeting-guide-checklist']);
    expect(within(checklist).getByText('Safety HUD 確認')).toBeInTheDocument();
  });
});

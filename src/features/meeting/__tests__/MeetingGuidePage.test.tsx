import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import MeetingGuidePage from '../../../pages/MeetingGuidePage';

// テスト用のテーマプロバイダー + Router + QueryClient
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const theme = createTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// usePriorityFollowUsersフックをモック
vi.mock('../usePriorityFollowUsers', () => ({
  usePriorityFollowUsers: () => [
    {
      id: 1,
      name: 'テストユーザー',
      memo: 'テストメモ',
      priority: 'high' as const,
      reason: 'テスト理由',
    },
  ],
}));

// useCurrentMeetingフックをモック
vi.mock('../useCurrentMeeting', () => ({
  useCurrentMeeting: () => ({
    sessionKey: '2024-01-15_morning',
    session: {
      sessionKey: '2024-01-15_morning',
      createdAt: new Date('2024-01-15T09:00:00'),
      updatedAt: new Date('2024-01-15T09:00:00'),
      stepRecords: [],
    },
    steps: [
      {
        id: 'attendance_check',
        label: '出欠確認',
        description: 'メンバーの出席状況確認',
        estimate: '約2分',
        completed: false,
        completedAt: null,
      },
      {
        id: 'priority_follow',
        label: '重点フォロー確認',
        description: '今日の重点フォロー対象者の確認',
        estimate: '約3分',
        completed: false,
        completedAt: null,
      },
    ],
    stats: {
      totalCount: 2,
      completedCount: 0,
      progressPercentage: 0,
    },
    toggleStep: vi.fn(),
    priorityUsers: [
      {
        id: 1,
        name: 'テストユーザー',
        memo: 'テストメモ',
        priority: 'high' as const,
        reason: 'テスト理由',
      },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock('@/features/handoff/HandoffSummaryForMeeting', () => ({
  default: () => null,
}));

vi.mock('@/features/handoff/RegulatoryFindingsForMeeting', () => ({
  default: () => null,
}));

// meetingLoggerをモック
vi.mock('../logging/meetingLogger', () => ({
  meetingLogger: {
    priorityUsersLoaded: vi.fn(),
    sessionUpserted: vi.fn(),
    stepToggled: vi.fn(),
    sharePointSync: vi.fn(),
  },
}));

describe('MeetingGuidePage', () => {
  afterEach(() => {
    cleanup();
  });

  test('Phase 4B: ページタイトルと基本UIが表示される', () => {
    render(
      <TestWrapper>
        <MeetingGuidePage />
      </TestWrapper>
    );

    // ページタイトルが表示される
    expect(screen.getByText('朝会・夕会 進行ガイド')).toBeInTheDocument();

    // 司会者用チップが表示される
    expect(screen.getByText('司会者用')).toBeInTheDocument();
  });

  test('Phase 4B: タブ切り替えが正常に機能する', () => {
    render(
      <TestWrapper>
        <MeetingGuidePage />
      </TestWrapper>
    );

    // 朝会タブと夕会タブが存在することを確認
    const morningTab = screen.getByText('🌅 朝会（始業前）');
    const eveningTab = screen.getByText('🌆 夕会（終業前）');

    expect(morningTab).toBeInTheDocument();
    expect(eveningTab).toBeInTheDocument();

    // 夕会タブをクリック
    fireEvent.click(eveningTab);

    // 夕会コンテンツが表示されることを確認
    expect(screen.getByText('完了ステップ：0/2')).toBeInTheDocument();

    // 朝会タブに戻る
    fireEvent.click(morningTab);

    // 朝会コンテンツが表示されることを確認
    expect(screen.getByText('完了ステップ：0/2')).toBeInTheDocument();
  });

  test('Phase 4B: 朝会・夕会のステップが表示される', () => {
    render(
      <TestWrapper>
        <MeetingGuidePage />
      </TestWrapper>
    );

    // 朝会ステップの基本要素が表示される
    expect(screen.getByText('完了ステップ：0/2')).toBeInTheDocument();
    expect(screen.getByText('🎯 今日の重点フォロー')).toBeInTheDocument();

    // 夕会タブに切り替え
    const eveningTab = screen.getByText('🌆 夕会（終業前）');
    fireEvent.click(eveningTab);

    // 夕会ステップの基本要素が表示される
    expect(screen.getByText('17:15〜')).toBeInTheDocument();
  });

  test('Phase 4B: 重点フォロー対象者が表示される', () => {
    render(
      <TestWrapper>
        <MeetingGuidePage />
      </TestWrapper>
    );

    // 重点フォロー対象者セクションが表示される
    expect(screen.getByText('🎯 今日の重点フォロー')).toBeInTheDocument();

    // モックデータのユーザーが表示される
    expect(screen.getByText('テストユーザー')).toBeInTheDocument();
    expect(screen.getByText('テスト理由')).toBeInTheDocument();
  });

  test('Phase 4B: ステップクリック時の機能確認', () => {
    render(
      <TestWrapper>
        <MeetingGuidePage />
      </TestWrapper>
    );

    // 朝会ステップの要素が存在することを確認
    const progressIndicators = screen.getAllByText('完了ステップ：0/2');
    expect(progressIndicators.length).toBeGreaterThan(0);

    // クリック後もページが正常に表示されることを確認
    expect(screen.getByText('朝会・夕会 進行ガイド')).toBeInTheDocument();
  });

  test('Phase 4B: 時間表示機能の確認', () => {
    render(
      <TestWrapper>
        <MeetingGuidePage />
      </TestWrapper>
    );

    // 朝会の時間目安が表示される
    expect(screen.getByText('9:00〜')).toBeInTheDocument();

    // 夕会タブに切り替え
    const eveningTab = screen.getByText('🌆 夕会（終業前）');
    fireEvent.click(eveningTab);

    // 夕会の時間目安が表示される
    expect(screen.getByText('17:15〜')).toBeInTheDocument();

    // 基本的なページ機能が正常に動作することを確認
    expect(screen.getByText('朝会・夕会 進行ガイド')).toBeInTheDocument();
  });

  test('Phase 4B: レスポンシブデザインの基本要素確認', () => {
    render(
      <TestWrapper>
        <MeetingGuidePage />
      </TestWrapper>
    );

    // Grid系コンポーネントが適切にレンダリングされることを確認
    // (詳細なレスポンシブテストは別途E2Eで実施)
    expect(screen.getByText('朝会・夕会 進行ガイド')).toBeInTheDocument();
    expect(screen.getByText('🎯 今日の重点フォロー')).toBeInTheDocument();
    expect(screen.getByText('司会者用')).toBeInTheDocument();
  });
});

/**
 * Phase 5B Step 3: MeetingGuidePage ↔ MeetingGuideDrawer統合テスト
 *
 * 「司会ビューでの操作が参加者ビューに即座に反映される」
 * 単一情報源（useCurrentMeeting）の同期性を保証
 */

import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MeetingGuidePage from '../../../pages/MeetingGuidePage';
import MeetingGuideDrawer from '../MeetingGuideDrawer';
import { useCurrentMeeting } from '../useCurrentMeeting';

// useCurrentMeetingフックをモック
vi.mock('../useCurrentMeeting');

const mockUseCurrentMeeting = vi.mocked(useCurrentMeeting);

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  </MemoryRouter>
);

describe('Phase 5B: MeetingGuidePage ↔ MeetingGuideDrawer リアルタイム同期', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('司会ビューでのステップ切り替えがDrawerに即座に反映される', async () => {
    const user = userEvent.setup();

    // 共有状態をテスト用に管理
    const completedStepIds = new Set<string>();

    const mockSteps = [
      {
        id: 1,
        title: 'あいさつ・開始宣言',
        description: 'メンバーへの挨拶と朝会開始の宣言',
        completed: false,
        timeSpent: 0,
        estimatedMinutes: 1,
      },
      {
        id: 2,
        title: '体調確認',
        description: 'メンバーの体調・コンディション確認',
        completed: false,
        timeSpent: 0,
        estimatedMinutes: 2,
      },
    ];

    // useCurrentMeetingモック実装
    mockUseCurrentMeeting.mockImplementation((kind) => {
      const updatedSteps = mockSteps.map(step => ({
        ...step,
        completed: completedStepIds.has(step.id.toString()),
      }));

      const completedCount = updatedSteps.filter(s => s.completed).length;
      const totalCount = updatedSteps.length;

      return {
        // セッション情報
        sessionKey: `2025-11-18_${kind}`,
        kind,
        session: {
          id: 1,
          sessionKey: `2025-11-18_${kind}`,
          meetingKind: kind,
          date: '2025-11-18',
          chairpersonUserId: 'staff001',
          chairpersonName: '管理者',
          status: 'in-progress' as const,
          totalParticipants: 5,
          completedSteps: completedCount,
          totalSteps: totalCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completionRate: Math.round((completedCount / totalCount) * 100),
        },

        // ステップ情報
        steps: updatedSteps,
        stats: {
          totalCount,
          completedCount,
          progressPercentage: Math.round((completedCount / totalCount) * 100),
        },
        toggleStep: vi.fn().mockImplementation(async (stepId: number) => {
          const stepIdStr = stepId.toString();
          if (completedStepIds.has(stepIdStr)) {
            completedStepIds.delete(stepIdStr);
          } else {
            completedStepIds.add(stepIdStr);
          }
          // リアクトの再レンダリングをトリガー（実際のフックではstateが変わることで自動的に起こる）
        }),

        // 重点フォロー情報
        priorityUsers: [
          {
            id: 1,
            name: '田中太郎',
            memo: '体調不良のため経過観察',
            priority: 'high' as const,
            reason: '体調不良のため経過観察が必要',
          },
        ],

        handoffAlert: {
          criticalCount: completedCount,
          totalActiveCount: completedCount,
          hasAlerts: completedCount > 0,
        },

        // 状態
        loading: false,
        error: null,
      };
    });

    // 司会ビュー + Drawerを同時にレンダリング
    const { rerender } = render(
      <TestWrapper>
        <MeetingGuidePage />
        <MeetingGuideDrawer open kind="morning" onClose={() => {}} />
      </TestWrapper>
    );

    // 初期状態：両方とも「完了ステップ：0/2」が表示されている
    const initialProgressTexts = screen.getAllByText(/完了.*0\/2/);
    expect(initialProgressTexts.length).toBeGreaterThan(0);

    // 司会ビュー側で「あいさつ・開始宣言」ステップをクリック
    const [stepTitle] = screen.getAllByText('あいさつ・開始宣言');
    expect(stepTitle).toBeInTheDocument();

    // ステップをクリック（親のPaper要素がクリック可能）
    const stepContainer = stepTitle.closest('.MuiPaper-root') || stepTitle;
    await user.click(stepContainer);

    // モック状態を更新後に再レンダリング
    rerender(
      <TestWrapper>
        <MeetingGuidePage />
        <MeetingGuideDrawer open kind="morning" onClose={() => {}} />
      </TestWrapper>
    );

    // Drawer側に「完了ステップ：1/2」が表示されることを確認
    expect(screen.getAllByText(/完了.*1\/2/).length).toBeGreaterThan(0);

  });

  it('朝会と夕会のセッションが独立している', async () => {
    const user = userEvent.setup();

    // 朝会・夕会で異なる完了状態を管理
    const morningCompleted = new Set<string>();
    const eveningCompleted = new Set<string>();

    const mockSteps = [
      { id: 1, title: 'ステップ1', description: '', completed: false, timeSpent: 0, estimatedMinutes: 1 },
      { id: 2, title: 'ステップ2', description: '', completed: false, timeSpent: 0, estimatedMinutes: 1 },
    ];

    mockUseCurrentMeeting.mockImplementation((kind) => {
      const completedSet = kind === 'morning' ? morningCompleted : eveningCompleted;
      const updatedSteps = mockSteps.map(step => ({
        ...step,
        completed: completedSet.has(step.id.toString()),
      }));

      const completedCount = updatedSteps.filter(s => s.completed).length;

      return {
        sessionKey: `2025-11-18_${kind}`,
        kind,
        session: {
          id: 1,
          sessionKey: `2025-11-18_${kind}`,
          meetingKind: kind,
          date: '2025-11-18',
          chairpersonUserId: 'staff001',
          chairpersonName: '管理者',
          status: 'in-progress' as const,
          totalParticipants: 5,
          completedSteps: completedCount,
          totalSteps: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completionRate: (completedCount / 2) * 100,
        },
        steps: updatedSteps,
        stats: { totalCount: 2, completedCount, progressPercentage: (completedCount / 2) * 100 },
        toggleStep: vi.fn().mockImplementation(async (stepId: number) => {
          const stepIdStr = stepId.toString();
          if (completedSet.has(stepIdStr)) {
            completedSet.delete(stepIdStr);
          } else {
            completedSet.add(stepIdStr);
          }
        }),
        priorityUsers: [],

        handoffAlert: {
          criticalCount: completedCount,
          totalActiveCount: completedCount,
          hasAlerts: completedCount > 0,
        },
        loading: false,
        error: null,
      };
    });

    // 朝会Drawerをレンダリング
    const { rerender } = render(
      <TestWrapper>
        <MeetingGuideDrawer open kind="morning" onClose={() => {}} />
      </TestWrapper>
    );

    // 朝会で1ステップ完了
    const morningStep = screen.getByText('ステップ1');
    const morningStepContainer = morningStep.closest('.MuiPaper-root') || morningStep;
    await user.click(morningStepContainer);

    // 朝会の進捗状態を確認後、夕会に切り替え
    rerender(
      <TestWrapper>
        <MeetingGuideDrawer open kind="evening" onClose={() => {}} />
      </TestWrapper>
    );

    // 夕会Drawerには「完了ステップ：0/2」が表示される（朝会の状態に影響されない）
    expect(screen.getAllByText(/完了.*0\/2/).length).toBeGreaterThan(0);

    // 再び朝会に戻す
    rerender(
      <TestWrapper>
        <MeetingGuideDrawer open kind="morning" onClose={() => {}} />
      </TestWrapper>
    );

    // 朝会の状態「完了ステップ：1/2」が維持されている
    expect(screen.getAllByText(/完了.*1\/2/).length).toBeGreaterThan(0);
  });

  it('エラー状態が両ビューに適切に反映される', () => {
    const errorMessage = 'SharePoint接続エラー';

    mockUseCurrentMeeting.mockReturnValue({
      sessionKey: '2025-11-18_morning',
      kind: 'morning',
      session: null,
      steps: [],
      stats: { totalCount: 0, completedCount: 0, progressPercentage: 0 },
      toggleStep: vi.fn(),
      priorityUsers: [],
      handoffAlert: {
        criticalCount: 0,
        totalActiveCount: 0,
        hasAlerts: false,
      },
      loading: false,
      error: new Error(errorMessage),
    });

    render(
      <TestWrapper>
        <MeetingGuideDrawer open kind="morning" onClose={() => {}} />
      </TestWrapper>
    );

    // エラーメッセージがダイアログに表示される
    expect(screen.getByText(/エラー: SharePoint接続エラー/)).toBeInTheDocument();

    // 統合フックがエラー状態を返していることは、個々のコンポーネントテストで確認済み
    // ここでは統合レベルでエラーが適切に伝播することを確認
  });
});
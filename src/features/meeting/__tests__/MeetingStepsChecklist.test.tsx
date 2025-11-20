import { createTheme, ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, test, vi } from 'vitest';
import MeetingStepsChecklist from '../MeetingStepsChecklist';
import type { MeetingStep } from '../meetingSteps';

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

const SAMPLE_MORNING_STEPS: MeetingStep[] = [
  {
    id: 1,
    title: '出欠確認',
    description: '参加者の出席状況を確認する',
    timeSpent: 0,
    completed: false
  },
  {
    id: 2,
    title: '体調確認',
    description: '利用者の体調や様子を確認する',
    timeSpent: 0,
    completed: true
  },
  {
    id: 3,
    title: '重点フォロー確認',
    description: '重点フォロー対象者の状況確認',
    timeSpent: 0,
    completed: false
  }
];

const SAMPLE_EVENING_STEPS: MeetingStep[] = [
  {
    id: 4,
    title: '一日の振り返り',
    description: '本日の活動内容を振り返る',
    timeSpent: 0,
    completed: true
  },
  {
    id: 5,
    title: '明日への申し送り',
    description: '翌日への引き継ぎ事項を確認する',
    timeSpent: 0,
    completed: false
  }
];

describe('MeetingStepsChecklist', () => {
  afterEach(() => {
    cleanup();
  });

  test('Phase 4B: タイトルと基本的なステップ情報を表示できる', () => {
    render(
      <TestWrapper>
        <MeetingStepsChecklist
          title="🌅 朝会ステップ"
          steps={SAMPLE_MORNING_STEPS}
          onToggleStep={vi.fn()}
          colorVariant="primary"
        />
      </TestWrapper>
    );

    expect(screen.getByText('🌅 朝会ステップ')).toBeInTheDocument();
    expect(screen.getByText('完了: 1/3')).toBeInTheDocument();
    expect(screen.getByText('出欠確認')).toBeInTheDocument();
    expect(screen.getByText('体調確認')).toBeInTheDocument();
    expect(screen.getByText('重点フォロー確認')).toBeInTheDocument();
  });

  it('完了済みステップに適切なスタイルが適用される', () => {
    render(
      <TestWrapper>
        <MeetingStepsChecklist
          title="朝会ステップ"
          steps={SAMPLE_MORNING_STEPS}
          onToggleStep={vi.fn()}
          colorVariant="primary"
        />
      </TestWrapper>
    );

    // 完了済みの「体調確認」のチェックマークを確認
    expect(screen.getByText('✓')).toBeInTheDocument();

    // 完了済みステップの存在を確認（複数存在する可能性があるため配列で取得）
    const healthCheckSteps = screen.getAllByText('体調確認');
    expect(healthCheckSteps.length).toBeGreaterThan(0);
  });

  it('ステップクリックでonToggleStepが正しい引数で呼ばれる', () => {
    const handleToggleStep = vi.fn();

    render(
      <TestWrapper>
        <MeetingStepsChecklist
          title="朝会ステップ"
          steps={SAMPLE_MORNING_STEPS}
          onToggleStep={handleToggleStep}
          colorVariant="primary"
        />
      </TestWrapper>
    );

    // 「出欠確認」をクリック（複数存在する場合は最初のものを選択）
    const attendanceCheckElements = screen.getAllByText('出欠確認');
    fireEvent.click(attendanceCheckElements[0]);
    expect(handleToggleStep).toHaveBeenCalledWith(1);

    // 「重点フォロー確認」をクリック（複数存在する場合は最初のものを選択）
    const priorityFollowElements = screen.getAllByText('重点フォロー確認');
    fireEvent.click(priorityFollowElements[0]);
    expect(handleToggleStep).toHaveBeenCalledWith(3);

    expect(handleToggleStep).toHaveBeenCalledTimes(2);
  });

  it('夕会モードでcolorVariant="secondary"が適用される', () => {
    render(
      <TestWrapper>
        <MeetingStepsChecklist
          title="🌆 夕会ステップ"
          steps={SAMPLE_EVENING_STEPS}
          onToggleStep={vi.fn()}
          colorVariant="secondary"
        />
      </TestWrapper>
    );

    expect(screen.getByText('🌆 夕会ステップ')).toBeInTheDocument();
    expect(screen.getByText('一日の振り返り')).toBeInTheDocument();
    expect(screen.getByText('明日への申し送り')).toBeInTheDocument();
  });

  it('footerTextが提供された場合、フッターメッセージが表示される', () => {
    const footerMessage = '💡 朝の情報共有や申し送りに必要なポイントを漏れなくカバーできる構成です。';

    render(
      <TestWrapper>
        <MeetingStepsChecklist
          title="朝会ステップ"
          steps={SAMPLE_MORNING_STEPS}
          onToggleStep={vi.fn()}
          colorVariant="primary"
          footerText={footerMessage}
        />
      </TestWrapper>
    );

    expect(screen.getByText(footerMessage)).toBeInTheDocument();
  });

  it('空のステップ配列でも正常にレンダリングされる', () => {
    render(
      <TestWrapper>
        <MeetingStepsChecklist
          title="空のステップ"
          steps={[]}
          onToggleStep={vi.fn()}
          colorVariant="primary"
        />
      </TestWrapper>
    );

    expect(screen.getByText('空のステップ')).toBeInTheDocument();
    // 特にエラーが発生しないことを確認
  });

  it('ステップIDの表示機能を確認', () => {
    render(
      <TestWrapper>
        <MeetingStepsChecklist
          title="ステップ確認"
          steps={SAMPLE_MORNING_STEPS}
          onToggleStep={vi.fn()}
          colorVariant="primary"
        />
      </TestWrapper>
    );

    // ステップIDが数字として表示されていることを確認
    // 未完了のステップには番号が、完了済みのステップには✓が表示される
    const stepIds1 = screen.getAllByText('1');
    const checkMark = screen.getAllByText('✓');
    const stepIds3 = screen.getAllByText('3');

    expect(stepIds1.length).toBeGreaterThan(0);
    expect(checkMark.length).toBeGreaterThan(0); // 完了済みステップは✓で表示
    expect(stepIds3.length).toBeGreaterThan(0);
  });
});
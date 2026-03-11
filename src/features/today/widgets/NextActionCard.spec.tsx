import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NextActionWithProgress } from '../hooks/useNextAction';
import type { SceneNextActionViewModel } from '../hooks/useSceneNextAction';
import { NextActionCard } from './NextActionCard';

const noop = () => {};

function makeProps(overrides: Partial<NextActionWithProgress> = {}): NextActionWithProgress {
  return {
    item: {
      id: 'staff-1',
      time: '09:00',
      title: '職員朝会',
      owner: '生活支援課',
      minutesUntil: 30,
    },
    progress: null,
    progressKey: 'test-key',
    status: 'idle',
    urgency: 'medium',
    sceneState: 'pending',
    elapsedMinutes: null,
    sourceLane: null,
    actions: { start: noop, done: noop, reset: noop },
    ...overrides,
  };
}

const baseSceneAction: SceneNextActionViewModel = {
  scene: 'arrival-intake',
  sceneLabel: '通所受け入れ',
  title: '出欠を確認してください',
  description: '未入力の利用者がいます',
  reasons: ['未入力 2名'],
  priority: 'high',
  ctaLabel: '出欠を入力',
  ctaTarget: 'attendance',
};

// ─── Core behavior ──────────────────────────────────────────

describe('NextActionCard — 行動ナビゲーター', () => {
  it('has data-testid', () => {
    render(<NextActionCard nextAction={makeProps()} />);
    expect(screen.getByTestId('today-next-action-card')).toBeInTheDocument();
  });

  it('shows schedule item as context (time, title, owner)', () => {
    render(<NextActionCard nextAction={makeProps()} />);

    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('職員朝会')).toBeInTheDocument();
    expect(screen.getByText('生活支援課')).toBeInTheDocument();
    expect(screen.getByText(/あと 30分/)).toBeInTheDocument();
  });

  it('does NOT show Start or Done buttons (タスク管理ではない)', () => {
    render(<NextActionCard nextAction={makeProps()} />);

    expect(screen.queryByTestId('next-action-start')).not.toBeInTheDocument();
    expect(screen.queryByTestId('next-action-done')).not.toBeInTheDocument();
    expect(screen.queryByTestId('next-action-done-chip')).not.toBeInTheDocument();
  });

  it('formats hours correctly', () => {
    render(
      <NextActionCard
        nextAction={makeProps({
          item: {
            id: 'org-1',
            time: '15:00',
            title: '会議',
            minutesUntil: 150,
          },
        })}
      />
    );

    expect(screen.getByText(/あと 2時間30分/)).toBeInTheDocument();
  });

  it('shows completion message when no next action', () => {
    render(
      <NextActionCard
        nextAction={makeProps({ item: null })}
      />
    );

    expect(screen.getByText(/今すぐ優先する対応はありません/)).toBeInTheDocument();
    expect(screen.getByTestId('today-empty-next-action')).toBeInTheDocument();
  });
});

// ─── Scene CTA (業務アクション導線) ─────────────────────────

describe('NextActionCard — Scene CTA', () => {
  it('shows scene CTA when sceneAction has priority', () => {
    render(
      <NextActionCard
        nextAction={makeProps()}
        sceneAction={baseSceneAction}
        onSceneAction={noop}
      />
    );

    expect(screen.getByTestId('scene-action-cta')).toBeInTheDocument();
    expect(screen.getByText('出欠を入力')).toBeInTheDocument();
    expect(screen.getByText('出欠を確認してください')).toBeInTheDocument();
  });

  it('shows scene reasons as chips', () => {
    render(
      <NextActionCard
        nextAction={makeProps()}
        sceneAction={baseSceneAction}
        onSceneAction={noop}
      />
    );

    expect(screen.getByTestId('scene-reasons')).toBeInTheDocument();
    expect(screen.getByTestId('scene-reason-0')).toBeInTheDocument();
    expect(screen.getByText('未入力 2名')).toBeInTheDocument();
  });

  it('calls onSceneAction when CTA is clicked', () => {
    const handleSceneAction = vi.fn();
    render(
      <NextActionCard
        nextAction={makeProps()}
        sceneAction={baseSceneAction}
        onSceneAction={handleSceneAction}
      />
    );

    screen.getByTestId('scene-action-cta').click();
    expect(handleSceneAction).toHaveBeenCalledWith('attendance', undefined);
  });

  it('shows scene label chip', () => {
    render(
      <NextActionCard
        nextAction={makeProps()}
        sceneAction={baseSceneAction}
      />
    );

    expect(screen.getByTestId('scene-label-chip')).toBeInTheDocument();
    expect(screen.getByText(/通所受け入れ/)).toBeInTheDocument();
  });

  it('does NOT show scene CTA when priority is low', () => {
    render(
      <NextActionCard
        nextAction={makeProps()}
        sceneAction={{ ...baseSceneAction, priority: 'low' }}
      />
    );

    expect(screen.queryByTestId('scene-action-cta')).not.toBeInTheDocument();
  });
});

// ─── Overdue 表示 (#852) ────────────────────────────────────

describe('NextActionCard — overdue 表示 (#852)', () => {
  it('shows overdue chip when sceneState is overdue', () => {
    render(
      <NextActionCard
        nextAction={makeProps({
          sceneState: 'overdue',
          urgency: 'high',
          item: {
            id: 'ops-1',
            time: '09:15',
            title: '通所受け入れ',
            minutesUntil: -15,
          },
        })}
      />
    );

    expect(screen.getByTestId('next-action-overdue-chip')).toBeInTheDocument();
    expect(screen.getByText('未着手')).toBeInTheDocument();
  });

  it('shows overdue time instead of time remaining for overdue items', () => {
    render(
      <NextActionCard
        nextAction={makeProps({
          sceneState: 'overdue',
          urgency: 'high',
          item: {
            id: 'ops-1',
            time: '09:15',
            title: '通所受け入れ',
            minutesUntil: -15,
          },
        })}
      />
    );

    expect(screen.getByText(/予定時刻を15分過ぎています/)).toBeInTheDocument();
    expect(screen.queryByText(/あと/)).not.toBeInTheDocument();
  });

  it('does NOT show overdue chip for pending items', () => {
    render(
      <NextActionCard
        nextAction={makeProps({
          sceneState: 'pending',
          urgency: 'medium',
          item: {
            id: 'ops-2',
            time: '09:30',
            title: '検温確認',
            minutesUntil: 15,
          },
        })}
      />
    );

    expect(screen.queryByTestId('next-action-overdue-chip')).not.toBeInTheDocument();
    expect(screen.getByText(/あと 15分/)).toBeInTheDocument();
  });
});

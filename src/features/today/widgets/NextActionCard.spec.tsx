import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NextActionWithProgress } from '../hooks/useNextAction';
import { NextActionCard } from './NextActionCard';

const noop = () => {};
const baseActions = { start: vi.fn(), done: vi.fn(), reset: vi.fn() };

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
    actions: { start: noop, done: noop, reset: noop },
    ...overrides,
  };
}

describe('NextActionCard', () => {
  it('displays next action with Start button in idle state', () => {
    render(<NextActionCard nextAction={makeProps()} />);

    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('職員朝会')).toBeInTheDocument();
    expect(screen.getByText('生活支援課')).toBeInTheDocument();
    expect(screen.getByText(/あと 30分/)).toBeInTheDocument();
    expect(screen.getByTestId('next-action-start')).toBeInTheDocument();
  });

  it('calls start action when Start button is clicked', () => {
    const actions = { ...baseActions };
    render(<NextActionCard nextAction={makeProps({ actions })} />);

    fireEvent.click(screen.getByTestId('next-action-start'));
    expect(actions.start).toHaveBeenCalledTimes(1);
  });

  it('shows Done button and elapsed time in started state', () => {
    render(
      <NextActionCard
        nextAction={makeProps({
          status: 'started',
          sceneState: 'active',
          elapsedMinutes: 15,
          progress: { startedAt: new Date().toISOString(), doneAt: null },
        })}
      />
    );

    expect(screen.getByText(/15分経過/)).toBeInTheDocument();
    expect(screen.getByTestId('next-action-done')).toBeInTheDocument();
    expect(screen.queryByTestId('next-action-start')).not.toBeInTheDocument();
  });

  it('calls done action when Done button is clicked', () => {
    const actions = { ...baseActions };
    render(
      <NextActionCard
        nextAction={makeProps({
          status: 'started',
          sceneState: 'active',
          elapsedMinutes: 5,
          progress: { startedAt: new Date().toISOString(), doneAt: null },
          actions,
        })}
      />
    );

    fireEvent.click(screen.getByTestId('next-action-done'));
    expect(actions.done).toHaveBeenCalledTimes(1);
  });

  it('shows completed chip in done state', () => {
    render(
      <NextActionCard
        nextAction={makeProps({
          status: 'done',
          sceneState: 'done',
          progress: {
            startedAt: new Date().toISOString(),
            doneAt: new Date().toISOString(),
          },
        })}
      />
    );

    expect(screen.getByTestId('next-action-done-chip')).toBeInTheDocument();
    expect(screen.queryByTestId('next-action-start')).not.toBeInTheDocument();
    expect(screen.queryByTestId('next-action-done')).not.toBeInTheDocument();
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

    expect(screen.getByText(/次の予定はありません/)).toBeInTheDocument();
    expect(screen.getByTestId('today-empty-next-action')).toBeInTheDocument();
  });

  it('has data-testid', () => {
    render(<NextActionCard nextAction={makeProps()} />);
    expect(screen.getByTestId('today-next-action-card')).toBeInTheDocument();
  });
});

// ─── Scene-Based: Overdue display tests (#852) ──────────────

describe('NextActionCard — overdue 表示 (#852)', () => {
  it('shows overdue chip when sceneState is overdue and idle', () => {
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

  it('shows "⚠️ X分超過" instead of "あと X分" for overdue items', () => {
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

  it('shows "いま開始" button for overdue idle items', () => {
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

    const startBtn = screen.getByTestId('next-action-start');
    expect(startBtn).toHaveTextContent('いま開始');
  });

  it('does NOT show overdue chip when started (active)', () => {
    render(
      <NextActionCard
        nextAction={makeProps({
          sceneState: 'active',
          status: 'started',
          urgency: 'high',
          elapsedMinutes: 5,
          progress: { startedAt: new Date().toISOString(), doneAt: null },
          item: {
            id: 'ops-1',
            time: '09:15',
            title: '通所受け入れ',
            minutesUntil: -20,
          },
        })}
      />
    );

    expect(screen.queryByTestId('next-action-overdue-chip')).not.toBeInTheDocument();
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

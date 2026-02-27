import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NextActionCard } from './NextActionCard';

describe('NextActionCard', () => {
  it('displays next action with time and title', () => {
    render(
      <NextActionCard
        nextAction={{
          id: 'staff-1',
          time: '09:00',
          title: '職員朝会',
          owner: '生活支援課',
          minutesUntil: 30,
        }}
      />
    );

    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('職員朝会')).toBeInTheDocument();
    expect(screen.getByText('生活支援課')).toBeInTheDocument();
    expect(screen.getByText(/あと 30分/)).toBeInTheDocument();
  });

  it('formats hours correctly', () => {
    render(
      <NextActionCard
        nextAction={{
          id: 'org-1',
          time: '15:00',
          title: '会議',
          minutesUntil: 150,
        }}
      />
    );

    expect(screen.getByText(/あと 2時間30分/)).toBeInTheDocument();
  });

  it('shows completion message when no next action', () => {
    render(<NextActionCard nextAction={null} />);

    expect(screen.getByText(/本日の予定はすべて完了しました/)).toBeInTheDocument();
  });

  it('has data-testid for integration testing', () => {
    render(<NextActionCard nextAction={null} />);

    expect(screen.getByTestId('today-next-action-card')).toBeInTheDocument();
  });
});

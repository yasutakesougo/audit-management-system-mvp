import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefingActionList } from './BriefingActionList';

describe('BriefingActionList', () => {
  it('shows empty state when alerts is empty', () => {
    render(<BriefingActionList alerts={[]} />);

    expect(screen.getByTestId('today-empty-briefing')).toBeInTheDocument();
    expect(screen.getByText('ブリーフィング項目はありません')).toBeInTheDocument();
    // wrapper testid should still be present for E2E stability
    expect(screen.getByTestId('today-accordion-briefing')).toBeInTheDocument();
  });

  it('renders accordion when alerts exist', () => {
    const alerts = [
      {
        id: 'test-absence',
        type: 'absence' as const,
        severity: 'warning' as const,
        label: '本日欠席',
        count: 2,
        items: [
          { userId: 'U001', userName: '田中 太郎' },
          { userId: 'U002', userName: '山田 花子' },
        ],
      },
    ];

    render(<BriefingActionList alerts={alerts} />);

    // Should NOT show empty state
    expect(screen.queryByTestId('today-empty-briefing')).not.toBeInTheDocument();
    // Should show the accordion
    expect(screen.getByTestId('today-accordion-briefing')).toBeInTheDocument();
    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
  });
});

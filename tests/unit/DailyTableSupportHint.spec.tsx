import { TableDailyRecordTable } from '@/features/daily/components/TableDailyRecordTable';
import type { UserRowData } from '@/features/daily/hooks/useTableDailyRecordForm';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mocking useSupportPlanHints to return controlled data
vi.mock('@/features/daily/hooks/useSupportPlanHints', () => ({
  useSupportPlanHints: () => ({
    'U001': {
      userId: 'U001',
      longTermGoal: 'Become independent',
      dailySupports: 'Visual cues',
      riskManagement: 'Fall risk'
    }
  })
}));

describe('TableDailyRecordTable Support Hints', () => {
  const mockRows: UserRowData[] = [
    {
      userId: 'U001',
      userName: 'User A',
      amActivity: '',
      pmActivity: '',
      lunchAmount: '',
      problemBehavior: {
        selfHarm: false,
        violence: false,
        loudVoice: false,
        pica: false,
        other: false
      },
      specialNotes: ''
    }
  ];

  const onRowDataChange = vi.fn();
  const onProblemBehaviorChange = vi.fn();
  const onClearRow = vi.fn();

  it('displays support icons when highlights exist', () => {
    render(
      <TableDailyRecordTable
        rows={mockRows}
        onRowDataChange={onRowDataChange}
        onProblemBehaviorChange={onProblemBehaviorChange}
        onClearRow={onClearRow}
      />
    );

    // Long-term goal icon (Info)
    const goalIcon = screen.getByTestId('support-plan-goal-icon');
    expect(goalIcon).toBeInTheDocument();
    expect(goalIcon).toHaveAttribute('aria-label', '長期目標あり');

    // Risk icon (Warning)
    const riskIcon = screen.getByTestId('support-plan-risk-icon');
    expect(riskIcon).toBeInTheDocument();
    expect(riskIcon).toHaveAttribute('aria-label', 'リスク情報あり');
  });

  it('shows the correct tooltip text on hover', async () => {
    render(
      <TableDailyRecordTable
        rows={mockRows}
        onRowDataChange={onRowDataChange}
        onProblemBehaviorChange={onProblemBehaviorChange}
        onClearRow={onClearRow}
      />
    );

    const infoIcon = screen.getByTestId('support-plan-goal-icon');
    fireEvent.mouseOver(infoIcon);

    // MUI Tooltips appear in a portal, so we check the document
    expect(await screen.findByText(/Become independent/)).toBeInTheDocument();
  });

  it('displays helper text and hint icon in TextField', () => {
    render(
      <TableDailyRecordTable
        rows={mockRows}
        onRowDataChange={onRowDataChange}
        onProblemBehaviorChange={onProblemBehaviorChange}
        onClearRow={onClearRow}
      />
    );

    // Check for helper text '支援手順あり'
    expect(screen.getAllByText(/支援手順あり/)[0]).toBeInTheDocument();
  });

  it('does not include hint data in the onRowDataChange payload', () => {
    render(
      <TableDailyRecordTable
        rows={mockRows}
        onRowDataChange={onRowDataChange}
        onProblemBehaviorChange={onProblemBehaviorChange}
        onClearRow={onClearRow}
      />
    );

    const amInput = screen.getByPlaceholderText('午前の活動');
    fireEvent.change(amInput, { target: { value: 'Walking' } });

    // Verify that the call only contains standard fields
    expect(onRowDataChange).toHaveBeenCalledWith('U001', 'amActivity', 'Walking');
    // The hintsMap is never passed to onRowDataChange
    expect(onRowDataChange).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ longTermGoal: expect.anything() }));
  });
});

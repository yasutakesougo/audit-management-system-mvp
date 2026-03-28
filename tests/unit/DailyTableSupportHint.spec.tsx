import { TableDailyRecordTable } from '@/features/daily/components/sections/TableDailyRecordTable';
import type { TableDailyRecordRow } from '@/features/daily/table/models/tableDailyRecordRow';
import { buildTableDailyRecordRows } from '@/features/daily/table/models/buildTableDailyRecordRows';
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
  const mockRows: TableDailyRecordRow[] = buildTableDailyRecordRows([
    {
      userId: 'U001',
      userName: 'User A',
      amActivity: '',
      pmActivity: '',
      lunchAmount: '',
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false
      },
      specialNotes: '',
      behaviorTags: [],
    }
  ]);

  const onRowDataChange = vi.fn();
  const onProblemBehaviorChange = vi.fn();
  const onBehaviorTagToggle = vi.fn();
  const onClearRow = vi.fn();

  beforeEach(() => {
    // Mock localStorage for JSDOM
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    });
  });

  it.skip('displays support icons when highlights exist (stale: UI elements removed)', () => {
    render(
      <TableDailyRecordTable
        rows={mockRows}
        onRowDataChange={onRowDataChange}
        onProblemBehaviorChange={onProblemBehaviorChange}
        onBehaviorTagToggle={onBehaviorTagToggle}
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

  it.skip('shows the correct tooltip text on hover (stale: UI elements removed)', async () => {
    render(
      <TableDailyRecordTable
        rows={mockRows}
        onRowDataChange={onRowDataChange}
        onProblemBehaviorChange={onProblemBehaviorChange}
        onBehaviorTagToggle={onBehaviorTagToggle}
        onClearRow={onClearRow}
      />
    );

    const infoIcon = screen.getByTestId('support-plan-goal-icon');
    fireEvent.mouseOver(infoIcon);

    // MUI Tooltips appear in a portal, so we check the document
    expect(await screen.findByText(/Become independent/)).toBeInTheDocument();
  });

  it.skip('displays helper text and hint icon in TextField (stale: UI elements removed)', () => {
    render(
      <TableDailyRecordTable
        rows={mockRows}
        onRowDataChange={onRowDataChange}
        onProblemBehaviorChange={onProblemBehaviorChange}
        onBehaviorTagToggle={onBehaviorTagToggle}
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
        onBehaviorTagToggle={onBehaviorTagToggle}
        onClearRow={onClearRow}
      />
    );

    const amInput = screen.getByPlaceholderText('午前');
    fireEvent.change(amInput, { target: { value: 'Walking' } });

    // Verify that the call only contains standard fields
    expect(onRowDataChange).toHaveBeenCalledWith('U001', 'amActivity', 'Walking');
    // The hintsMap is never passed to onRowDataChange
    expect(onRowDataChange).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ longTermGoal: expect.anything() }));
  });
});

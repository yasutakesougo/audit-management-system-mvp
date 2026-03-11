/**
 * WeekTimeGrid.spec.tsx — focused render tests for the WeekTimeGrid component.
 *
 * Uses React Testing Library + userEvent.
 * No MSW, no router, no MUI ThemeProvider required (inline styles only).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WeekTimeGridProps } from '../WeekTimeGrid';
import { WeekTimeGrid } from '../WeekTimeGrid';

// ---------------------------------------------------------------------------
// Minimal SchedItem factory
// ---------------------------------------------------------------------------

const makeItem = (overrides: Partial<{
  id: string;
  title: string;
  start: string;
  end: string;
  personName: string;
  baseShiftWarnings: { staffId?: string; staffName?: string }[];
}> = {}) => ({
  id: overrides.id ?? 'item-1',
  title: overrides.title ?? 'テスト予定',
  start: overrides.start ?? '2026-03-11T09:00:00+09:00', // JST 09:00
  end: overrides.end ?? '2026-03-11T10:00:00+09:00',
  allDay: false,
  status: 'Planned' as const,
  etag: '',
  personName: overrides.personName,
  baseShiftWarnings: overrides.baseShiftWarnings,
});

// ---------------------------------------------------------------------------
// Test week data fixtures
// ---------------------------------------------------------------------------

const WEEK_DAYS = [
  { iso: '2026-03-09', label: '3月9日(月)' },
  { iso: '2026-03-10', label: '3月10日(火)' },
  { iso: '2026-03-11', label: '3月11日(水)' },
  { iso: '2026-03-12', label: '3月12日(木)' },
  { iso: '2026-03-13', label: '3月13日(金)' },
  { iso: '2026-03-14', label: '3月14日(土)' },
  { iso: '2026-03-15', label: '3月15日(日)' },
];

const emptyGroupedItems = (): Map<string, ReturnType<typeof makeItem>[]> => {
  const map = new Map();
  WEEK_DAYS.forEach((d) => map.set(d.iso, []));
  return map;
};

const defaultProps = (): WeekTimeGridProps => ({
  weekDays: WEEK_DAYS,
  todayIso: '2026-03-11',
  groupedItems: emptyGroupedItems(),
});

// ---------------------------------------------------------------------------
// Grid structure
// ---------------------------------------------------------------------------

describe('WeekTimeGrid — grid structure', () => {
  it('renders the 時刻 header cell', () => {
    render(<WeekTimeGrid {...defaultProps()} />);
    expect(screen.getByText('時刻')).toBeInTheDocument();
  });

  it('renders all 7 day labels in column headers', () => {
    render(<WeekTimeGrid {...defaultProps()} />);
    WEEK_DAYS.forEach((day) => {
      expect(screen.getByText(day.label)).toBeInTheDocument();
    });
  });

  it('renders the grid container with accessible aria-label', () => {
    render(<WeekTimeGrid {...defaultProps()} />);
    expect(
      screen.getByRole('generic', { name: '週ごとの時間割' }),
    ).toBeInTheDocument();
  });

  it('renders time slot cells (06:00〜21:30)', () => {
    render(<WeekTimeGrid {...defaultProps()} />);
    // TIME_START=6, TIME_END=22 → 32 slots
    const slots = screen.getAllByTestId('schedules-week-slot');
    // 7 days × 32 slots = 224 cells
    expect(slots.length).toBe(7 * 32);
  });

  it('renders 06:00 and 21:30 as boundary time labels', () => {
    render(<WeekTimeGrid {...defaultProps()} />);
    expect(screen.getByText('06:00')).toBeInTheDocument();
    expect(screen.getByText('21:30')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Today highlight
// ---------------------------------------------------------------------------

describe('WeekTimeGrid — today highlight', () => {
  it('renders 今日 label for the today column', () => {
    render(<WeekTimeGrid {...defaultProps()} />);
    // todayIso = '2026-03-11' = 3月11日(水)
    expect(screen.getByText('今日')).toBeInTheDocument();
  });

  it('does NOT render 今日 when todayIso does not match any weekday', () => {
    render(
      <WeekTimeGrid
        {...defaultProps()}
        todayIso="2099-01-01"
      />,
    );
    expect(screen.queryByText('今日')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// onTimeSlotClick callback
// ---------------------------------------------------------------------------

describe('WeekTimeGrid — onTimeSlotClick', () => {
  it('calls onTimeSlotClick with dayIso and timeStr when a slot is pointer-up clicked', () => {
    const onTimeSlotClick = vi.fn();

    render(
      <WeekTimeGrid
        {...defaultProps()}
        onTimeSlotClick={onTimeSlotClick}
      />,
    );

    // Find the slot for 2026-03-11 09:00 (Wednesday)
    const slot = screen.getAllByTestId('schedules-week-slot')
      .find((el) =>
        el.getAttribute('data-day') === '2026-03-11' &&
        el.getAttribute('data-time') === '09:00',
      );

    expect(slot).toBeDefined();
    // Use fireEvent.pointerUp — triggers the React onPointerUp handler
    fireEvent.pointerUp(slot!);

    expect(onTimeSlotClick).toHaveBeenCalledWith('2026-03-11', '09:00');
  });

  it('slot buttons have data-day and data-time attributes', () => {
    render(<WeekTimeGrid {...defaultProps()} />);
    const slot = screen
      .getAllByTestId('schedules-week-slot')
      .find((el) =>
        el.getAttribute('data-day') === '2026-03-09' &&
        el.getAttribute('data-time') === '06:00',
      );
    expect(slot).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Schedule item rendering
// ---------------------------------------------------------------------------

describe('WeekTimeGrid — schedule items', () => {
  it('renders a schedule item title/personName in the correct time slot', () => {
    const item = makeItem({ personName: '山田太郎', start: '2026-03-11T09:00:00+09:00' });
    const grouped = emptyGroupedItems();
    grouped.set('2026-03-11', [item]);

    render(
      <WeekTimeGrid
        {...defaultProps()}
        groupedItems={grouped}
      />,
    );

    expect(screen.getByText('山田太郎')).toBeInTheDocument();
  });

  it('falls back to title when personName is absent', () => {
    const item = makeItem({
      title: '組織研修',
      personName: undefined,
      start: '2026-03-11T10:00:00+09:00',
    });
    const grouped = emptyGroupedItems();
    grouped.set('2026-03-11', [item]);

    render(<WeekTimeGrid {...defaultProps()} groupedItems={grouped} />);
    expect(screen.getByText('組織研修')).toBeInTheDocument();
  });

  it('calls onItemSelect when a schedule item is clicked', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    const item = makeItem({ start: '2026-03-11T09:00:00+09:00' });
    const grouped = emptyGroupedItems();
    grouped.set('2026-03-11', [item]);

    render(
      <WeekTimeGrid
        {...defaultProps()}
        groupedItems={grouped}
        onItemSelect={onItemSelect}
      />,
    );

    const scheduleButton = screen.getByTestId('schedule-item');
    await user.click(scheduleButton);

    expect(onItemSelect).toHaveBeenCalledTimes(1);
    expect(onItemSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
  });

  it('renders schedule item with correct data-id and data-category attributes', () => {
    const item = makeItem({ id: 'sched-99', start: '2026-03-11T14:00:00+09:00' });
    const grouped = emptyGroupedItems();
    grouped.set('2026-03-11', [item]);

    render(<WeekTimeGrid {...defaultProps()} groupedItems={grouped} />);

    const el = screen.getByTestId('schedule-item');
    expect(el).toHaveAttribute('data-id', 'sched-99');
    expect(el).toHaveAttribute('data-category', 'Org');
  });
});

// ---------------------------------------------------------------------------
// Warning indicator on items
// ---------------------------------------------------------------------------

describe('WeekTimeGrid — item warning indicators', () => {
  it('renders schedule-warning-indicator for items with baseShiftWarnings', () => {
    const item = makeItem({
      start: '2026-03-11T09:00:00+09:00',
      baseShiftWarnings: [{ staffId: 's1', staffName: '佐藤' }],
    });
    const grouped = emptyGroupedItems();
    grouped.set('2026-03-11', [item]);

    render(<WeekTimeGrid {...defaultProps()} groupedItems={grouped} />);

    expect(screen.getByTestId('schedule-warning-indicator')).toBeInTheDocument();
  });

  it('does NOT render warning indicator when baseShiftWarnings is empty', () => {
    const item = makeItem({
      start: '2026-03-11T09:00:00+09:00',
      baseShiftWarnings: [],
    });
    const grouped = emptyGroupedItems();
    grouped.set('2026-03-11', [item]);

    render(<WeekTimeGrid {...defaultProps()} groupedItems={grouped} />);

    expect(screen.queryByTestId('schedule-warning-indicator')).not.toBeInTheDocument();
  });

  it('does NOT render warning indicator when baseShiftWarnings is absent', () => {
    const item = makeItem({ start: '2026-03-11T09:00:00+09:00' });
    const grouped = emptyGroupedItems();
    grouped.set('2026-03-11', [item]);

    render(<WeekTimeGrid {...defaultProps()} groupedItems={grouped} />);

    expect(screen.queryByTestId('schedule-warning-indicator')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slot cells — aria labels
// ---------------------------------------------------------------------------

describe('WeekTimeGrid — slot aria labels', () => {
  it('each slot button has an aria-label containing day label and time', () => {
    render(<WeekTimeGrid {...defaultProps()} />);

    // Check a specific slot: 3月11日(水) 09:00時間帯
    const expected = screen.getByRole('button', { name: /3月11日\(水\) 09:00時間帯/ });
    expect(expected).toBeInTheDocument();
  });
});

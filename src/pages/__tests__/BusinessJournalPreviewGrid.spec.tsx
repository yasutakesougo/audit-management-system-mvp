/**
 * BusinessJournalPreviewGrid — Component Tests
 *
 * Covers:
 *   - Grid table renders with correct testid
 *   - Column header "利用者名" is present
 *   - Day number headers are rendered for each day
 *   - User rows: user name displayed + personal journal link href
 *   - Data cells rendered with correct testid
 *   - Cell click fires onCellClick with correct args
 *   - Weekend cell (attendance '休日'): onCellClick still called but with '休日' entry
 *     (guard is Page's responsibility; Grid passes the call through)
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BusinessJournalPreviewGrid } from '../BusinessJournalPreviewGrid';
import type { JournalDayEntry, JournalUserRow } from '../businessJournalPreviewHelpers';

// ── Mock react-router-dom ────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const weekdayEntry = (day: number): JournalDayEntry => ({
  date: `2024-01-${String(day).padStart(2, '0')}`,
  attendance: '出席',
  mealAmount: '完食',
  amActivities: ['軽作業'],
  pmActivities: ['読書'],
});

const weekendEntry = (day: number): JournalDayEntry => ({
  date: `2024-01-${String(day).padStart(2, '0')}`,
  attendance: '休日',
  amActivities: [],
  pmActivities: [],
});

// Create a minimal dataset: 2 users, 3 days (Mon 1, Tue 2, Wed 3)
const MOCK_DATA: JournalUserRow[] = [
  {
    userId: 'U001',
    displayName: '田中 太郎',
    entries: [weekdayEntry(1), weekdayEntry(2), weekdayEntry(3)],
  },
  {
    userId: 'U002',
    displayName: '鈴木 花子',
    entries: [weekdayEntry(1), weekendEntry(6), weekdayEntry(3)],
  },
];

const DAY_HEADERS = [1, 2, 3];

function renderGrid(
  overrides: Partial<Parameters<typeof BusinessJournalPreviewGrid>[0]> = {},
) {
  const props = {
    data: MOCK_DATA,
    selectedYear: 2024,
    selectedMonth: 1,
    dayHeaders: DAY_HEADERS,
    onCellClick: vi.fn(),
    ...overrides,
  };
  return { ...render(<BusinessJournalPreviewGrid {...props} />), props };
}

// ── Table structure ───────────────────────────────────────────────────────────

describe('BusinessJournalPreviewGrid — table structure', () => {
  it('renders with journal-preview-grid testid', () => {
    renderGrid();
    expect(screen.getByTestId('journal-preview-grid')).toBeInTheDocument();
  });

  it('renders "利用者名" column header', () => {
    renderGrid();
    expect(screen.getByText('利用者名')).toBeInTheDocument();
  });

  it('renders a column header for each day in dayHeaders', () => {
    renderGrid();
    // Each day number appears in the header (may also appear in dates, so use getAllByText)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the aria-label on the table', () => {
    renderGrid();
    expect(
      screen.getByRole('table', { name: '業務日誌月間グリッド' }),
    ).toBeInTheDocument();
  });
});

// ── User rows ────────────────────────────────────────────────────────────────

describe('BusinessJournalPreviewGrid — user rows', () => {
  it('renders all user display names', () => {
    renderGrid();
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.getByText('鈴木 花子')).toBeInTheDocument();
  });

  it('user name links have the correct personal journal URL', () => {
    renderGrid();
    const links = screen.getAllByTestId('journal-user-link');
    // U001 link
    const u001Link = links.find((l) => l.textContent === '田中 太郎');
    expect(u001Link).toBeDefined();
    expect(u001Link?.getAttribute('href')).toBe(
      '/records/journal/personal?user=U001&month=2024-01',
    );
  });

  it('encodes user ID in the personal journal URL', () => {
    const dataWithSpecialId: JournalUserRow[] = [
      {
        userId: 'U 001', // space requires encoding
        displayName: 'テスト',
        entries: [weekdayEntry(1), weekdayEntry(2), weekdayEntry(3)],
      },
    ];
    renderGrid({ data: dataWithSpecialId });
    const link = screen.getByTestId('journal-user-link');
    expect(link.getAttribute('href')).toContain('user=U%20001');
  });
});

// ── Cell rendering ───────────────────────────────────────────────────────────

describe('BusinessJournalPreviewGrid — cells', () => {
  it('renders journal-preview-cell testid elements', () => {
    renderGrid();
    // 2 users × 3 days = 6 cells
    const cells = screen.getAllByTestId('journal-preview-cell');
    expect(cells.length).toBe(6);
  });
});

// ── Cell click ───────────────────────────────────────────────────────────────

describe('BusinessJournalPreviewGrid — cell click', () => {
  it('calls onCellClick with userId, displayName and entry when a weekday cell is clicked', () => {
    const onCellClick = vi.fn();
    renderGrid({ onCellClick });

    const cells = screen.getAllByTestId('journal-preview-cell');
    // Click the first cell (田中 太郎, day 1)
    fireEvent.click(cells[0]);

    expect(onCellClick).toHaveBeenCalledTimes(1);
    const [userId, displayName, entry] = onCellClick.mock.calls[0];
    expect(userId).toBe('U001');
    expect(displayName).toBe('田中 太郎');
    expect(entry).toMatchObject({ attendance: '出席', date: '2024-01-01' });
  });

  it('still calls onCellClick on a weekend cell (guard is Page responsibility)', () => {
    const onCellClick = vi.fn();
    renderGrid({ onCellClick });

    // cells[4] is 鈴木 花子 day 2 which is weekendEntry(6) — attendance '休日'
    const cells = screen.getAllByTestId('journal-preview-cell');
    fireEvent.click(cells[4]);

    expect(onCellClick).toHaveBeenCalledTimes(1);
    const [, , entry] = onCellClick.mock.calls[0];
    expect(entry.attendance).toBe('休日');
  });

  it('does not call onCellClick when data is empty', () => {
    const onCellClick = vi.fn();
    renderGrid({ data: [], onCellClick });
    expect(screen.queryAllByTestId('journal-preview-cell')).toHaveLength(0);
    expect(onCellClick).not.toHaveBeenCalled();
  });
});

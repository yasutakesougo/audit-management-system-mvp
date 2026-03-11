/**
 * BusinessJournalPreviewControls — Component Tests
 *
 * Covers:
 *   - Page header (title + subtitle) rendered
 *   - Month selector displays correct current value
 *   - Month options are rendered as MenuItem items
 *   - onMonthChange fires with the correct value when selection changes
 *   - Legend renders attendance status colours and meal legend
 *   - data-testid on MonthSelector
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BusinessJournalPreviewControls, type MonthOption } from '../BusinessJournalPreviewControls';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MONTH_OPTIONS: MonthOption[] = [
  { value: '2024-10', label: '2024年10月', year: 2024, month: 10 },
  { value: '2024-11', label: '2024年11月', year: 2024, month: 11 },
  { value: '2024-12', label: '2024年12月', year: 2024, month: 12 },
];

function renderControls(overrides: Partial<Parameters<typeof BusinessJournalPreviewControls>[0]> = {}) {
  const props = {
    selectedYear: 2024,
    selectedMonth: 11,
    monthOptions: MONTH_OPTIONS,
    onMonthChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<BusinessJournalPreviewControls {...props} />), props };
}

// ── Header ────────────────────────────────────────────────────────────────────

describe('BusinessJournalPreviewControls — header', () => {
  it('renders the page title h1', () => {
    renderControls();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('業務日誌プレビュー');
  });

  it('renders the subtitle description', () => {
    renderControls();
    expect(
      screen.getByText(/紙の業務日誌と同等のレイアウトで/),
    ).toBeInTheDocument();
  });
});

// ── MonthSelector ────────────────────────────────────────────────────────────

describe('BusinessJournalPreviewControls — month selector', () => {
  it('has the journal-preview-month-select testid', () => {
    renderControls();
    expect(screen.getByTestId('journal-preview-month-select')).toBeInTheDocument();
  });

  it('displays the current month label as selected', () => {
    renderControls({ selectedYear: 2024, selectedMonth: 11 });
    // MUI TextField select renders the selected label as visible text
    expect(screen.getByText('2024年11月')).toBeInTheDocument();
  });

  it('calls onMonthChange with the selected option value', () => {
    const onMonthChange = vi.fn();
    renderControls({ onMonthChange });

    // Find the hidden select input and change its value
    const select = screen.getByTestId('journal-preview-month-select').querySelector('input');
    expect(select).not.toBeNull();
    fireEvent.change(select!, { target: { value: '2024-12' } });

    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith('2024-12');
  });
});

// ── Legend ────────────────────────────────────────────────────────────────────

describe('BusinessJournalPreviewControls — legend', () => {
  it('renders the legend prefix label', () => {
    renderControls();
    expect(screen.getByText('凡例:')).toBeInTheDocument();
  });

  it('renders all 5 attendance status labels in the legend', () => {
    renderControls();
    const statusLabels = ['出席', '欠席', '遅刻', '早退', '休日'];
    for (const label of statusLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders the meal legend entry', () => {
    renderControls();
    expect(screen.getByText(/◎完食 ○多め △半分 ▽少なめ ×なし/)).toBeInTheDocument();
  });
});

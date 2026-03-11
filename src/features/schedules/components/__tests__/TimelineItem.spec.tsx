/**
 * TimelineItem.spec.tsx — focused render tests for the TimelineItem component.
 *
 * Uses React Testing Library render only.
 * No MSW, no router, no context providers required.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimelineItem } from '../TimelineItem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  title: '朝のミーティング',
  timeLabel: '09:00〜10:00',
};

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('TimelineItem — basic rendering', () => {
  it('renders the title', () => {
    render(<TimelineItem {...defaultProps} />);
    expect(screen.getByText('朝のミーティング')).toBeInTheDocument();
  });

  it('renders the time label', () => {
    render(<TimelineItem {...defaultProps} />);
    expect(screen.getByText('09:00〜10:00')).toBeInTheDocument();
  });

  it('renders a secondary text when provided', () => {
    render(<TimelineItem {...defaultProps} secondary="第1会議室" />);
    expect(screen.getByText('第1会議室')).toBeInTheDocument();
  });

  it('does not render secondary section when omitted', () => {
    render(<TimelineItem {...defaultProps} />);
    expect(screen.queryByText('第1会議室')).not.toBeInTheDocument();
  });

  it('renders statusReason when provided', () => {
    render(<TimelineItem {...defaultProps} statusReason="利用者都合" />);
    expect(screen.getByText('利用者都合')).toBeInTheDocument();
  });

  it('trims leading/trailing whitespace from statusReason', () => {
    render(<TimelineItem {...defaultProps} statusReason="  スペース  " />);
    expect(screen.getByText('スペース')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

describe('TimelineItem — status badge', () => {
  it('does NOT render a badge for Planned status (default)', () => {
    render(<TimelineItem {...defaultProps} status="Planned" />);
    expect(screen.queryByText('予定どおり')).not.toBeInTheDocument();
  });

  it('renders 延期 badge for Postponed status', () => {
    render(<TimelineItem {...defaultProps} status="Postponed" />);
    expect(screen.getByText('延期')).toBeInTheDocument();
  });

  it('renders 中止 badge for Cancelled status', () => {
    render(<TimelineItem {...defaultProps} status="Cancelled" />);
    expect(screen.getByText('中止')).toBeInTheDocument();
  });

  it('does not render a badge when status is undefined', () => {
    render(<TimelineItem {...defaultProps} />);
    // No badge labels should appear
    expect(screen.queryByText('延期')).not.toBeInTheDocument();
    expect(screen.queryByText('中止')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Warning indicator
// ---------------------------------------------------------------------------

describe('TimelineItem — warning indicator', () => {
  it('renders warning indicator when hasWarning is true', () => {
    render(<TimelineItem {...defaultProps} hasWarning />);
    expect(screen.getByTestId('schedule-warning-indicator')).toBeInTheDocument();
  });

  it('does NOT render warning indicator when hasWarning is false', () => {
    render(<TimelineItem {...defaultProps} hasWarning={false} />);
    expect(screen.queryByTestId('schedule-warning-indicator')).not.toBeInTheDocument();
  });

  it('does NOT render warning indicator when hasWarning is omitted', () => {
    render(<TimelineItem {...defaultProps} />);
    expect(screen.queryByTestId('schedule-warning-indicator')).not.toBeInTheDocument();
  });

  it('uses custom warningLabel as the aria-label and title', () => {
    render(
      <TimelineItem
        {...defaultProps}
        hasWarning
        warningLabel="担当重複: 田中"
      />,
    );
    const indicator = screen.getByTestId('schedule-warning-indicator');
    expect(indicator).toHaveAttribute('aria-label', '担当重複: 田中');
    expect(indicator).toHaveAttribute('title', '担当重複: 田中');
  });

  it('falls back to default text when warningLabel is omitted', () => {
    render(<TimelineItem {...defaultProps} hasWarning />);
    const indicator = screen.getByTestId('schedule-warning-indicator');
    expect(indicator).toHaveAttribute('aria-label', '注意が必要な予定です');
  });
});

// ---------------------------------------------------------------------------
// Acceptance info
// ---------------------------------------------------------------------------

describe('TimelineItem — acceptance info', () => {
  it('shows 受け入れ: 未登録 when no accepted info is given', () => {
    render(<TimelineItem {...defaultProps} />);
    expect(
      screen.getByRole('generic', { name: '受け入れ情報（未登録）' }),
    ).toBeInTheDocument();
    expect(screen.getByText('受け入れ: 未登録')).toBeInTheDocument();
  });

  it('renders acceptedBy without a date', () => {
    render(<TimelineItem {...defaultProps} acceptedBy="山田" />);
    expect(screen.getByText('受け入れ: 山田')).toBeInTheDocument();
  });

  it('renders acceptedBy and formatted date together', () => {
    render(
      <TimelineItem
        {...defaultProps}
        acceptedBy="山田"
        acceptedOn="2026-03-11T09:30:00+09:00"
      />,
    );
    const el = screen.getByRole('generic', { name: '受け入れ情報' });
    expect(el.textContent).toContain('受け入れ: 山田');
    expect(el.textContent).toContain('/');
  });

  it('handles unparseable acceptedOn by slicing to 16 chars', () => {
    render(
      <TimelineItem
        {...defaultProps}
        acceptedBy="田中"
        acceptedOn="not-a-valid-date-extra"
      />,
    );
    const el = screen.getByRole('generic', { name: '受け入れ情報' });
    // Should not crash; slices to 16 chars: "not-a-valid-date"
    expect(el.textContent).toContain('受け入れ: 田中');
  });

  it('shows no acceptance info section when acceptedBy/acceptedOn/acceptedNote are all absent', () => {
    render(<TimelineItem {...defaultProps} />);
    expect(screen.queryByRole('generic', { name: '受け入れ情報' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Compact mode
// ---------------------------------------------------------------------------

describe('TimelineItem — compact mode', () => {
  it('renders without error in compact mode', () => {
    render(<TimelineItem {...defaultProps} compact />);
    expect(screen.getByText('朝のミーティング')).toBeInTheDocument();
  });

  it('renders without error in normal (non-compact) mode', () => {
    render(<TimelineItem {...defaultProps} compact={false} />);
    expect(screen.getByText('朝のミーティング')).toBeInTheDocument();
  });

  it('compact mode still shows warning indicator', () => {
    render(<TimelineItem {...defaultProps} compact hasWarning warningLabel="重複" />);
    expect(screen.getByTestId('schedule-warning-indicator')).toBeInTheDocument();
  });

  it('compact mode still shows status badge for Cancelled', () => {
    render(<TimelineItem {...defaultProps} compact status="Cancelled" />);
    expect(screen.getByText('中止')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('TimelineItem — accessibility', () => {
  it('renders aria-hidden decorative elements', () => {
    render(<TimelineItem {...defaultProps} />);
    // Timeline line and dot should be aria-hidden
    const hiddenElems = document.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenElems.length).toBeGreaterThanOrEqual(2);
  });

  it('acceptance area has aria-label 受け入れ情報 when accepted', () => {
    render(<TimelineItem {...defaultProps} acceptedBy="テスト" />);
    expect(
      screen.getByRole('generic', { name: '受け入れ情報' }),
    ).toBeInTheDocument();
  });
});

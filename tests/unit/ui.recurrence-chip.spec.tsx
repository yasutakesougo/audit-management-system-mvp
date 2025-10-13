import { RecurrenceChip } from '@/ui/components/RecurrenceChip';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('RecurrenceChip', () => {
  it('returns null when no metadata is provided', () => {
    const { container } = render(<RecurrenceChip meta={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('prefers the human friendly text over the rule and default label', () => {
    render(<RecurrenceChip meta={{ text: '毎週火曜日', rrule: 'FREQ=WEEKLY' }} />);
    expect(screen.getByText('毎週火曜日')).toBeInTheDocument();
  });

  it('falls back to the recurrence rule before using the default label', () => {
    const { rerender } = render(<RecurrenceChip meta={{ rrule: 'FREQ=DAILY' }} />);
    expect(screen.getByText('FREQ=DAILY')).toBeInTheDocument();

    rerender(<RecurrenceChip meta={{}} />);
    expect(screen.getByText('繰り返し')).toBeInTheDocument();
  });
});

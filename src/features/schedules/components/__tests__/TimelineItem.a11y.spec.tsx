import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TimelineItem } from '../timeline/TimelineItem';

expect.extend(toHaveNoViolations);

describe('TimelineItem — Accessibility', () => {
  const defaultProps = {
    title: '朝のミーティング',
    timeLabel: '09:00〜10:00',
  };

  it('should have no basic accessibility violations', async () => {
    const { container } = render(<TimelineItem {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when interactive (onClick provided)', async () => {
    const { container } = render(<TimelineItem {...defaultProps} onClick={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have a button role and be focusable when onClick is provided', () => {
    render(<TimelineItem {...defaultProps} onClick={() => {}} />);
    const button = screen.getByRole('button', { name: /朝のミーティング/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('tabIndex', '0');
  });

  it('should trigger onClick when Enter key is pressed', () => {
    const handleClick = vi.fn();
    render(<TimelineItem {...defaultProps} onClick={handleClick} />);
    const button = screen.getByRole('button', { name: /朝のミーティング/i });
    
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should trigger onClick when Space key is pressed', () => {
    const handleClick = vi.fn();
    render(<TimelineItem {...defaultProps} onClick={handleClick} />);
    const button = screen.getByRole('button', { name: /朝のミーティング/i });
    
    fireEvent.keyDown(button, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should have proper aria-label for warning indicator', () => {
    render(<TimelineItem {...defaultProps} hasWarning warningLabel="担当重複" />);
    const warning = screen.getByLabelText('担当重複');
    expect(warning).toBeInTheDocument();
  });

  it('should have aria-hidden decorative elements', () => {
    render(<TimelineItem {...defaultProps} />);
    // The dot and line should be hidden from screen readers
    const hiddenElements = document.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenElements.length).toBeGreaterThanOrEqual(2);
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AttendanceRow, type AttendanceRowProps } from '../AttendanceRow';

const baseProps: AttendanceRowProps = {
  user: { id: 'U001', name: '田中太郎（U001）' },
  visit: { status: '未' },
  canAbsence: true,
  onCheckIn: vi.fn(),
  onCheckOut: vi.fn(),
  onAbsence: vi.fn(),
  onDetail: vi.fn(),
};

describe('AttendanceRow', () => {
  it('shows all action buttons in normal mode', () => {
    render(<AttendanceRow {...baseProps} />);

    expect(screen.getByRole('button', { name: /通所/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /退所/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /欠席/ })).toBeEnabled();
  });

  it('enlarges check-in button and disables secondary actions in checkInRun mode', () => {
    render(<AttendanceRow {...baseProps} inputMode="checkInRun" />);

    const checkInBtn = screen.getByRole('button', { name: /通所/ });
    expect(checkInBtn).toBeEnabled();

    // Secondary actions visible but disabled
    expect(screen.getByRole('button', { name: /退所/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /欠席/ })).toBeDisabled();
  });

  it('shows completed state for checked-in row in checkInRun mode', () => {
    render(
      <AttendanceRow
        {...baseProps}
        visit={{ status: '通所中', checkInAtText: '09:00' }}
        inputMode="checkInRun"
      />,
    );

    const checkInBtn = screen.getByRole('button', { name: /通所済/ });
    expect(checkInBtn).toBeDisabled();
  });
});

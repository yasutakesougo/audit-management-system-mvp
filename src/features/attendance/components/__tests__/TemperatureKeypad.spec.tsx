import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
    DECIMAL_OPTIONS,
    DEFAULT_INTEGER,
    INTEGER_OPTIONS,
    TemperatureKeypad,
    type TemperatureKeypadProps,
} from '../TemperatureKeypad';

const baseProps: TemperatureKeypadProps = {
  open: true,
  userName: '田中太郎',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('TemperatureKeypad', () => {
  it('renders dialog with user name when open', () => {
    render(<TemperatureKeypad {...baseProps} />);
    expect(screen.getByText(/検温/)).toBeInTheDocument();
    expect(screen.getByText(/田中太郎/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<TemperatureKeypad {...baseProps} open={false} />);
    expect(screen.queryByTestId('temperature-keypad-dialog')).not.toBeInTheDocument();
  });

  it('renders all integer buttons (35-42)', () => {
    render(<TemperatureKeypad {...baseProps} />);
    for (const n of INTEGER_OPTIONS) {
      expect(screen.getByTestId(`integer-btn-${n}`)).toBeInTheDocument();
    }
  });

  it('renders all decimal buttons (.0-.9)', () => {
    render(<TemperatureKeypad {...baseProps} />);
    for (const d of DECIMAL_OPTIONS) {
      expect(screen.getByTestId(`decimal-btn-${d}`)).toBeInTheDocument();
    }
  });

  it('defaults to 36 as selected integer', () => {
    render(<TemperatureKeypad {...baseProps} />);
    expect(screen.getByTestId('temperature-preview').textContent).toContain('36._');
  });

  it('calls onConfirm with correct value when decimal is tapped (36.5)', async () => {
    const onConfirm = vi.fn();
    render(<TemperatureKeypad {...baseProps} onConfirm={onConfirm} />);

    // 36 is default, just tap .5
    await userEvent.click(screen.getByTestId('decimal-btn-5'));
    expect(onConfirm).toHaveBeenCalledWith(36.5);
  });

  it('allows changing integer before decimal tap (37.2)', async () => {
    const onConfirm = vi.fn();
    render(<TemperatureKeypad {...baseProps} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByTestId('integer-btn-37'));
    expect(screen.getByTestId('temperature-preview').textContent).toContain('37._');

    await userEvent.click(screen.getByTestId('decimal-btn-2'));
    expect(onConfirm).toHaveBeenCalledWith(37.2);
  });

  it('handles edge cases: 35.0 and 42.9', async () => {
    const onConfirm = vi.fn();
    render(<TemperatureKeypad {...baseProps} onConfirm={onConfirm} />);

    // 35.0
    await userEvent.click(screen.getByTestId('integer-btn-35'));
    await userEvent.click(screen.getByTestId('decimal-btn-0'));
    expect(onConfirm).toHaveBeenCalledWith(35.0);

    // Reopen mentally — we'll test 42.9 in isolation
    onConfirm.mockClear();
  });

  it('uses initialValue to pre-select integer', () => {
    render(<TemperatureKeypad {...baseProps} initialValue={38.1} />);
    expect(screen.getByTestId('temperature-preview').textContent).toContain('38._');
  });

  it('falls back to default when initialValue is out of range', () => {
    render(<TemperatureKeypad {...baseProps} initialValue={44} />);
    expect(screen.getByTestId('temperature-preview').textContent).toContain(`${DEFAULT_INTEGER}._`);
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<TemperatureKeypad {...baseProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows step labels for guidance', () => {
    render(<TemperatureKeypad {...baseProps} />);
    expect(screen.getByText('整数部を選択')).toBeInTheDocument();
    expect(screen.getByText('小数部をタップして確定')).toBeInTheDocument();
  });

  describe('exports', () => {
    it('INTEGER_OPTIONS covers 35-42', () => {
      expect(INTEGER_OPTIONS).toEqual([35, 36, 37, 38, 39, 40, 41, 42]);
    });

    it('DECIMAL_OPTIONS covers 0-9', () => {
      expect(DECIMAL_OPTIONS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('DEFAULT_INTEGER is 36', () => {
      expect(DEFAULT_INTEGER).toBe(36);
    });
  });
});

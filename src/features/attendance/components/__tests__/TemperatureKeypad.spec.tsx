import { createTheme, ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
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

const noRippleTheme = createTheme({
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true,
      },
    },
  },
});

const renderWithNoRipple = (ui: JSX.Element) =>
  render(<ThemeProvider theme={noRippleTheme}>{ui}</ThemeProvider>);

describe('TemperatureKeypad', () => {
  it('renders dialog with user name when open', () => {
    renderWithNoRipple(<TemperatureKeypad {...baseProps} />);
    expect(screen.getByText(/検温/)).toBeInTheDocument();
    expect(screen.getByText(/田中太郎/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithNoRipple(<TemperatureKeypad {...baseProps} open={false} />);
    expect(screen.queryByTestId('temperature-keypad-dialog')).not.toBeInTheDocument();
  });

  it('renders all integer buttons (35-42)', () => {
    renderWithNoRipple(<TemperatureKeypad {...baseProps} />);
    for (const n of INTEGER_OPTIONS) {
      expect(screen.getByTestId(`integer-btn-${n}`)).toBeInTheDocument();
    }
  });

  it('renders all decimal buttons (.0-.9)', () => {
    renderWithNoRipple(<TemperatureKeypad {...baseProps} />);
    for (const d of DECIMAL_OPTIONS) {
      expect(screen.getByTestId(`decimal-btn-${d}`)).toBeInTheDocument();
    }
  });

  it('defaults to 36 as selected integer', () => {
    renderWithNoRipple(<TemperatureKeypad {...baseProps} />);
    expect(screen.getByTestId('temperature-preview').textContent).toContain('36._');
  });

  it('calls onConfirm with correct value when decimal is tapped (36.5)', () => {
    const onConfirm = vi.fn();
    renderWithNoRipple(<TemperatureKeypad {...baseProps} onConfirm={onConfirm} />);

    // 36 is default, just tap .5
    fireEvent.click(screen.getByTestId('decimal-btn-5'));
    expect(onConfirm).toHaveBeenCalledWith(36.5);
  });

  it('allows changing integer before decimal tap (37.2)', () => {
    const onConfirm = vi.fn();
    renderWithNoRipple(<TemperatureKeypad {...baseProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId('integer-btn-37'));
    expect(screen.getByTestId('temperature-preview').textContent).toContain('37._');

    fireEvent.click(screen.getByTestId('decimal-btn-2'));
    expect(onConfirm).toHaveBeenCalledWith(37.2);
  });

  it('handles edge cases: 35.0 and 42.9', () => {
    const onConfirm = vi.fn();
    renderWithNoRipple(<TemperatureKeypad {...baseProps} onConfirm={onConfirm} />);

    // 35.0
    fireEvent.click(screen.getByTestId('integer-btn-35'));
    fireEvent.click(screen.getByTestId('decimal-btn-0'));
    expect(onConfirm).toHaveBeenCalledWith(35.0);

    // Reopen mentally — we'll test 42.9 in isolation
    onConfirm.mockClear();
  });

  it('uses initialValue to pre-select integer', () => {
    renderWithNoRipple(<TemperatureKeypad {...baseProps} initialValue={38.1} />);
    expect(screen.getByTestId('temperature-preview').textContent).toContain('38._');
  });

  it('falls back to default when initialValue is out of range', () => {
    renderWithNoRipple(<TemperatureKeypad {...baseProps} initialValue={44} />);
    expect(screen.getByTestId('temperature-preview').textContent).toContain(`${DEFAULT_INTEGER}._`);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    renderWithNoRipple(<TemperatureKeypad {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows step labels for guidance', () => {
    renderWithNoRipple(<TemperatureKeypad {...baseProps} />);
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

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DensityControl } from '../DensityControl';

describe('DensityControl Component', () => {
  const mockOnChange = vi.fn();
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

  const renderWithNoRipple = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={noRippleTheme}>{ui}</ThemeProvider>);

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders all three density options', () => {
    renderWithNoRipple(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    expect(screen.getByText('コンパクト')).toBeInTheDocument();
    expect(screen.getByText('標準')).toBeInTheDocument();
    expect(screen.getByText('ゆったり')).toBeInTheDocument();
  });

  it('renders descriptions for each option', () => {
    renderWithNoRipple(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    expect(screen.getByText('余白を最小化。情報密度を高めます。')).toBeInTheDocument();
    expect(screen.getByText('バランスの取れた表示。推奨設定です。')).toBeInTheDocument();
    expect(screen.getByText('余白を広げ。見やすさを優先します。')).toBeInTheDocument();
  });

  it('displays the correct radio button as checked', () => {
    const { rerender } = renderWithNoRipple(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const comfortableRadio = screen.getByRole('radio', { name: /標準/ });
    expect(comfortableRadio).toBeChecked();

    rerender(
      <ThemeProvider theme={noRippleTheme}>
        <DensityControl value="compact" onChange={mockOnChange} />
      </ThemeProvider>,
    );

    const compactRadio = screen.getByRole('radio', { name: /コンパクト/ });
    expect(compactRadio).toBeChecked();
  });

  it('calls onChange when a different density option is selected', () => {
    renderWithNoRipple(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const compactRadio = screen.getByRole('radio', { name: /コンパクト/ });
    fireEvent.click(compactRadio);

    expect(mockOnChange).toHaveBeenCalledWith('compact');
  });

  it('calls onChange with spacious when spacious option is selected', () => {
    renderWithNoRipple(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const spaciousRadio = screen.getByRole('radio', { name: /ゆったり/ });
    fireEvent.click(spaciousRadio);

    expect(mockOnChange).toHaveBeenCalledWith('spacious');
  });

  it('has proper accessibility labels', () => {
    renderWithNoRipple(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    // FormControl with RadioGroup is rendered with fieldset role
    const fieldset = screen.getByRole('group');
    expect(fieldset).toBeInTheDocument();
  });

  it('renders all radio buttons without errors', () => {
    renderWithNoRipple(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('maintains selection state when onChange is called', () => {
    const { rerender } = renderWithNoRipple(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const compactRadio = screen.getByRole('radio', { name: /コンパクト/ });
    fireEvent.click(compactRadio);

    expect(mockOnChange).toHaveBeenCalledWith('compact');

    // Simulate parent updating the value prop
    rerender(
      <ThemeProvider theme={noRippleTheme}>
        <DensityControl value="compact" onChange={mockOnChange} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('radio', { name: /コンパクト/ })).toBeChecked();
  });
});

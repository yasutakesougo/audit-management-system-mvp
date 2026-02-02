import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DensityControl } from '../DensityControl';

describe('DensityControl Component', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders all three density options', () => {
    render(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    expect(screen.getByText('コンパクト')).toBeInTheDocument();
    expect(screen.getByText('標準')).toBeInTheDocument();
    expect(screen.getByText('ゆったり')).toBeInTheDocument();
  });

  it('renders descriptions for each option', () => {
    render(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    expect(screen.getByText('余白を最小化。情報密度を高めます。')).toBeInTheDocument();
    expect(screen.getByText('バランスの取れた表示。推奨設定です。')).toBeInTheDocument();
    expect(screen.getByText('余白を広げ。見やすさを優先します。')).toBeInTheDocument();
  });

  it('displays the correct radio button as checked', () => {
    const { rerender } = render(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const comfortableRadio = screen.getByRole('radio', { name: /標準/ });
    expect(comfortableRadio).toBeChecked();

    rerender(
      <DensityControl value="compact" onChange={mockOnChange} />
    );

    const compactRadio = screen.getByRole('radio', { name: /コンパクト/ });
    expect(compactRadio).toBeChecked();
  });

  it('calls onChange when a different density option is selected', async () => {
    const user = userEvent.setup();
    render(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const compactRadio = screen.getByRole('radio', { name: /コンパクト/ });
    await user.click(compactRadio);

    expect(mockOnChange).toHaveBeenCalledWith('compact');
  });

  it('calls onChange with spacious when spacious option is selected', async () => {
    const user = userEvent.setup();
    render(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const spaciousRadio = screen.getByRole('radio', { name: /ゆったり/ });
    await user.click(spaciousRadio);

    expect(mockOnChange).toHaveBeenCalledWith('spacious');
  });

  it('has proper accessibility labels', () => {
    render(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    // FormControl with RadioGroup is rendered with fieldset role
    const fieldset = screen.getByRole('group');
    expect(fieldset).toBeInTheDocument();
  });

  it('renders all radio buttons without errors', () => {
    render(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('maintains selection state when onChange is called', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DensityControl value="comfortable" onChange={mockOnChange} />
    );

    const compactRadio = screen.getByRole('radio', { name: /コンパクト/ });
    await user.click(compactRadio);

    expect(mockOnChange).toHaveBeenCalledWith('compact');

    // Simulate parent updating the value prop
    rerender(
      <DensityControl value="compact" onChange={mockOnChange} />
    );

    expect(screen.getByRole('radio', { name: /コンパクト/ })).toBeChecked();
  });
});

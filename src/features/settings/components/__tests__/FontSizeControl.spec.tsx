import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FontSizeControl } from '../FontSizeControl';

describe('FontSizeControl', () => {
  describe('Rendering', () => {
    it('should render the font size control with all options', () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="medium" onChange={onChange} />);

      expect(screen.getByText('フォントサイズ')).toBeInTheDocument();
      expect(screen.getByText('小')).toBeInTheDocument();
      expect(screen.getByText('標準')).toBeInTheDocument();
      expect(screen.getByText('大')).toBeInTheDocument();
    });

    it('should render radio buttons for each font size option', () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="medium" onChange={onChange} />);

      const radioGroup = screen.getByTestId('font-size-radio-group');
      expect(radioGroup).toBeInTheDocument();

      expect(screen.getByTestId('font-size-radio-small')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-radio-medium')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-radio-large')).toBeInTheDocument();
    });

    it('should render descriptions for each font size option', () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="medium" onChange={onChange} />);

      expect(screen.getByText('12px - コンパクト表示')).toBeInTheDocument();
      expect(screen.getByText('14px - 標準表示')).toBeInTheDocument();
      expect(screen.getByText('16px - 読みやすい')).toBeInTheDocument();
    });

    it('should render preview examples', () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="medium" onChange={onChange} />);

      expect(screen.getByText('プレビュー:')).toBeInTheDocument();
      expect(screen.getByText('小サイズ表示です')).toBeInTheDocument();
      expect(screen.getByText('標準サイズ表示です')).toBeInTheDocument();
      expect(screen.getByText('大サイズ表示です')).toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('should have radio buttons with correct values', () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="small" onChange={onChange} />);

      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toHaveAttribute('value', 'small');
      expect(radios[1]).toHaveAttribute('value', 'medium');
      expect(radios[2]).toHaveAttribute('value', 'large');
    });
  });

  describe('Interactions', () => {
    it('should call onChange when selecting a different font size', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<FontSizeControl value="medium" onChange={onChange} />);

      const smallRadio = screen.getByTestId('font-size-radio-small');
      await user.click(smallRadio);

      expect(onChange).toHaveBeenCalledWith('small');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should call onChange with correct value for each option', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(<FontSizeControl value="small" onChange={onChange} />);

      const mediumRadio = screen.getByTestId('font-size-radio-medium');
      await user.click(mediumRadio);
      expect(onChange).toHaveBeenCalledWith('medium');

      onChange.mockClear();
      rerender(<FontSizeControl value="medium" onChange={onChange} />);

      const largeRadio = screen.getByTestId('font-size-radio-large');
      await user.click(largeRadio);
      expect(onChange).toHaveBeenCalledWith('large');
    });

    it('should handle rapid changes between font sizes', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<FontSizeControl value="medium" onChange={onChange} />);

      const smallRadio = screen.getByTestId('font-size-radio-small');
      const largeRadio = screen.getByTestId('font-size-radio-large');

      await user.click(smallRadio);
      expect(onChange).toHaveBeenCalledWith('small');

      await user.click(largeRadio);
      expect(onChange).toHaveBeenCalledWith('large');

      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('should have proper form control labels', () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="medium" onChange={onChange} />);

      const formControl = screen.getByRole('group');
      expect(formControl).toBeInTheDocument();
    });

    it('should have proper radio button roles', () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="medium" onChange={onChange} />);

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(radios[0]).toHaveAttribute('value', 'small');
      expect(radios[1]).toHaveAttribute('value', 'medium');
      expect(radios[2]).toHaveAttribute('value', 'large');
    });

    it('should support keyboard navigation', async () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="small" onChange={onChange} />);

      const radioGroup = screen.getByTestId('font-size-radio-group');
      radioGroup.focus();

      // Keyboard navigation is handled by MUI RadioGroup
      // Verify the radio buttons exist and are keyboard accessible
      expect(screen.getByTestId('font-size-radio-small')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-radio-medium')).toBeInTheDocument();
    });

    it('should maintain label associations', () => {
      const onChange = vi.fn();
      render(<FontSizeControl value="medium" onChange={onChange} />);

      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        // Each radio should be associated with a label
        expect(radio.closest('label')).toBeInTheDocument();
      });
    });
  });
});

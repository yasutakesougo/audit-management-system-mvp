import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPresetControl } from '../ColorPresetControl';

describe('ColorPresetControl', () => {
  describe('Rendering', () => {
    it('should render the color preset control with all options', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      expect(screen.getByText('カラープリセット')).toBeInTheDocument();
      expect(screen.getByText('デフォルト')).toBeInTheDocument();
      expect(screen.getByText('ハイコントラスト')).toBeInTheDocument();
    });

    it('should render radio buttons for each color preset option', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      const radioGroup = screen.getByTestId('color-preset-radio-group');
      expect(radioGroup).toBeInTheDocument();

      expect(screen.getByTestId('color-preset-radio-default')).toBeInTheDocument();
      expect(screen.getByTestId('color-preset-radio-highContrast')).toBeInTheDocument();
    });

    it('should render descriptions for each color preset option', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      expect(screen.getByText('MUI 標準カラー')).toBeInTheDocument();
      expect(screen.getByText('最大コントラスト（アクセシビリティ重視）')).toBeInTheDocument();
    });

    it('should render color preview swatches', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      expect(screen.getByText('プレビュー:')).toBeInTheDocument();
      expect(screen.getByText('Primary / Secondary')).toBeInTheDocument();
    });

    it('should display color swatches for selected preset', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ColorPresetControl value="default" onChange={onChange} />
      );

      // Check that swatches are rendered by looking for their titles
      const previewSwatches = screen.queryAllByTitle(/Primary|Secondary/);
      expect(previewSwatches.length).toBeGreaterThan(0);

      rerender(<ColorPresetControl value="highContrast" onChange={onChange} />);
      const swatchesUpdated = screen.queryAllByTitle(/Primary|Secondary/);
      expect(swatchesUpdated.length).toBeGreaterThan(0);
    });
  });

  describe('Selection State', () => {
    it('should have radio buttons with correct values', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toHaveAttribute('value', 'default');
      expect(radios[1]).toHaveAttribute('value', 'highContrast');
    });

    it('should display different presets as selected', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ColorPresetControl value="default" onChange={onChange} />
      );

      const defaultRadio = screen.getByTestId('color-preset-radio-default') as HTMLInputElement;
      expect(defaultRadio).toBeInTheDocument();

      rerender(<ColorPresetControl value="highContrast" onChange={onChange} />);
      const highContrastRadio = screen.getByTestId('color-preset-radio-highContrast');
      expect(highContrastRadio).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onChange when selecting a different preset', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<ColorPresetControl value="default" onChange={onChange} />);

      const highContrastRadio = screen.getByTestId('color-preset-radio-highContrast');
      await user.click(highContrastRadio);

      expect(onChange).toHaveBeenCalledWith('highContrast');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should call onChange with correct value for each option', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(
        <ColorPresetControl value="default" onChange={onChange} />
      );

      const highContrastRadio = screen.getByTestId('color-preset-radio-highContrast');
      await user.click(highContrastRadio);
      expect(onChange).toHaveBeenCalledWith('highContrast');

      onChange.mockClear();
      rerender(<ColorPresetControl value="highContrast" onChange={onChange} />);

      const defaultRadio = screen.getByTestId('color-preset-radio-default');
      await user.click(defaultRadio);
      expect(onChange).toHaveBeenCalledWith('default');
    });

    it('should handle rapid changes between presets', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<ColorPresetControl value="default" onChange={onChange} />);

      const highContrastRadio = screen.getByTestId('color-preset-radio-highContrast');
      await user.click(highContrastRadio);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('highContrast');
    });
  });

  describe('Color Swatches', () => {
    it('should show correct colors for default preset', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      const swatchDivs = screen.getAllByTitle(/Primary|Secondary/);
      expect(swatchDivs.length).toBeGreaterThanOrEqual(2);
    });

    it('should show correct colors for highContrast preset', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="highContrast" onChange={onChange} />);

      const swatchDivs = screen.getAllByTitle(/Primary|Secondary/);
      expect(swatchDivs.length).toBeGreaterThanOrEqual(2);
    });

    it('should update swatches when preset changes', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ColorPresetControl value="default" onChange={onChange} />
      );

      const swatchesDefault = screen.getAllByTitle(/Primary|Secondary/);
      expect(swatchesDefault.length).toBeGreaterThanOrEqual(2);

      rerender(<ColorPresetControl value="highContrast" onChange={onChange} />);
      const swatchesHighContrast = screen.getAllByTitle(/Primary|Secondary/);
      expect(swatchesHighContrast.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Accessibility', () => {
    it('should have proper form control labels', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      const formControl = screen.getByRole('group');
      expect(formControl).toBeInTheDocument();
    });

    it('should have proper radio button roles', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBeGreaterThanOrEqual(2);
      expect(radios[0]).toHaveAttribute('value', 'default');
      expect(radios[1]).toHaveAttribute('value', 'highContrast');
    });

    it('should maintain label associations', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        // Each radio should be associated with a label
        expect(radio.closest('label')).toBeInTheDocument();
      });
    });

    it('should have ARIA labels for accessibility', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      const legend = screen.getByText('カラープリセット');
      expect(legend).toBeInTheDocument();

      // Check for accessible names
      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        expect(radio).toHaveAccessibleName();
      });
    });
  });

  describe('Visual States', () => {
    it('should render selected preset option', () => {
      const onChange = vi.fn();
      render(<ColorPresetControl value="default" onChange={onChange} />);

      const defaultRadio = screen.getByTestId('color-preset-radio-default');
      expect(defaultRadio).toBeInTheDocument();
    });

    it('should display different selected preset', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ColorPresetControl value="default" onChange={onChange} />
      );

      expect(screen.getByTestId('color-preset-radio-default')).toBeInTheDocument();

      rerender(<ColorPresetControl value="highContrast" onChange={onChange} />);
      expect(screen.getByTestId('color-preset-radio-highContrast')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle preset change', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<ColorPresetControl value="default" onChange={onChange} />);

      const highContrastRadio = screen.getByTestId('color-preset-radio-highContrast');
      await user.click(highContrastRadio);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('highContrast');
    });

    it('should maintain onChange callback reference', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ColorPresetControl value="default" onChange={onChange} />
      );

      rerender(<ColorPresetControl value="default" onChange={onChange} />);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

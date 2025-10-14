import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FormField } from '@/ui/components/FormField';

describe('FormField', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders required indicator and hint with custom classes', () => {
    render(
      <FormField
        label="氏名"
        required
        hint="入力例：山田 太郎"
        className="field"
        labelClassName="label"
        hintClassName="hint"
      >
        {(id) => <input id={id} data-testid="field-input" />}
      </FormField>
    );

  const input = screen.getByTestId('field-input');
  expect(input).toBeInTheDocument();

  const label = screen.getByText((content, element) => element?.tagName === 'LABEL' && content.includes('氏名'));
  expect(label.className).toContain('label');
  expect(label.textContent).toContain('*');

  const requiredBadge = screen.getByText('（必須）');
    expect(requiredBadge).toBeInTheDocument();

    const hint = screen.getByText('入力例：山田 太郎');
    expect(hint.className).toContain('hint');
  });

  it('omits required indicator and hint when not provided', () => {
    render(
      <FormField label="備考">
        {(id) => <textarea id={id} data-testid="notes-input" />}
      </FormField>
    );

    expect(screen.getByTestId('notes-input')).toBeInTheDocument();
    const label = screen.getByText((content, element) => element?.tagName === 'LABEL' && content.includes('備考'));
    expect(label.querySelector('span[aria-hidden="true"]')).toBeNull();
    expect(label.textContent).not.toContain('*');
    expect(screen.queryByText('（必須）')).toBeNull();
  });
});

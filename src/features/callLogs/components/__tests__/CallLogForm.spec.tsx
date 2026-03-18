/**
 * CallLogForm — バリデーション / submit 動作テスト
 *
 * 対象:
 *   - 必須フィールド未入力時にエラーメッセージが表示されること
 *   - 全フィールド入力時に onSubmit が正しい値で呼ばれること
 *   - needCallback=true 時に callbackDueAt フィールドが現れること
 *   - isSubmitting=true 時にボタンが無効化されること
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CallLogForm } from '../CallLogForm';

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function fillRequired() {
  fireEvent.change(screen.getByTestId('call-log-form-caller-name'), {
    target: { value: '田中太郎' },
  });
  fireEvent.change(screen.getByTestId('call-log-form-target-staff'), {
    target: { value: '山田スタッフ' },
  });
  fireEvent.change(screen.getByTestId('call-log-form-subject'), {
    target: { value: 'テスト件名' },
  });
  fireEvent.change(screen.getByTestId('call-log-form-message'), {
    target: { value: 'テスト本文' },
  });
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('CallLogForm', () => {
  it('should render without crashing', () => {
    render(<CallLogForm onSubmit={vi.fn()} />);
    expect(screen.getByTestId('call-log-form')).toBeInTheDocument();
  });

  it('should show validation errors when required fields are empty on submit', async () => {
    render(<CallLogForm onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByTestId('call-log-form-submit'));

    await waitFor(() => {
      // MUI TextField は error 時に aria-invalid="true" を付与する
      const invalidFields = document.querySelectorAll('[aria-invalid="true"]');
      expect(invalidFields.length).toBeGreaterThan(0);
    });
  });

  it('should call onSubmit with correct values when all required fields are filled', async () => {
    const onSubmit = vi.fn();
    render(<CallLogForm onSubmit={onSubmit} />);

    fillRequired();

    fireEvent.click(screen.getByTestId('call-log-form-submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const args = onSubmit.mock.calls[0][0];
      expect(args.callerName).toBe('田中太郎');
      expect(args.targetStaffName).toBe('山田スタッフ');
      expect(args.subject).toBe('テスト件名');
      expect(args.message).toBe('テスト本文');
      expect(args.status).toBeUndefined(); // フォームは status を持たない
    });
  });

  it('should show callbackDueAt field only when needCallback is checked', async () => {
    render(<CallLogForm onSubmit={vi.fn()} />);

    // 最初は非表示
    expect(screen.queryByTestId('call-log-form-callback-due')).not.toBeInTheDocument();

    // チェック
    fireEvent.click(screen.getByTestId('call-log-form-need-callback'));

    await waitFor(() => {
      expect(screen.getByTestId('call-log-form-callback-due')).toBeInTheDocument();
    });
  });

  it('should disable submit button when isSubmitting=true', () => {
    render(<CallLogForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(screen.getByTestId('call-log-form-submit')).toBeDisabled();
  });

  it('should show cancel button and call onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<CallLogForm onSubmit={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('call-log-form-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should default urgency to "normal"', () => {
    render(<CallLogForm onSubmit={vi.fn()} />);

    const normalRadio = screen.getByDisplayValue('normal') as HTMLInputElement;
    expect(normalRadio.checked).toBe(true);
  });
});

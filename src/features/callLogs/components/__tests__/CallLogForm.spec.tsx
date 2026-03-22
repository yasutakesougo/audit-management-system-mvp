/**
 * CallLogForm — バリデーション / submit 動作テスト
 *
 * 対象:
 *   - 必須フィールド未入力時にエラーメッセージが表示されること
 *   - 全フィールド入力時に onSubmit が正しい値で呼ばれること
 *   - needCallback=true 時に callbackDueAt フィールドが現れること
 *   - isSubmitting=true 時にボタンが無効化されること
 *   - 利用者選択 UI（Autocomplete）の動作
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CallLogForm } from '../CallLogForm';
import type { IUserMaster } from '@/features/users/types';

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

const MOCK_USERS: IUserMaster[] = [
  { Id: 1, UserID: 'U001', FullName: '利用者A', Furigana: 'リヨウシャエー' },
  { Id: 2, UserID: 'U002', FullName: '利用者B', Furigana: 'リヨウシャビー' },
  { Id: 3, UserID: 'U003', FullName: '利用者C', Furigana: null },
] as IUserMaster[];

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

  // ─── 利用者選択 UI テスト ──────────────────────────────────────────────────

  it('should render the related user autocomplete', () => {
    render(<CallLogForm onSubmit={vi.fn()} users={MOCK_USERS} />);

    expect(screen.getByTestId('call-log-form-related-user-autocomplete')).toBeInTheDocument();
    expect(screen.getByTestId('call-log-form-related-user')).toBeInTheDocument();
  });

  it('should submit without relatedUserId when no user is selected', async () => {
    const onSubmit = vi.fn();
    render(<CallLogForm onSubmit={onSubmit} users={MOCK_USERS} />);

    fillRequired();
    fireEvent.click(screen.getByTestId('call-log-form-submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const args = onSubmit.mock.calls[0][0];
      expect(args.relatedUserId).toBeUndefined();
      expect(args.relatedUserName).toBeUndefined();
    });
  });

  it('should include relatedUserId/relatedUserName when a user is selected', async () => {
    const onSubmit = vi.fn();

    render(<CallLogForm onSubmit={onSubmit} users={MOCK_USERS} />);

    fillRequired();

    // Autocomplete を操作
    const input = screen.getByTestId('call-log-form-related-user');
    fireEvent.mouseDown(input);
    fireEvent.change(input, { target: { value: '利用者A' } });

    // ドロップダウンから選択
    await waitFor(() => {
      expect(screen.getByText(/利用者A/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/利用者A/));

    fireEvent.click(screen.getByTestId('call-log-form-submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const args = onSubmit.mock.calls[0][0];
      expect(args.relatedUserId).toBe('U001');
      expect(args.relatedUserName).toBe('利用者A');
    });
  });
});

/**
 * CallLogQuickDrawer — 破棄確認 (discard confirmation) テスト
 *
 * 対象:
 *   - dirty でない場合は ConfirmDialog なしに即 onClose が呼ばれること
 *   - dirty の場合は ConfirmDialog が表示され、「破棄して閉じる」で onClose が呼ばれること
 *   - dirty の場合、「入力に戻る」を選ぶと onClose が呼ばれないこと
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CallLogQuickDrawer } from '../CallLogQuickDrawer';

// ─── モック ──────────────────────────────────────────────────────────────────

// InMemory repository を使用させる
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    shouldSkipSharePoint: vi.fn(() => true),
  };
});

// useAuth モック (useCallLogs.spec と同パターン)
vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({
    acquireToken: async () => null,
    account: { name: 'テストユーザー' },
  })),
}));

// useToast はダミー実装
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

// ─── テストラッパー ───────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('CallLogQuickDrawer — 破棄確認', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClose: any;
  let onClose: () => void;

  beforeEach(() => {
    mockClose = vi.fn();
    onClose = () => mockClose();
  });

  it('should call onClose immediately when form is not dirty', async () => {
    const wrapper = makeWrapper();
    await act(async () => {
      render(<CallLogQuickDrawer open={true} onClose={onClose} />, { wrapper });
    });

    // フォームに何も入力せずにXボタンを押す（not dirty）
    await act(async () => {
      fireEvent.click(screen.getByTestId('call-log-drawer-close'));
    });

    // ConfirmDialog は表示されず、即 onClose が呼ばれる
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should show ConfirmDialog when form is dirty and close button is clicked', async () => {
    const wrapper = makeWrapper();
    await act(async () => {
      render(<CallLogQuickDrawer open={true} onClose={onClose} />, { wrapper });
    });

    // フォームを dirty にする（発信者名を入力）
    await act(async () => {
      fireEvent.change(screen.getByTestId('call-log-form-caller-name'), {
        target: { value: '田中太郎' },
      });
    });

    // Xボタンを押す（dirty なので確認ダイアログが表示されるはず）
    await act(async () => {
      fireEvent.click(screen.getByTestId('call-log-drawer-close'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    // onClose はまだ呼ばれていない
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('should call onClose when "破棄して閉じる" is confirmed', async () => {
    const wrapper = makeWrapper();
    await act(async () => {
      render(<CallLogQuickDrawer open={true} onClose={onClose} />, { wrapper });
    });

    // dirty にする
    await act(async () => {
      fireEvent.change(screen.getByTestId('call-log-form-caller-name'), {
        target: { value: '田中太郎' },
      });
    });

    // 閉じようとする
    await act(async () => {
      fireEvent.click(screen.getByTestId('call-log-drawer-close'));
    });
    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument());

    // 「破棄して閉じる」を確認
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    });

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should NOT call onClose when "入力に戻る" (cancel) is clicked in ConfirmDialog', async () => {
    const wrapper = makeWrapper();
    await act(async () => {
      render(<CallLogQuickDrawer open={true} onClose={onClose} />, { wrapper });
    });

    // dirty にする
    await act(async () => {
      fireEvent.change(screen.getByTestId('call-log-form-caller-name'), {
        target: { value: '田中太郎' },
      });
    });

    // 閉じようとする
    await act(async () => {
      fireEvent.click(screen.getByTestId('call-log-drawer-close'));
    });
    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument());

    // 「入力に戻る」を押す
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    });

    await waitFor(() => {
      // ConfirmDialog が閉じる
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    // onClose は呼ばれていない
    expect(mockClose).not.toHaveBeenCalled();
  });
});

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';

describe('useConfirmDialog', () => {
  it('初期状態は閉じている', () => {
    const { result } = renderHook(() => useConfirmDialog());
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('open() でダイアログが開き、パラメータが反映される', () => {
    const { result } = renderHook(() => useConfirmDialog());

    act(() => {
      result.current.open({
        title: '削除確認',
        message: '本当に削除しますか？',
        severity: 'error',
        confirmLabel: '削除',
        onConfirm: () => {},
      });
    });

    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.title).toBe('削除確認');
    expect(result.current.dialogProps.message).toBe('本当に削除しますか？');
    expect(result.current.dialogProps.severity).toBe('error');
    expect(result.current.dialogProps.confirmLabel).toBe('削除');
  });

  it('onCancel でダイアログが閉じる', () => {
    const { result } = renderHook(() => useConfirmDialog());

    act(() => {
      result.current.open({
        title: 'テスト',
        message: 'テスト',
        onConfirm: () => {},
      });
    });
    expect(result.current.dialogProps.open).toBe(true);

    act(() => {
      result.current.dialogProps.onCancel();
    });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('onConfirm で onConfirmAction が呼ばれ、ダイアログが閉じる', async () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useConfirmDialog());

    act(() => {
      result.current.open({
        title: 'テスト',
        message: 'テスト',
        onConfirm,
      });
    });

    await act(async () => {
      await result.current.dialogProps.onConfirm();
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('async onConfirm 中は busy=true になる', async () => {
    let resolvePromise: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => { resolvePromise = r; }));
    const { result } = renderHook(() => useConfirmDialog());

    act(() => {
      result.current.open({
        title: 'テスト',
        message: 'テスト',
        onConfirm,
      });
    });

    // Confirm を呼ぶ（Promise未解決で busy になるはず）
    let confirmPromise: Promise<void>;
    act(() => {
      confirmPromise = result.current.dialogProps.onConfirm();
    });

    expect(result.current.dialogProps.busy).toBe(true);

    // Promise を解決
    await act(async () => {
      resolvePromise!();
      await confirmPromise!;
    });

    expect(result.current.dialogProps.busy).toBe(false);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('デフォルト値が正しく設定される', () => {
    const { result } = renderHook(() => useConfirmDialog());

    act(() => {
      result.current.open({
        title: 'テスト',
        message: 'メッセージ',
        onConfirm: () => {},
      });
    });

    expect(result.current.dialogProps.severity).toBe('warning');
    expect(result.current.dialogProps.confirmLabel).toBe('OK');
    expect(result.current.dialogProps.cancelLabel).toBe('キャンセル');
  });
});

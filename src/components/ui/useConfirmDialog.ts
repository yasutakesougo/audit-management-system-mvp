/**
 * useConfirmDialog — ConfirmDialog の状態管理を簡略化するhook
 *
 * @example
 * const confirm = useConfirmDialog();
 *
 * // 開く
 * confirm.open({
 *   title: '削除確認',
 *   message: 'このテンプレートを削除しますか？',
 *   severity: 'error',
 *   confirmLabel: '削除',
 *   onConfirm: () => deleteTemplate(id),
 * });
 *
 * // JSX
 * <ConfirmDialog {...confirm.dialogProps} />
 */

import { useCallback, useState } from 'react';
import type { ConfirmDialogSeverity } from './ConfirmDialog';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  warningText?: string;
  severity: ConfirmDialogSeverity;
  confirmLabel: string;
  cancelLabel: string;
  onConfirmAction: (() => void) | (() => Promise<void>);
}

export interface OpenConfirmDialogParams {
  title: string;
  message: string;
  warningText?: string;
  severity?: ConfirmDialogSeverity;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (() => void) | (() => Promise<void>);
}

const initialState: ConfirmDialogState = {
  isOpen: false,
  title: '',
  message: '',
  severity: 'warning',
  confirmLabel: 'OK',
  cancelLabel: 'キャンセル',
  onConfirmAction: () => {},
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(initialState);
  const [busy, setBusy] = useState(false);

  const open = useCallback((params: OpenConfirmDialogParams) => {
    setState({
      isOpen: true,
      title: params.title,
      message: params.message,
      warningText: params.warningText,
      severity: params.severity ?? 'warning',
      confirmLabel: params.confirmLabel ?? 'OK',
      cancelLabel: params.cancelLabel ?? 'キャンセル',
      onConfirmAction: params.onConfirm,
    });
  }, []);

  const close = useCallback(() => {
    setState(initialState);
    setBusy(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await state.onConfirmAction();
    } finally {
      close();
    }
  }, [state.onConfirmAction, close]);

  const dialogProps = {
    open: state.isOpen,
    title: state.title,
    message: state.message,
    warningText: state.warningText,
    severity: state.severity,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    onConfirm: handleConfirm,
    onCancel: close,
    busy,
  } as const;

  return { open, close, dialogProps } as const;
}

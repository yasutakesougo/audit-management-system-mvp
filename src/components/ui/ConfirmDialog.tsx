/**
 * ConfirmDialog — MUI ベースの汎用確認ダイアログ
 *
 * window.confirm の代替として、プロジェクト全体で統一的に使用する。
 * 破壊的操作（削除・リセット）では severity="error" を指定し
 * 赤いボタンで注意を促す。
 *
 * @example
 * <ConfirmDialog
 *   open={!!deleteTarget}
 *   title="テンプレートを削除"
 *   message="削除後は元に戻せません。"
 *   severity="error"
 *   confirmLabel="削除"
 *   onConfirm={handleConfirm}
 *   onCancel={handleCancel}
 * />
 */

import React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

export type ConfirmDialogSeverity = 'warning' | 'error' | 'info';

export interface ConfirmDialogProps {
  /** ダイアログの表示状態 */
  open: boolean;
  /** タイトル */
  title: string;
  /** 本文メッセージ */
  message: string;
  /** 付加的な警告テキスト（Alert 内に表示） */
  warningText?: string;
  /** 危険度（ボタン色・Alert severity に影響） */
  severity?: ConfirmDialogSeverity;
  /** 確認ボタンのラベル（デフォルト: "OK"） */
  confirmLabel?: string;
  /** キャンセルボタンのラベル（デフォルト: "キャンセル"） */
  cancelLabel?: string;
  /** 確認時コールバック */
  onConfirm: () => void;
  /** キャンセル時コールバック */
  onCancel: () => void;
  /** 処理中フラグ（ボタン無効化） */
  busy?: boolean;
}

const severityToColor: Record<ConfirmDialogSeverity, 'warning' | 'error' | 'info'> = {
  warning: 'warning',
  error: 'error',
  info: 'info',
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  warningText,
  severity = 'warning',
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  onConfirm,
  onCancel,
  busy = false,
}) => (
  <Dialog
    open={open}
    onClose={busy ? undefined : onCancel}
    maxWidth="xs"
    fullWidth
    data-testid="confirm-dialog"
  >
    <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
    <DialogContent>
      <Typography variant="body2" sx={{ mb: warningText ? 1.5 : 0 }}>
        {message}
      </Typography>
      {warningText && (
        <Alert severity={severity} variant="outlined" sx={{ mt: 1 }}>
          {warningText}
        </Alert>
      )}
    </DialogContent>
    <DialogActions sx={{ px: 2, pb: 1.5 }}>
      <Button
        onClick={onCancel}
        disabled={busy}
        data-testid="confirm-dialog-cancel"
      >
        {cancelLabel}
      </Button>
      <Button
        variant="contained"
        color={severityToColor[severity]}
        onClick={onConfirm}
        disabled={busy}
        data-testid="confirm-dialog-confirm"
      >
        {busy ? '処理中...' : confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

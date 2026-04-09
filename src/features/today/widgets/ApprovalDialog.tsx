/**
 * ApprovalDialog — 承認確認モーダル
 *
 * Presentational component:
 * - 承認対象日付を表示
 * - 承認 / キャンセルボタン
 * - ローディング / エラー表示
 *
 * ロジックは useApprovalFlow Hook に委譲。
 */
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material';
import React from 'react';

export type ApprovalDialogProps = {
  open: boolean;
  targetDate: string;
  isApproving: boolean;
  error: string | null;
  onApprove: () => void;
  onClose: () => void;
};

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  open,
  targetDate,
  isApproving,
  error,
  onApprove,
  onClose,
}) => {
  const handleCloseWithFocusRelease = () => {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={isApproving ? undefined : handleCloseWithFocusRelease}
      maxWidth="xs"
      fullWidth
      disablePortal
      data-testid="approval-dialog"
    >
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        📋 日々の記録の承認
      </DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          <strong>{targetDate}</strong> の日々の記録を承認しますか？
        </DialogContentText>

        <DialogContentText variant="body2" color="text.secondary">
          承認すると、この日の記録が確定されます。
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }} data-testid="approval-error">
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleCloseWithFocusRelease}
          disabled={isApproving}
          data-testid="approval-cancel-btn"
        >
          キャンセル
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onApprove}
          disabled={isApproving}
          startIcon={isApproving ? <CircularProgress size={16} color="inherit" /> : undefined}
          data-testid="approval-confirm-btn"
          sx={{ minWidth: 100, fontWeight: 'bold' }}
        >
          {isApproving ? '承認中…' : '承認する'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

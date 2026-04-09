/**
 * ApprovalSection — ISP サビ管承認 UI
 *
 * F-1: ISP 承認フローの UI コンポーネント。
 * コンプライアンスタブ内に配置し、以下の機能を提供する:
 *   - 承認状態の表示（未承認 / 承認済み）
 *   - 承認ボタン（管理者のみ有効）
 *   - 承認済みの場合は承認者・承認日時を表示
 *   - 確認ダイアログによる誤操作防止
 */
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GppGoodIcon from '@mui/icons-material/GppGood';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type { ApprovalState } from '../../hooks/useComplianceForm';

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

export type ApprovalSectionProps = {
  /** 承認状態 */
  approvalState: ApprovalState;
  /** 管理者フラグ */
  isAdmin: boolean;
  /** 承認実行 */
  onApprove: () => void;
  /** 未入力警告がある場合 true */
  hasMissingFields: boolean;
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/**
 * ISO 8601 を日本語表示用にフォーマット
 */
function formatApprovalDate(isoString: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

const ApprovalSection: React.FC<ApprovalSectionProps> = ({
  approvalState,
  isAdmin,
  onApprove,
  hasMissingFields,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { isApproved, approvedBy, approvedAt } = approvalState;

  const handleApproveClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    onApprove();
  };

  const handleCancel = () => {
    setConfirmOpen(false);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" spacing={1} alignItems="center">
          <GppGoodIcon color={isApproved ? 'success' : 'action'} />
          <Typography variant="subtitle1" fontWeight="bold" color={isApproved ? 'success.main' : 'primary'}>
            ✍ サービス管理責任者 承認
          </Typography>
          <Chip
            label={isApproved ? '承認済み' : '未承認'}
            color={isApproved ? 'success' : 'default'}
            size="small"
            variant={isApproved ? 'filled' : 'outlined'}
            data-testid="approval-status-chip"
          />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          サービス管理責任者が個別支援計画の内容を確認し、承認を行います。
          承認は監査記録として保存されます。
        </Typography>

        {/* 承認済み表示 */}
        {isApproved && (
          <Alert
            severity="success"
            icon={<CheckCircleOutlineIcon />}
            data-testid="approval-success-alert"
          >
            <Typography variant="subtitle2" gutterBottom>
              承認済み
            </Typography>
            <Typography variant="body2">
              承認者: {approvedBy ?? '—'}
            </Typography>
            <Typography variant="body2">
              承認日時: {formatApprovalDate(approvedAt)}
            </Typography>
          </Alert>
        )}

        {/* 未承認時: 承認ボタン */}
        {!isApproved && (
          <Box>
            {hasMissingFields && (
              <Alert severity="info" sx={{ mb: 2 }} data-testid="approval-missing-warning">
                <Typography variant="body2">
                  未入力の項目があります。承認前にすべての項目を入力することを推奨します。
                </Typography>
              </Alert>
            )}

            <Button
              variant="contained"
              color="success"
              startIcon={<GppGoodIcon />}
              onClick={handleApproveClick}
              disabled={!isAdmin}
              data-testid="approval-button"
              sx={{ minWidth: 200 }}
            >
              {isAdmin ? 'サビ管承認を行う' : '承認権限がありません'}
            </Button>

            {!isAdmin && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                承認はサービス管理責任者（管理者）のみ行えます。
              </Typography>
            )}
          </Box>
        )}
      </Stack>

      {/* 確認ダイアログ */}
      <Dialog
        open={confirmOpen}
        onClose={handleCancel}
        aria-labelledby="approval-confirm-title"
        data-testid="approval-confirm-dialog"
      >
        <DialogTitle id="approval-confirm-title">
          承認の確認
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            この個別支援計画をサービス管理責任者として承認します。
            承認後は記録として保存され、取り消しできません。
            よろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} color="inherit" data-testid="approval-cancel-button">
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            color="success"
            variant="contained"
            autoFocus
            data-testid="approval-confirm-button"
          >
            承認する
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default React.memo(ApprovalSection);

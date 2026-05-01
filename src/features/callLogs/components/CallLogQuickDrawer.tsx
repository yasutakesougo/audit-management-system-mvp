/**
 * CallLogQuickDrawer — 電話ログ新規受付ドロワー
 *
 * 責務:
 * - Drawer / Dialog に CallLogForm を載せる
 * - createLog mutation の呼び出し
 * - 成功時: Drawer を閉じる + 成功 toast
 * - 失敗時: エラー表示（Drawer は開いたまま）
 * - window.confirm 不使用
 * - モバイル → Dialog fullScreen、デスクトップ → Drawer anchor="right"
 *
 * データ整合性（list 再取得）は useCallLogs の mutation onSuccess で保証済み。
 * このコンポーネントは操作体験だけに専念する。
 */

import CloseIcon from '@mui/icons-material/Close';
import PhoneIcon from '@mui/icons-material/Phone';
import {
  Alert,
  Box,
  Dialog,
  Drawer,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useRef, useState } from 'react';

import type { CreateCallLogInput } from '@/domain/callLogs/schema';
import { useCallLogs } from '@/features/callLogs/hooks/useCallLogs';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import { useToast } from '@/hooks/useToast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { CallLogForm } from './CallLogForm';

// ─── Props ────────────────────────────────────────────────────────────────────

export type CallLogQuickDrawerProps = {
  open: boolean;
  onClose: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CallLogQuickDrawer: React.FC<CallLogQuickDrawerProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { show } = useToast();

  const { createLog } = useCallLogs();
  const { data: users } = useUsersQuery();

  const [submitError, setSubmitError] = useState<string | null>(null);

  // dirty 判定: CallLogForm から通知を受け取り ref で追跡
  const isDirtyRef = useRef(false);
  const handleIsDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

  // 破棄確認ダイアログ
  const discardConfirm = useConfirmDialog();

  const releaseActiveFocus = useCallback(() => {
    if (typeof document === 'undefined') return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }, []);

  // Drawer/Dialog を閉じようとしたとき — dirty なら確認を挟む
  const handleCloseRequest = useCallback(() => {
    releaseActiveFocus();
    if (!isDirtyRef.current) {
      setSubmitError(null);
      onClose();
      return;
    }
    discardConfirm.open({
      title: '入力を破棄しますか？',
      message: '入力した内容が失われます。',
      severity: 'warning',
      confirmLabel: '破棄して閉じる',
      cancelLabel: '入力に戻る',
      onConfirm: () => {
        releaseActiveFocus();
        setSubmitError(null);
        isDirtyRef.current = false;
        onClose();
      },
    });
  }, [discardConfirm, onClose, releaseActiveFocus]);

  // submit ハンドラ
  const handleSubmit = useCallback(
    async (values: CreateCallLogInput) => {
      setSubmitError(null);
      try {
        await createLog.mutateAsync(values);
        show('success', '📞 電話ログを登録しました');
        isDirtyRef.current = false;
        releaseActiveFocus();
        onClose();
      } catch {
        setSubmitError('保存に失敗しました。ネットワークを確認して再試行してください。');
      }
    },
    [createLog, show, onClose, releaseActiveFocus],
  );

  // ── コンテンツ ────────────────────────────────────────────────────────────

  const content = (
    <Box
      data-testid="call-log-quick-drawer"
      sx={{
        width: isMobile ? '100%' : 480,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ヘッダー */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <PhoneIcon fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>
            電話・連絡ログ 新規受付
          </Typography>
        </Box>
        <IconButton
          onClick={handleCloseRequest}
          aria-label="ドロワーを閉じる"
          size="small"
          data-testid="call-log-drawer-close"
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* エラー表示（フォームの送信エラー） */}
      {submitError && (
        <Box px={2} pt={1.5}>
          <Alert severity="error" data-testid="call-log-drawer-error">
            {submitError}
          </Alert>
        </Box>
      )}

      {/* フォーム本体 */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default' }}>
        <CallLogForm
          isSubmitting={createLog.isPending}
          onSubmit={handleSubmit}
          onCancel={handleCloseRequest}
          onIsDirtyChange={handleIsDirtyChange}
          users={users}
        />
      </Box>
    </Box>
  );

  // ── モバイル: fullScreen Dialog ──────────────────────────────────────────

  if (isMobile) {
    return (
      <>
        <Dialog
          fullScreen
          open={open}
          onClose={handleCloseRequest}
          data-testid="call-log-quick-dialog"
        >
          {content}
        </Dialog>
        <ConfirmDialog {...discardConfirm.dialogProps} />
      </>
    );
  }

  // ── デスクトップ: Drawer anchor="right" ──────────────────────────────────

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleCloseRequest}
        data-testid="call-log-quick-drawer-root"
      >
        {content}
      </Drawer>
      <ConfirmDialog {...discardConfirm.dialogProps} />
    </>
  );
};

export default CallLogQuickDrawer;

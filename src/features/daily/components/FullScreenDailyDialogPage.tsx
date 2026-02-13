import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Toolbar,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

type FullScreenDailyDialogPageProps = {
  open?: boolean;
  title: string;
  backTo?: string;
  busy?: boolean;
  onClose?: () => void;
  testId?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

export function FullScreenDailyDialogPage({
  open = true,
  title,
  backTo = '/daily/menu',
  busy = false,
  onClose,
  testId,
  headerActions,
  children,
}: FullScreenDailyDialogPageProps) {
  const navigate = useNavigate();

  const handleClose = React.useCallback(() => {
    if (busy) return;
    if (onClose) return onClose();
    navigate(backTo, { replace: true });
  }, [busy, onClose, navigate, backTo]);

  const handleHubClick = React.useCallback(() => {
    navigate('/dailysupport');
  }, [navigate]);

  // ✅ 背景スクロール防止（フルスクリーン時に背面が動かないように）
  React.useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // ✅ Esc キーで戻る（Dialog 互換の UX）
  React.useEffect(() => {
    if (!open || busy) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, handleClose]);

  // ✅ Dialog → fixed Box に置換（root 構造最適化）
  if (!open) return null;

  return (
    <Box
      data-testid={testId}
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'background.default',
        zIndex: 1300,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Button
            onClick={handleClose}
            startIcon={<CloseIcon />}
            variant="text"
            size="large"
            sx={{ minWidth: 120 }}
            disabled={busy}
            data-testid="daily-dialog-close"
          >
            キャンセル
          </Button>

          <Typography sx={{ flex: 1 }} variant="h6">
            {title}
          </Typography>

          {headerActions}

          <Button
            onClick={handleHubClick}
            startIcon={<HomeOutlinedIcon />}
            variant="contained"
            size="large"
            sx={{ minWidth: 160 }}
          >
            日次ハブへ
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {children}
      </Box>
    </Box>
  );
}

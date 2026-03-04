import CloseIcon from '@mui/icons-material/Close';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import {
    AppBar,
    Box,
    Button,
    Toolbar,
    Typography,
} from '@mui/material';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

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
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar variant="dense" sx={{ gap: 0.5, minWidth: 0 }}>
          <Button
            onClick={handleClose}
            startIcon={<CloseIcon fontSize="small" />}
            variant="text"
            size="small"
            sx={{ minWidth: 90, fontSize: '0.8rem', flexShrink: 0 }}
            disabled={busy}
            data-testid="daily-dialog-close"
          >
            キャンセル
          </Button>

          <Typography
            sx={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            variant="subtitle1"
            component="h1"
            data-page-heading="true"
          >
            {title}
          </Typography>

          {headerActions}

          <Button
            onClick={handleHubClick}
            startIcon={<HomeOutlinedIcon fontSize="small" />}
            variant="outlined"
            size="small"
            sx={{ minHeight: 32, fontSize: '0.78rem', px: 1.5, flexShrink: 0 }}
          >
            日次ハブ
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
  );
}

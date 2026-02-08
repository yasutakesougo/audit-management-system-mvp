import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Dialog,
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
  children: React.ReactNode;
};

export function FullScreenDailyDialogPage({
  open = true,
  title,
  backTo = '/daily/menu',
  busy = false,
  onClose,
  testId,
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

  return (
    <Dialog fullScreen open={open} data-testid={testId}>
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

      <Box sx={{ p: 2 }}>
        {children}
      </Box>
    </Dialog>
  );
}

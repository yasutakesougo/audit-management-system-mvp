import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Dialog,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

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

  return (
    <Dialog fullScreen open={open} data-testid={testId}>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar variant="dense">
          <IconButton
            edge="start"
            aria-label="閉じる"
            onClick={handleClose}
            disabled={busy}
          >
            <CloseIcon />
          </IconButton>

          <Typography sx={{ ml: 1, flex: 1 }} variant="h6">
            {title}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        {children}
      </Box>
    </Dialog>
  );
}

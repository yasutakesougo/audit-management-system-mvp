/**
 * KioskExitFab — Long-press FAB with Action Sheet.
 *
 * 長押し 1.5 秒で「アクションシート」を表示。
 * 選択肢:
 *   - 通常モードに戻る
 *   - 再読み込み
 *   - キャンセル
 *
 * 設計:
 *   - 長押し中はプログレス表示（誤操作防止）
 *   - 完了時に Haptic フィードバック
 *   - アクションシートは画面中央にポップアップ
 */
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import React from 'react';

const HOLD_DURATION_MS = 1500;
const TICK_INTERVAL_MS = 50;

interface KioskExitFabProps {
  onExit: () => void;
  disablePortal?: boolean;
}

export const KioskExitFab: React.FC<KioskExitFabProps> = ({ onExit, disablePortal }) => {
  const [progress, setProgress] = React.useState(0);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = React.useRef<number>(0);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(0);
  }, []);

  const handleStart = React.useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / HOLD_DURATION_MS) * 100, 100);
      setProgress(pct);

      if (elapsed >= HOLD_DURATION_MS) {
        clearTimer();
        // Haptic feedback if available
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(100);
        }
        setSheetOpen(true);
      }
    }, TICK_INTERVAL_MS);
  }, [clearTimer]);

  const handleEnd = React.useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleExitToNormal = React.useCallback(() => {
    setSheetOpen(false);
    onExit();
  }, [onExit]);

  const handleReload = React.useCallback(() => {
    setSheetOpen(false);
    window.location.reload();
  }, []);

  const handleCancel = React.useCallback(() => {
    setSheetOpen(false);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: (t) => t.zIndex.modal + 1,
        }}
        data-testid="kiosk-exit-fab"
      >
        <Fab
          size="small"
          aria-label="長押しでメニューを表示"
          onPointerDown={handleStart}
          onPointerUp={handleEnd}
          onPointerLeave={handleEnd}
          onPointerCancel={handleEnd}
          sx={{
            opacity: progress > 0 ? 0.9 : 0.25,
            transition: 'opacity 0.3s ease',
            '&:hover': { opacity: 0.7 },
            bgcolor: 'background.paper',
            color: 'text.secondary',
          }}
        >
          {progress > 0 ? (
            <CircularProgress
              variant="determinate"
              value={progress}
              size={24}
              thickness={5}
              sx={{ color: 'primary.main' }}
            />
          ) : (
            <CloseFullscreenRoundedIcon fontSize="small" />
          )}
        </Fab>
      </Box>

      {/* ── Action Sheet ── */}
      <Dialog
        open={sheetOpen}
        onClose={handleCancel}
        disablePortal={disablePortal}
        data-testid="kiosk-action-sheet"
        PaperProps={{
          sx: {
            borderRadius: 3,
            minWidth: 280,
            maxWidth: 340,
          },
        }}
      >
        <DialogTitle
          sx={{
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '1rem',
            pb: 0.5,
          }}
        >
          キオスクメニュー
        </DialogTitle>
        <List sx={{ pt: 0 }}>
          <ListItemButton
            onClick={handleExitToNormal}
            data-testid="kiosk-action-exit"
            sx={{ py: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <ExitToAppIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="通常モードに戻る"
              secondary="ヘッダー・サイドバーを復元"
              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItemButton>
          <Divider />
          <ListItemButton
            onClick={handleReload}
            data-testid="kiosk-action-reload"
            sx={{ py: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <RefreshIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary="再読み込み"
              secondary="画面に問題がある場合に使用"
              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItemButton>
          <Divider />
          <ListItemButton
            onClick={handleCancel}
            data-testid="kiosk-action-cancel"
            sx={{ py: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <CloseIcon />
            </ListItemIcon>
            <ListItemText
              primary="キャンセル"
              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem', color: 'text.secondary' }}
            />
          </ListItemButton>
        </List>
      </Dialog>
    </>
  );
};

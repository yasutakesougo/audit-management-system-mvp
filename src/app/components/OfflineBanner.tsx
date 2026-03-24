/**
 * OfflineBanner — ネットワーク切断時に表示するグローバルバナー
 *
 * キオスクモード以外でも動作する。
 * オフライン時は画面上部にバナー表示 + リロードボタン。
 * 復帰時は「接続が復帰しました」を5秒間表示。
 */
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Slide from '@mui/material/Slide';
import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const OfflineBanner: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <Slide direction="down" in={!isOnline || wasOffline} mountOnEnter unmountOnExit>
      <Alert
        severity={isOnline ? 'success' : 'warning'}
        variant="filled"
        data-testid="offline-banner"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.snackbar + 1,
          borderRadius: 0,
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.9rem',
          '& .MuiAlert-action': { ml: 2 },
        }}
        action={
          !isOnline ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => window.location.reload()}
              sx={{ fontWeight: 700 }}
            >
              再読み込み
            </Button>
          ) : undefined
        }
      >
        {isOnline
          ? '✅ 接続が復帰しました'
          : '⚠️ オフラインです — 一部の操作が制限されます'}
      </Alert>
    </Slide>
  );
};

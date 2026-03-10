/**
 * WriteDisabledBanner — VITE_WRITE_ENABLED=0 時にグローバル警告を表示
 *
 * 書き込み無効状態を視覚的に警告するバナー。
 * App.tsx（全画面共通）と SmokeTestPage（開通確認）で使用。
 */
import { isWriteEnabled } from '@/env';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import React from 'react';

export const WriteDisabledBanner: React.FC = () => {
  if (isWriteEnabled) return null;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        width: '100%',
      }}
      data-testid="write-disabled-banner"
    >
      <Alert
        severity="warning"
        variant="filled"
        sx={{
          borderRadius: 0,
          '& .MuiAlert-message': { width: '100%' },
        }}
      >
        <AlertTitle sx={{ fontWeight: 700 }}>
          ⚠️ 書き込みが無効です
        </AlertTitle>
        この環境では書き込みが無効です。
        記録の保存・更新・削除はすべてブロックされます。
        <br />
        <code style={{ fontWeight: 700 }}>
          .env の VITE_WRITE_ENABLED=1 を設定してください。
        </code>
      </Alert>
    </Box>
  );
};

export default WriteDisabledBanner;

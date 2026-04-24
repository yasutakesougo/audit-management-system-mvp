import React from 'react';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * DataLayerGuard
 * 
 * データレイヤー（IDataProvider）の初期化が完了するまでUIを待機させます。
 * これにより、初期化レースコンディションによる DataProviderNotInitializedError を防ぎ、
 * ユーザーに接続状態を明示します。
 */
export const DataLayerGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentProvider = useDataProviderObservabilityStore((state) => state.currentProvider);

  // 初期化完了（currentProviderが設定される）まで待機UIを表示
  if (!currentProvider) {
    return (
      <Box
        data-testid="data-layer-guard-loading"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bgcolor: 'background.default',
          color: 'text.secondary',
        }}
      >
        <CircularProgress size={40} thickness={4} />
        <Typography sx={{ mt: 2, fontWeight: 500 }}>
          データレイヤーに接続しています...
        </Typography>
        <Typography variant="caption" sx={{ mt: 1, opacity: 0.7 }}>
          SharePoint認証と同期を確認中
        </Typography>
      </Box>
    );
  }

  // [DIAGNOSTIC] Provide a stable container for the children to avoid reconciliation errors
  return (
    <Box 
      component="main" 
      id="app-main-container" 
      data-provider={currentProvider}
      sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </Box>
  );
};

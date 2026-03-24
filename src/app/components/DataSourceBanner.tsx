/**
 * DataSourceBanner — グローバルデータ状態バナー（軽量版 v2）
 *
 * 開発環境・本番環境ともに、一部データがフォールバックで
 * 動作している可能性がある場合にさりげなく表示する。
 *
 * ## 表示条件
 * - isDev() === true（開発環境）→ 常に表示
 * - isDemoModeEnabled() === true（デモモード）→ 常に表示
 * - それ以外 → 非表示（本番完全運用時）
 *
 * ## 設計方針
 * - 既存フックを一切変更しない
 * - env.ts の関数のみで判断
 * - ユーザーは×で閉じられる
 */
import React, { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { getAppConfig, isDemoModeEnabled, SP_ENABLED } from '@/lib/env';

// ─── Component ───────────────────────────────────────────────────────────────

export const DataSourceBanner: React.FC = () => {
  const { isDev } = getAppConfig();
  const isDemo = isDemoModeEnabled();
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // 本番 SP 接続中 & デモモードOFF → 非表示（実データを見ているのに不安を与えない）
  const isSpConnected = SP_ENABLED && !isDemo;
  const shouldShow = !isSpConnected && (isDev || isDemo) && !dismissed;
  if (!shouldShow) return null;

  const message = isDemo
    ? '一部サンプルデータを表示しています'
    : '開発環境: 一部デモデータで動作中';

  return (
    <Box
      data-testid="data-source-banner"
      role="status"
      aria-live="polite"
      sx={{
        position: 'relative',
        zIndex: 1,
        mx: -2,
        mt: -2,
        mb: 1,
      }}
    >
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon sx={{ fontSize: 16 }} />}
        action={
          <IconButton
            size="small"
            aria-label="バナーを閉じる"
            onClick={handleDismiss}
            color="inherit"
          >
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        }
        sx={{
          py: 0,
          px: 2,
          borderRadius: 0,
          '& .MuiAlert-message': {
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          },
          '& .MuiAlert-icon': {
            py: 0.5,
            mr: 0,
          },
          '& .MuiAlert-action': {
            py: 0,
            mr: 0,
          },
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(41, 182, 246, 0.08)'
              : 'rgba(41, 182, 246, 0.06)',
          borderBottom: (theme) =>
            `1px solid ${
              theme.palette.mode === 'dark'
                ? 'rgba(41, 182, 246, 0.2)'
                : 'rgba(41, 182, 246, 0.15)'
            }`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'text.secondary',
          }}
        >
          {message}
        </Typography>
      </Alert>
    </Box>
  );
};

export default DataSourceBanner;

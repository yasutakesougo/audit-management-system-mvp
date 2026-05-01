/**
 * KioskBackToToday — キオスクモードの "ホームに戻る" バー
 *
 * Today 画面以外にいるとき、画面上部に固定表示される。
 * サイドメニューに導線がないページ（call-logs など）からも
 * 1タップで Today に戻れるようにする。
 */
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useKioskDetection } from '@/features/settings/hooks/useKioskDetection';

/** Today系パス（完全一致でのみバーを非表示にする） */
const TODAY_EXACT_PATHS = new Set(['/today', '/kiosk']);

export const KioskBackToToday: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { isKioskMode } = useKioskDetection();

  // Today 画面 または キオスク関連画面 にいるなら非表示
  const isExcluded = TODAY_EXACT_PATHS.has(location.pathname) || location.pathname.startsWith('/kiosk');
  
  if (!isKioskMode || isExcluded) return null;

  return (
    <Box
      data-testid="kiosk-back-to-today"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: (t) => t.zIndex.appBar - 1,
        bgcolor: alpha(theme.palette.primary.main, 0.06),
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        px: 2,
        py: 0.75,
      }}
    >
      <ButtonBase
        onClick={() => navigate('/today')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 0.5,
          borderRadius: 2,
          transition: 'background-color 0.15s',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.1),
          },
          '&:active': {
            bgcolor: alpha(theme.palette.primary.main, 0.16),
          },
        }}
      >
        <ArrowBackRoundedIcon
          sx={{ fontSize: 18, color: 'primary.main' }}
        />
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: 'primary.main' }}
        >
          今日の業務に戻る
        </Typography>
      </ButtonBase>
    </Box>
  );
};

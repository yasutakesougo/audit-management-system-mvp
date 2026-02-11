import { useTheme, useMediaQuery } from '@mui/material';

/**
 * 横長タブレット判定
 *
 * 想定:
 * - iPad 横 / Android 横タブレット
 * - Desktop は false（レイアウト分岐を増やさないため）
 */
export function useLandscapeTablet() {
  const theme = useTheme();

  // タブレット以上
  const isTabletUp = useMediaQuery(theme.breakpoints.up('md'));
  // 横長
  const isLandscape = useMediaQuery('(orientation: landscape)');
  // デスクトップ除外（必要なら後で調整）
  const isDesktopUp = useMediaQuery(theme.breakpoints.up('lg'));

  return isTabletUp && isLandscape && !isDesktopUp;
}

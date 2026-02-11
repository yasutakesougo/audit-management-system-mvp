import * as React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { LAYOUT } from './layoutTokens';
import { useLandscapeTablet } from '@/hooks/useLandscapeTablet';

type Props = {
  header?: React.ReactNode;
  activity?: React.ReactNode;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;

  /** 外側レイアウトの幅制御（必要なら上書き） */
  activityWidth?: number;
  sidebarWidth?: number;

  /** メインの「内側コンテナ」制御（ワイド画面で散らばらせない） */
  contentMaxWidth?: number; // default 1200
  contentPaddingX?: number; // default 16
  contentPaddingY?: number; // default 16
};

export function AppShellV2({
  header,
  activity,
  sidebar,
  footer,
  children,
  activityWidth,
  sidebarWidth,
  contentMaxWidth = 1200,
  contentPaddingX = 16,
  contentPaddingY = 16,
}: Props) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const isLandscapeTablet = useLandscapeTablet();

  const headerH = header ? (isPhone ? LAYOUT.headerH.xs : LAYOUT.headerH.md) : 0;
  const footerH = isPhone ? LAYOUT.footerH.xs : LAYOUT.footerH.md;
  const activityW = activityWidth ?? LAYOUT.activityW;
  const sidebarW = sidebarWidth ?? (isPhone ? LAYOUT.sidebarW.xs : LAYOUT.sidebarW.md);

  // VS Code っぽい境界線（dark で沈みすぎるのを防ぐ）
  const borderColor =
    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';

  const showActivity = Boolean(activity) && activityW > 0;
  const showSidebar = Boolean(sidebar) && sidebarW > 0;
  const showFooter = Boolean(footer);

  return (
    <Box
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateAreas: `
          "header header header"
          "activity sidebar main"
          "footer footer footer"
        `,
        gridTemplateRows: `${headerH}px 1fr ${showFooter ? 'auto' : '0px'}`,
        gridTemplateColumns: `${showActivity ? `${activityW}px` : '0px'} ${showSidebar ? `${sidebarW}px` : '0px'} 1fr`,
        bgcolor: 'background.default',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          gridArea: 'header',
          gridColumn: '1 / -1',
          height: `${headerH}px`,
          minHeight: 0,
          borderBottom: `1px solid ${borderColor}`,
          display: header ? 'flex' : 'none',
          alignItems: 'stretch',
          px: 0,
        }}
      >
        {header}
      </Box>

      {/* Activity */}
      <Box
        sx={{
          gridArea: 'activity',
          minHeight: 0,
          borderRight: showActivity ? `1px solid ${borderColor}` : 'none',
          display: showActivity ? 'flex' : 'none',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1,
          gap: 1,
        }}
      >
        {activity}
      </Box>

      {/* Sidebar */}
      <Box
        sx={{
          gridArea: 'sidebar',
          minHeight: 0,
          borderRight: showSidebar ? `1px solid ${borderColor}` : 'none',
          display: showSidebar ? 'block' : 'none',
          overflow: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {sidebar}
      </Box>

      {/* Main (only scroll here) */}
      <Box
        component="main"
        sx={{
          gridArea: 'main',
          minHeight: 0,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          ...(isLandscapeTablet && {
            maxWidth: 1200,
            margin: '0 auto',
          }),
        }}
      >
        {/* ✅ メイン内側コンテナ層（ワイドで散らばらせない） */}
        <Box
          sx={{
            maxWidth: `${contentMaxWidth}px`,
            mx: 'auto',
            px: `${contentPaddingX}px`,
            py: `${contentPaddingY}px`,
            pb: showFooter
              ? `calc(${contentPaddingY}px + ${footerH}px)`
              : `${contentPaddingY}px`,
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          gridArea: 'footer',
          minHeight: showFooter ? footerH : 0,
          borderTop: showFooter ? `1px solid ${borderColor}` : 'none',
          display: showFooter ? 'flex' : 'none',
          alignItems: 'center',
          overflow: 'visible',
        }}
      >
        {footer}
      </Box>
    </Box>
  );
}

import * as React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { layoutTokens } from './layoutTokens';
import { HeaderBand } from './HeaderBand';

export type AppShellProps = {
  title?: string;
  onSearchChange?: (value: string) => void;
  headerLeftSlot?: React.ReactNode;
  headerRightSlot?: React.ReactNode;
  hideHeader?: boolean;

  activityBar?: React.ReactNode;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;

  activityWidth?: number;
  sidebarWidth?: number;
  contentPaddingX?: number;
  contentPaddingY?: number;
  contentMaxWidth?: number;

  children: React.ReactNode;
};

export function AppShell(props: AppShellProps) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));

  const showHeader = !props.hideHeader;
  const showSidebar = Boolean(props.sidebar) && !isPhone && (props.sidebarWidth ?? layoutTokens.sidebar.width) > 0;
  const showActivity = Boolean(props.activityBar) && (props.activityWidth ?? layoutTokens.activityBar.width) > 0;
  const showFooter = Boolean(props.footer);

  const activityWidth = showActivity ? props.activityWidth ?? layoutTokens.activityBar.width : 0;
  const sidebarWidth = showSidebar ? props.sidebarWidth ?? layoutTokens.sidebar.width : 0;
  const contentPaddingX = props.contentPaddingX ?? 16;
  const contentPaddingY = props.contentPaddingY ?? 16;
  const contentMaxWidth = props.contentMaxWidth ?? 1200;

  return (
    <Box
      sx={{
        height: layoutTokens.app.height,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: `${showHeader ? layoutTokens.header.height : 0}px 1fr ${showFooter ? layoutTokens.footer.height : 0}px`,
        gridTemplateColumns: `${activityWidth}px ${sidebarWidth}px 1fr`,
        gridTemplateAreas: `
          "header header header"
          "activity sidebar main"
          "footer footer footer"
        `,
      }}
    >
      <Box sx={{ gridArea: 'header', display: showHeader ? 'block' : 'none' }}>
        <HeaderBand
          title={props.title}
          onSearchChange={props.onSearchChange}
          leftSlot={props.headerLeftSlot}
          rightSlot={props.headerRightSlot}
        />
      </Box>

      <Box
        sx={(t) => ({
          gridArea: 'activity',
          borderRight: showActivity ? `1px solid ${t.palette.divider}` : 'none',
          background: t.palette.background.default,
          overflow: 'hidden',
          display: showActivity ? 'flex' : 'none',
          flexDirection: 'column',
          alignItems: 'center',
          py: 0.5,
          gap: 0.5,
        })}
      >
        {props.activityBar}
      </Box>

      <Box
        sx={(t) => ({
          gridArea: 'sidebar',
          display: showSidebar ? 'block' : 'none',
          borderRight: showSidebar ? `1px solid ${t.palette.divider}` : 'none',
          background: t.palette.background.default,
          overflow: 'hidden',
        })}
      >
        {props.sidebar}
      </Box>

      <Box
        component="main"
        sx={(t) => ({
          gridArea: 'main',
          background: t.palette.background.paper,
          overflow: 'auto',
          minWidth: 0,
          minHeight: 0,
        })}
      >
        <Box
          sx={{
            maxWidth: `${contentMaxWidth}px`,
            mx: 'auto',
            px: `${contentPaddingX}px`,
            py: `${contentPaddingY}px`,
          }}
        >
          {props.children}
        </Box>
      </Box>

      <Box
        component="footer"
        sx={(t) => ({
          gridArea: 'footer',
          height: showFooter ? `${layoutTokens.footer.height}px` : 0,
          borderTop: showFooter ? `1px solid ${t.palette.divider}` : 'none',
          background: t.palette.background.default,
          display: showFooter ? 'block' : 'none',
          overflow: 'hidden',
        })}
      >
        {props.footer}
      </Box>
    </Box>
  );
}

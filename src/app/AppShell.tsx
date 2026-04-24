import LiveAnnouncer from '@/a11y/LiveAnnouncer';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import Fab from '@mui/material/Fab';
import React, { useContext, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KioskBackToToday } from './components/KioskBackToToday';
import { KioskExitFab } from './components/KioskExitFab';
import { AppShellV2 } from '@/components/layout/AppShellV2';
import { AuthDiagnosticsPanel } from '@/features/auth/diagnostics';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';
import { shouldSkipLogin } from '@/lib/env';
import { ColorModeContext } from './theme';
import { useAppShellState } from './useAppShellState';
import { AppShellHeader } from './AppShellHeader';
import { AppShellSidebar, MobileNavContent } from './AppShellSidebar';
import { ConnectionDegradedBanner } from '@/features/sp/health/components/ConnectionDegradedBanner';
import { FooterQuickActions } from './components/FooterQuickActions';

const SKIP_LOGIN = shouldSkipLogin();

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, toggle } = useContext(ColorModeContext);
  
  const {
    dashboardPath,
    hubRouteMeta,
    isFocusMode,
    isKioskMode,
    isFullscreenMode,
    isDesktop,
    viewportMode,
    contentPaddingY,
    updateSettings,
    mobileOpen,
    setMobileOpen,
    desktopNavOpen,
    setDesktopNavOpen,
    navQuery,
    setNavQuery,
    navCollapsed,
    settingsDialogOpen,
    setSettingsDialogOpen,
    drawerWidth,
    currentDrawerWidth,
    showDesktopSidebar,
    filteredNavItems,
    groupedNavItems,
    showMoreNavItems,
    hasMoreNavItems,
    todayLiteNavV2,
    isAdmin,
    isFieldStaffShell,
    handleNavSearchKeyDown,
    handleMobileNavigate,
    handleToggleNavCollapse,
    handleToggleMoreNavItems,
  } = useAppShellState();

  useEffect(() => {
    if (SKIP_LOGIN && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [navigate, location.pathname]);

  const headerContent = isFullscreenMode ? null : (
    <AppShellHeader
      isDesktop={isDesktop}
      desktopNavOpen={desktopNavOpen}
      dashboardPath={dashboardPath}
      currentBreadcrumb={hubRouteMeta?.breadcrumbLabel}
      onMobileMenuOpen={() => setMobileOpen(true)}
      onDesktopNavToggle={() => setDesktopNavOpen((prev) => !prev)}
      onSettingsOpen={() => setSettingsDialogOpen(true)}
      isFieldStaffShell={isFieldStaffShell}
    />
  );

  const sidebarContent = showDesktopSidebar ? (
    <AppShellSidebar
      navQuery={navQuery}
      onNavQueryChange={setNavQuery}
      onNavSearchKeyDown={handleNavSearchKeyDown}
      navCollapsed={navCollapsed}
      onToggleNavCollapse={handleToggleNavCollapse}
      filteredNavItems={filteredNavItems}
      groupedNavItems={groupedNavItems}
      showMoreNavItems={showMoreNavItems}
      hasMoreNavItems={hasMoreNavItems}
      todayLiteNavV2={todayLiteNavV2}
      onToggleMoreNavItems={handleToggleMoreNavItems}
      isAdmin={isAdmin}
      isFieldStaffShell={isFieldStaffShell}
    />
  ) : null;

  return (
    <RouteHydrationListener>
      <LiveAnnouncer>
        <div data-testid="app-shell" data-kiosk={isKioskMode || undefined}>
          <KioskBackToToday />
          <AppShellV2
            header={headerContent}
            sidebar={sidebarContent}
            footer={<FooterQuickActions />}
            sidebarWidth={showDesktopSidebar ? currentDrawerWidth : 0}
            contentPaddingX={isFocusMode ? 0 : 16}
            contentPaddingY={contentPaddingY}
            viewportMode={viewportMode}
          >
            {/* Global Connection Readiness Linkage */}
            <ConnectionDegradedBanner />
            {children}
          </AppShellV2>

          {!isFocusMode && !isDesktop && (
            <Drawer
              data-testid="nav-drawer"
              variant="temporary"
              open={mobileOpen}
              onClose={() => setMobileOpen(false)}
              ModalProps={{ keepMounted: true }}
              sx={{
                '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
              }}
            >
              <MobileNavContent
                navQuery={navQuery}
                onNavQueryChange={setNavQuery}
                onNavSearchKeyDown={handleNavSearchKeyDown}
                filteredNavItems={filteredNavItems}
                groupedNavItems={groupedNavItems}
                navCollapsed={navCollapsed}
                showMoreNavItems={showMoreNavItems}
                hasMoreNavItems={hasMoreNavItems}
                todayLiteNavV2={todayLiteNavV2}
                onToggleMoreNavItems={handleToggleMoreNavItems}
                onNavigate={handleMobileNavigate}
                isFieldStaffShell={isFieldStaffShell}
              />
            </Drawer>
          )}

          <Box sx={{ position: 'fixed', bottom: 12, right: 12, display: 'flex', gap: 1, zIndex: 1000 }}>
             <Tooltip title={mode === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}>
              <Fab size="small" onClick={toggle}>
                {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
              </Fab>
            </Tooltip>
            {isFocusMode && (
              <Fab
                size="small"
                aria-label="通常表示に戻す"
                onClick={() => updateSettings({ layoutMode: 'normal' })}
              >
                <CloseFullscreenRoundedIcon fontSize="small" />
              </Fab>
            )}
          </Box>

          {import.meta.env.DEV && <AuthDiagnosticsPanel limit={15} pollInterval={2000} />}
          <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
          {isKioskMode && (
            <KioskExitFab onExit={() => updateSettings({ layoutMode: 'normal' })} />
          )}
        </div>
      </LiveAnnouncer>
    </RouteHydrationListener>
  );
};

export default AppShell;

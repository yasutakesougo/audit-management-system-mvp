/**
 * AppShell — thin orchestrator for the application layout.
 *
 * Delegates to:
 *  - useAppShellState   → all state, effects, and callbacks
 *  - AppShellHeader     → top AppBar
 *  - AppShellSidebar    → desktop sidebar with nav items
 *  - MobileNavContent   → mobile drawer nav content
 *  - AppShellV2         → viewport & layout container
 */
import LiveAnnouncer from '@/a11y/LiveAnnouncer';
import { FooterQuickActions } from '@/app/components/FooterQuickActions';
import { AppShellV2 } from '@/components/layout/AppShellV2';
import { isDev } from '@/env';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import React from 'react';
import { AppShellHeader } from './AppShellHeader';
import { AppShellSidebar, MobileNavContent } from './AppShellSidebar';
import { useAppShellState } from './useAppShellState';

// ── Dev Panel (lazy, DEV only — zero production cost) ────────────────────
const LazySpDevPanel = isDev
  ? React.lazy(() => import('@/debug/SpDevPanel'))
  : null;

function useLockBodyScroll(enabled: boolean) {
  React.useLayoutEffect(() => {
    if (!enabled) return;

    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [enabled]);
}

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useLockBodyScroll(true);

  const {
    dashboardPath,
    isFocusMode,
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
    isAdmin,
    handleNavSearchKeyDown,
    handleMobileNavigate,
    handleToggleNavCollapse,
  } = useAppShellState();

  // ── Slots ──────────────────────────────────────────────────────────────────

  const headerContent = isFocusMode ? null : (
    <AppShellHeader
      isDesktop={isDesktop}
      desktopNavOpen={desktopNavOpen}
      dashboardPath={dashboardPath}
      onMobileMenuOpen={() => setMobileOpen(true)}
      onDesktopNavToggle={() => setDesktopNavOpen((prev) => !prev)}
      onSettingsOpen={() => setSettingsDialogOpen(true)}
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
      isAdmin={isAdmin}
    />
  ) : null;

  const footerContent = !isFocusMode ? <FooterQuickActions fixed={false} /> : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <RouteHydrationListener>
      <LiveAnnouncer>
        <div data-testid="app-shell">
          <AppShellV2
            header={headerContent}
            sidebar={sidebarContent}
            footer={footerContent}
            sidebarWidth={showDesktopSidebar ? currentDrawerWidth : 0}
            contentPaddingX={isFocusMode ? 0 : 16}
            contentPaddingY={contentPaddingY}
            viewportMode={viewportMode}
          >
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
                onNavigate={handleMobileNavigate}
              />
            </Drawer>
          )}

          {isFocusMode && (
            <Fab
              size="small"
              aria-label="通常表示に戻す"
              onClick={() => updateSettings({ layoutMode: 'normal' })}
              sx={{ position: 'fixed', top: 12, right: 12, zIndex: (t) => t.zIndex.modal + 1 }}
            >
              <CloseFullscreenRoundedIcon fontSize="small" />
            </Fab>
          )}
          <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
          {LazySpDevPanel && (
            <React.Suspense fallback={null}>
              <LazySpDevPanel />
            </React.Suspense>
          )}
        </div>
      </LiveAnnouncer>
    </RouteHydrationListener>
  );
};

export const shouldTriggerNavShellHud = (event: KeyboardEvent): boolean => {
  if (event.repeat) return false;
  if (!event.altKey || event.key.toLowerCase() !== 'p') return false;
  if (event.ctrlKey || event.shiftKey || event.metaKey) return false;
  const target = event.target as Element;
  if (target) {
    const tagName = target.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') return false;
    if (target instanceof HTMLElement && target.isContentEditable) return false;
  }
  return true;
};

export default AppShell;

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
import { DataSourceBanner } from '@/app/components/DataSourceBanner';
import { FooterQuickActions } from '@/app/components/FooterQuickActions';
import { KioskExitFab } from '@/app/components/KioskExitFab';
import { KioskBackToToday } from '@/app/components/KioskBackToToday';
import { OfflineBanner } from '@/app/components/OfflineBanner';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import { AppShellV2 } from '@/components/layout/AppShellV2';
import { isDev } from '@/env';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { useSuggestionDeepLinkArrivalTelemetry } from '@/features/action-engine/telemetry/useSuggestionDeepLinkArrivalTelemetry';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import Box from '@mui/material/Box';
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

// ── Wake Lock: キオスクモード時に画面消灯を防止 ────────────────────────
// iPad Safari 対策: visibilitychange だけでは不十分。
// pageshow (bfcache復帰) / focus (アプリ切替) / release (OS奪取) を監視。
// 200ms デバウンスで連続再取得を防止。
function useWakeLock(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    if (!('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const request = async () => {
      // 既にアクティブなら再取得不要
      if (sentinel && !sentinel.released) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release();
          sentinel = null;
          return;
        }
        // sentinel が OS に解除された場合に自動再取得
        sentinel.addEventListener('release', handleRelease);
      } catch {
        // Wake Lock がサポートされない環境 or Low Battery Mode では無視
      }
    };

    const debouncedRequest = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!cancelled) void request();
      }, 200);
    };

    // sentinel が OS に奪われたとき（画面ロック解除後など）
    const handleRelease = () => {
      sentinel = null;
      if (!cancelled && document.visibilityState === 'visible') {
        debouncedRequest();
      }
    };

    // ── イベントリスナー群 ──

    // 1. visibilitychange: タブ切り替え・画面ロック/解除
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        debouncedRequest();
      }
    };

    // 2. pageshow: iPad Safari bfcache 復帰
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !cancelled) {
        debouncedRequest();
      }
    };

    // 3. focus: アプリ切替からの復帰（Slide Over / Split View 含む）
    const handleFocus = () => {
      if (!cancelled) debouncedRequest();
    };

    void request();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
      if (sentinel) {
        sentinel.removeEventListener('release', handleRelease);
        sentinel.release().catch(() => {});
      }
    };
  }, [enabled]);
}

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useLockBodyScroll(true);

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
    navItems,
    filteredNavItems,
    groupedNavItems,
    showMoreNavItems,
    hasMoreNavItems,
    todayLiteNavV2,
    isAdmin,
    canSeeAdmin,
    canSeeDiagnostics,
    canUseBulkActions,
    isFieldStaffShell,
    handleNavSearchKeyDown,
    handleMobileNavigate,
    handleToggleNavCollapse,
    handleToggleMoreNavItems,
  } = useAppShellState();

  // ── Wake Lock（キオスクモード時のみ） ───────────────────────────────
  useWakeLock(isKioskMode);

  // ── キーボード対策（キオスクモード時のみ） ────────────────────────────
  useKeyboardAwareScroll(isKioskMode);
  useSuggestionDeepLinkArrivalTelemetry();

  // ── Slots ──────────────────────────────────────────────────────────────────

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

  const footerContent = !isFullscreenMode ? <FooterQuickActions fixed={false} /> : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <RouteHydrationListener>
      <LiveAnnouncer>
        <div
          className="notranslate"
          translate="no"
          data-testid="app-shell"
          data-kiosk={isKioskMode ? 'true' : undefined}
          data-current-hub={hubRouteMeta?.hubId}
          data-hub-telemetry={hubRouteMeta?.telemetryName}
          data-hub-analytics={hubRouteMeta?.analyticsName}
        >
          <Box
            component="a"
            href="#app-main-content"
            data-testid="skip-to-main-link"
            sx={{
              position: 'absolute',
              top: -48,
              left: 8,
              zIndex: (t) => t.zIndex.tooltip + 1,
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              '&:focus-visible': {
                top: 8,
              },
            }}
          >
            メインコンテンツへスキップ
          </Box>
          <AppShellV2
            header={headerContent}
            sidebar={sidebarContent}
            footer={footerContent}
            sidebarWidth={showDesktopSidebar ? currentDrawerWidth : 0}
            contentPaddingX={isFullscreenMode ? 0 : 16}
            contentPaddingY={contentPaddingY}
            viewportMode={viewportMode}
          >
            <OfflineBanner />
            <DataSourceBanner />
            <KioskBackToToday />
            {children}
          </AppShellV2>

          {!isFullscreenMode && !isDesktop && (
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

          {/* Focus Mode: ESCキーで解除可能なFAB */}
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

          {/* Kiosk Mode: 長押しで解除可能なFAB（誤操作防止） */}
          {isKioskMode && (
            <KioskExitFab
              onExit={() => updateSettings({ layoutMode: 'normal' })}
              disablePortal
            />
          )}
          <SettingsDialog
            open={settingsDialogOpen}
            onClose={() => setSettingsDialogOpen(false)}
            navItems={navItems}
            disablePortal
          />
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

/**
 * AppShell state management hook.
 * Extracted from AppShell.tsx for cleaner separation of concerns.
 */
import {
    buildVisibleNavItems,
    createNavItems,
    filterNavItems,
    groupNavItems,
    roleToNavAudience,
    splitNavItemsByTier,
    type NavAudience,
} from '@/app/config/navigationConfig';
import { resolveHubRouteMetadata } from '@/app/hubs/hubDefinitions';
import { navIconMap } from '@/app/navIconMap';
import { canAccess } from '@/auth/roles';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { useFeatureFlags } from '@/config/featureFlags';
import { useAuthStore } from '@/features/auth/store';
import { useDashboardPath } from '@/features/dashboard/dashboardRouting';
import { useSettingsContext } from '@/features/settings/SettingsContext';
import { shouldSkipLogin } from '@/lib/env';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SKIP_LOGIN = shouldSkipLogin();

type KioskRouteMode = 'enable' | 'disable' | null;

function parseKioskRouteMode(search: string): KioskRouteMode {
  const value = new URLSearchParams(search).get('kiosk');
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return 'enable';
  if (normalized === '0' || normalized === 'false') return 'disable';
  return null;
}

export function useAppShellState() {
  const location = useLocation();
  const navigate = useNavigate();
  const { schedules, complianceForm, icebergPdca, staffAttendance, todayOps, todayLiteNavV2: _todayLiteNavV2 } = useFeatureFlags();
  const todayLiteNavV2 = Boolean(_todayLiteNavV2);
  const dashboardPath = useDashboardPath();
  const currentRole = useAuthStore((s) => s.currentUserRole);
  const setCurrentUserRole = useAuthStore((s) => s.setCurrentUserRole);
  const { role, ready: authzReady } = useUserAuthz();
  const isAdmin = canAccess(role, 'admin');
  const navAudience: NavAudience = roleToNavAudience(role);
  const theme = useTheme();
  const { settings, updateSettings } = useSettingsContext();
  const kioskRouteMode = useMemo(
    () => parseKioskRouteMode(location.search),
    [location.search],
  );
  const isFocusMode = settings.layoutMode === 'focus';
  const isKioskMode = settings.layoutMode === 'kiosk';
  const isFullscreenMode = isFocusMode || isKioskMode;
  const hubRouteMeta = useMemo(
    () => resolveHubRouteMetadata(location.pathname),
    [location.pathname],
  );
  const isSchedulesRoute =
    location.pathname.startsWith('/schedules') || location.pathname.startsWith('/schedule');
  const viewportMode: 'adaptive' | 'fixed' = isSchedulesRoute ? 'adaptive' : 'fixed';
  const schedulesPaddingY = isSchedulesRoute ? 0 : 16;
  const contentPaddingY = isFullscreenMode ? 0 : schedulesPaddingY;

  const schedulesEnabled = Boolean(schedules);
  const complianceFormEnabled = Boolean(complianceForm);
  const icebergPdcaEnabled = Boolean(icebergPdca);
  const staffAttendanceEnabled = Boolean(staffAttendance);
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavOpen, setDesktopNavOpen] = useState(true);
  const [navQuery, setNavQuery] = useState('');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [showMoreNavItems, setShowMoreNavItems] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const drawerWidth = 240;
  const drawerMiniWidth = 64;
  const currentDrawerWidth = navCollapsed ? drawerMiniWidth : drawerWidth;

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (SKIP_LOGIN && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (!location.pathname.startsWith('/today')) return;
    if (kioskRouteMode === 'enable' && settings.layoutMode !== 'kiosk') {
      updateSettings({ layoutMode: 'kiosk' });
      return;
    }
    if (kioskRouteMode === 'disable' && settings.layoutMode === 'kiosk') {
      updateSettings({ layoutMode: 'normal' });
    }
  }, [location.pathname, kioskRouteMode, settings.layoutMode, updateSettings]);

  useEffect(() => {
    if (!isFocusMode) return;
    // キオスクモードではESCキーによる脱出を無効化（長押しFABのみ）
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        updateSettings({ layoutMode: 'normal' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, updateSettings]);

  useEffect(() => {
    const nextRole = location.pathname.startsWith('/admin/dashboard')
      ? 'admin'
      : (location.pathname === '/' || location.pathname.startsWith('/dashboard'))
        ? 'staff'
        : null;
    if (nextRole && nextRole !== currentRole) {
      setCurrentUserRole(nextRole);
    }
  }, [location.pathname, currentRole, setCurrentUserRole]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const appName = 'クロノート Link';
    document.title = hubRouteMeta ? `${hubRouteMeta.pageTitle} | ${appName}` : appName;
  }, [hubRouteMeta]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hubRouteMeta) return;
    window.dispatchEvent(
      new CustomEvent('app:hub-route-change', {
        detail: {
          hubId: hubRouteMeta.hubId,
          telemetryName: hubRouteMeta.telemetryName,
          analyticsName: hubRouteMeta.analyticsName,
          pathname: location.pathname,
        },
      }),
    );
  }, [hubRouteMeta, location.pathname]);

  // ── Nav items ──────────────────────────────────────────────────────────────

  const navItems = useMemo(() => {
    const items = createNavItems({
      dashboardPath,
      currentRole,
      schedulesEnabled,
      complianceFormEnabled,
      icebergPdcaEnabled,
      staffAttendanceEnabled,
      todayOpsEnabled: todayOps,
      isAdmin,
      authzReady,
      navAudience,
      skipLogin: SKIP_LOGIN,
    });
    return items.map((item) => ({
      ...item,
      icon: navIconMap[item.label],
    }));
  }, [dashboardPath, currentRole, schedulesEnabled, complianceFormEnabled, icebergPdcaEnabled, staffAttendanceEnabled, todayOps, isAdmin, authzReady, navAudience]);

  const visibleNavItems = useMemo(
    () => buildVisibleNavItems(navItems, navAudience, {
      showMore: showMoreNavItems,
      todayLiteNavV2,
      isKiosk: settings.layoutMode === 'kiosk',
      hiddenGroups: settings.hiddenNavGroups,
      hiddenItems: settings.hiddenNavItems,
    }),
    [navItems, navAudience, showMoreNavItems, todayLiteNavV2, settings.layoutMode, settings.hiddenNavGroups, settings.hiddenNavItems],
  );

  const navItemsByTier = useMemo(() => splitNavItemsByTier(navItems), [navItems]);

  const filteredNavItems = useMemo(() => {
    return filterNavItems(visibleNavItems, navQuery);
  }, [visibleNavItems, navQuery]);
  const groupedNavItems = useMemo(() => groupNavItems(filteredNavItems, isAdmin), [filteredNavItems, isAdmin]);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const handleNavSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, onNavigate?: () => void) => {
      if (event.key === 'Escape') {
        setNavQuery('');
        return;
      }
      if (event.key !== 'Enter') return;
      const currentFiltered = filteredNavItems;
      const first = currentFiltered[0];
      if (!first) return;
      event.preventDefault();
      if (onNavigate) onNavigate();
      navigate(first.to);
    },
    [navigate], // filteredNavItems intentionally omitted to avoid infinite loop
  );

  const handleMobileNavigate = useCallback(() => {
    setMobileOpen(false);
    setNavQuery('');
  }, []);

  const handleToggleNavCollapse = useCallback(() => {
    setNavCollapsed((v) => !v);
    setNavQuery('');
  }, []);

  const handleToggleMoreNavItems = useCallback(() => {
    setShowMoreNavItems((v) => !v);
  }, []);

  const showDesktopSidebar = !isFullscreenMode && isDesktop && desktopNavOpen;

  return {
    // Location/navigation
    location,
    dashboardPath,
    hubRouteMeta,
    navigate,
    // Theme/mode
    theme,
    isFocusMode,
    isKioskMode,
    isFullscreenMode,
    isDesktop,
    viewportMode,
    contentPaddingY,
    updateSettings,
    // Nav state
    mobileOpen,
    setMobileOpen,
    desktopNavOpen,
    setDesktopNavOpen,
    navQuery,
    setNavQuery,
    navCollapsed,
    settingsDialogOpen,
    setSettingsDialogOpen,
    // Drawer dimensions
    drawerWidth,
    currentDrawerWidth,
    showDesktopSidebar,
    // Nav data
    navItems,
    filteredNavItems,
    groupedNavItems,
    showMoreNavItems,
    hasMoreNavItems: Boolean(todayLiteNavV2 && navItemsByTier.more.length > 0),
    todayLiteNavV2: Boolean(todayLiteNavV2),
    isAdmin,
    // Handlers
    handleNavSearchKeyDown,
    handleMobileNavigate,
    handleToggleNavCollapse,
    handleToggleMoreNavItems,
  };
}

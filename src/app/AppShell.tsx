import LiveAnnouncer from '@/a11y/LiveAnnouncer';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
// Navigation Icons
import { ConnectionStatus } from '@/app/components/ConnectionStatus';
import { FooterQuickActions } from '@/app/components/FooterQuickActions';
import {
    createNavItems,
    filterNavItems,
    groupLabel,
    groupNavItems,
    NAV_AUDIENCE,
    type NavAudience,
    type NavItem,
} from '@/app/config/navigationConfig';
import { ActivityBar } from '@/app/layout/ActivityBar';
import { AppShell as AppShellLayout } from '@/app/layout/AppShell';
import { canAccess } from '@/auth/roles';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { AppShellV2 } from '@/components/layout/AppShellV2';
import NavLinkPrefetch from '@/components/NavLinkPrefetch';
import { useFeatureFlags } from '@/config/featureFlags';
import { useAuthStore } from '@/features/auth/store';
import { useDashboardPath } from '@/features/dashboard/dashboardRouting';
import { useSettingsContext } from '@/features/settings/SettingsContext';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';
import { shouldSkipLogin } from '@/lib/env';
import { TESTIDS } from '@/testids';
import SignInButton from '@/ui/components/SignInButton';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import InsightsIcon from '@mui/icons-material/Insights';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import Fab from '@mui/material/Fab';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ColorModeContext } from './theme';

const SKIP_LOGIN = shouldSkipLogin();

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
  const location = useLocation();
  const navigate = useNavigate();
  const { schedules, complianceForm, icebergPdca, staffAttendance, appShellVsCode, todayOps } = useFeatureFlags();
  const { mode, toggle } = useContext(ColorModeContext);
  const dashboardPath = useDashboardPath();
  const currentRole = useAuthStore((s) => s.currentUserRole);
  const setCurrentUserRole = useAuthStore((s) => s.setCurrentUserRole);
  const { role, ready: authzReady } = useUserAuthz();
  const isAdmin = canAccess(role, 'admin');
  const navAudience: NavAudience = isAdmin ? NAV_AUDIENCE.admin : NAV_AUDIENCE.staff;
  const theme = useTheme();
  const { settings, updateSettings } = useSettingsContext();
  const isFocusMode = settings.layoutMode === 'focus';
  const isSchedulesRoute =
    location.pathname.startsWith('/schedules') || location.pathname.startsWith('/schedule');
  const viewportMode = isSchedulesRoute ? 'adaptive' : 'fixed';
  const schedulesPaddingY = isSchedulesRoute ? 0 : 16;
  const contentPaddingY = isFocusMode ? 0 : schedulesPaddingY;

  // ✅ 修正：Object を直接依存に入れず、boolean フラグを作る
  const schedulesEnabled = Boolean(schedules);
  const complianceFormEnabled = Boolean(complianceForm);
  const icebergPdcaEnabled = Boolean(icebergPdca);
  const staffAttendanceEnabled = Boolean(staffAttendance);
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavOpen, setDesktopNavOpen] = useState(true); // デフォルトで展開
  const [navQuery, setNavQuery] = useState('');
  const [navCollapsed, setNavCollapsed] = useState(false); // デフォルトで展開（ラベル表示）
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const drawerWidth = 240;
  const drawerMiniWidth = 64;
  const currentDrawerWidth = navCollapsed ? drawerMiniWidth : drawerWidth;

  useEffect(() => {
    if (SKIP_LOGIN && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (!isFocusMode) return;

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

    // ✅ 同値ガード: role が変わる時だけ更新（無限ループ防止）
    // ※ nextRole が null の場合は role を維持（admin/staff 以外の画面でも role は保持）
    if (nextRole && nextRole !== currentRole) {
      setCurrentUserRole(nextRole);
    }
  }, [location.pathname, currentRole, setCurrentUserRole]);

  // Icon mapping for navigation items
  const iconMap: Record<string, React.ElementType> = {
    '日次記録': AssignmentTurnedInRoundedIcon,
    '健康記録': EditNoteIcon,
    '申し送りタイムライン': HistoryIcon,
    '司会ガイド': PsychologyIcon,
    '朝会（作成）': AddCircleOutlineIcon,
    '夕会（作成）': AddCircleOutlineIcon,
    '議事録アーカイブ': EditNoteIcon,
    '黒ノート一覧': AssignmentTurnedInRoundedIcon,
    '月次記録': AssessmentRoundedIcon,
    '分析': InsightsIcon,
    '氷山分析': WorkspacesIcon,
    '氷山PDCA': HistoryIcon,
    'アセスメント': PsychologyIcon,
    '特性アンケート': EditNoteIcon,
    '利用者': PeopleAltRoundedIcon,
    '職員': BadgeRoundedIcon,
    '職員勤怠': BadgeRoundedIcon,
    '支援手順マスタ': ChecklistRoundedIcon,
    '個別支援手順': WorkspacesIcon,
    '職員勤怠管理': BadgeRoundedIcon,
    '自己点検': ChecklistRoundedIcon,
    '監査ログ': AssessmentRoundedIcon,
    '支援活動マスタ': SettingsRoundedIcon,
    'スケジュール': EventAvailableRoundedIcon,
    'コンプラ報告': ChecklistRoundedIcon,
  };

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

    // Apply icon mapping
    return items.map((item) => ({
      ...item,
      icon: iconMap[item.label],
    }));
  }, [dashboardPath, currentRole, schedulesEnabled, complianceFormEnabled, icebergPdcaEnabled, staffAttendanceEnabled, todayOps, isAdmin, authzReady, navAudience]);

  const filteredNavItems = useMemo(() => {
    return filterNavItems(navItems, navQuery);
  }, [navItems, navQuery]);


  const handleNavSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, onNavigate?: () => void) => {
      if (event.key === 'Escape') {
        setNavQuery('');
        return;
      }
      if (event.key !== 'Enter') return;
      // ⚠️ filteredNavItems の最初の item を使う際は、最新値を参照する必要がある
      // ただし deps には入れない（無限ループ防止）
      const currentFiltered = filteredNavItems;
      const first = currentFiltered[0];
      if (!first) return;
      event.preventDefault();
      if (onNavigate) onNavigate();
      navigate(first.to);
    },
    [navigate],  // ← filteredNavItems を削除
  );

  const handleMobileNavigate = useCallback(() => {
    setMobileOpen(false);
    setNavQuery('');
  }, []);

  const handleToggleNavCollapse = useCallback(() => {
    setNavCollapsed((v) => !v);
    setNavQuery('');
  }, []);

  const groupedNavItems = useMemo(() => {
    return groupNavItems(filteredNavItems, isAdmin);
  }, [filteredNavItems, isAdmin]);

  const currentPathname = location.pathname;  // ✅ 参照を安定化

  const renderNavItem = useCallback((item: NavItem, onNavigate?: () => void) => {
    const { label, to, isActive, testId, icon: IconComponent, prefetchKey, prefetchKeys } = item;
    const active = isActive(currentPathname, location.search);
    const isBlackNote = label.includes('黒ノート');
    const showLabel = !navCollapsed;

    const handleClick = (e: React.MouseEvent) => {
      if (onNavigate) onNavigate();
      // SPA遷移時にフォーカスが残りTooltipが表示され続けるのを防ぐ
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.blur();
      }
    };

    const commonProps = {
      selected: active,
      'data-testid': testId,
      'aria-current': active ? ('page' as const) : undefined,
      onClick: handleClick,
      sx: {
        ...(isBlackNote && active ? {
          borderLeft: 4,
          borderColor: 'primary.main',
          fontWeight: 700,
          '& .MuiListItemText-primary': {
            fontWeight: 700,
          },
        } : {}),
        ...(navCollapsed ? {
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        } : {}),
      },
    };

    const content = (
      <>
        {IconComponent && (
          <ListItemIcon>
            <IconComponent />
          </ListItemIcon>
        )}
        {showLabel && <ListItemText primary={label} primaryTypographyProps={{ noWrap: true }} />}
      </>
    );

    if (prefetchKey) {
      const button = (
        <ListItemButton
          key={label}
          component={NavLinkPrefetch as unknown as React.ElementType}
          to={to}
          {...commonProps}
          {...({ preloadKey: prefetchKey, preloadKeys: prefetchKeys, meta: { label } } as Record<string, unknown>)}
        >
          {content}
        </ListItemButton>
      );

      if (navCollapsed && !showLabel) {
        return (
          <Tooltip key={`${label}-${currentPathname}`} title={label} placement="right" enterDelay={100} disableInteractive>
            <Box sx={{ width: '100%' }}>
              {button}
            </Box>
          </Tooltip>
        );
      }

      return button;
    }

    const button = (
      <ListItemButton
        key={label}
        component={RouterLink as unknown as React.ElementType}
        to={to}
        {...commonProps}
      >
        {content}
      </ListItemButton>
    );

    if (navCollapsed && !showLabel) {
      return (
        <Tooltip key={`${label}-${currentPathname}`} title={label} placement="right" enterDelay={100} disableInteractive>
          <Box sx={{ width: '100%' }}>
            {button}
          </Box>
        </Tooltip>
      );
    }

    return button;
  }, [currentPathname, isAdmin, navCollapsed]);

  const renderGroupedNavList = (onNavigate?: () => void) => {
    if (filteredNavItems.length === 0) {
      return (
        <List dense sx={{ px: 1 }}>
          <ListItem disablePadding>
            <ListItemText
              primary="該当なし"
              primaryTypographyProps={{ variant: 'body2' }}
              sx={{ px: 2, py: 1, opacity: 0.7 }}
            />
          </ListItem>
        </List>
      );
    }

    return (
      <List dense component="div" sx={{ px: 1 }}>
        {groupedNavItems.ORDER.map((groupKey) => {
          const items = groupedNavItems.map.get(groupKey) ?? [];
          if (items.length === 0) return null;

          return (
            <Box key={groupKey} sx={{ mb: 1.5 }}>
              {!navCollapsed && (
                <ListSubheader
                  component="div"
                  sx={{
                    position: 'static',
                    bgcolor: 'background.paper',
                    lineHeight: 1.6,
                    py: 0.5,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    px: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  {groupLabel[groupKey]}
                </ListSubheader>
              )}
              {items.map((item) => renderNavItem(item, onNavigate))}
              {!navCollapsed && groupKey !== 'settings' && <Divider sx={{ mt: 1, mb: 0.5 }} />}
            </Box>
          );
        })}
      </List>
    );
  };

  const showDesktopSidebar = !isFocusMode && isDesktop && desktopNavOpen;
  const useVscodeShell = appShellVsCode && !isFocusMode;
  const activityItems = useMemo(
    () => [
      {
        label: 'Daily',
        to: '/daily',
        icon: EditNoteIcon,
        isActive: (pathname: string) =>
          pathname.startsWith('/daily') || pathname.startsWith('/dailysupport') || pathname.startsWith('/handoff') || pathname.startsWith('/meeting'),
      },
      {
        label: 'Records',
        to: '/records',
        icon: AssignmentTurnedInRoundedIcon,
        isActive: (pathname: string) => pathname.startsWith('/records') || pathname.startsWith('/monthly'),
      },
      {
        label: 'Schedules',
        to: '/schedules/week',
        icon: EventAvailableRoundedIcon,
        isActive: (pathname: string) => pathname.startsWith('/schedules') || pathname.startsWith('/schedule'),
      },
      {
        label: 'Users',
        to: '/users',
        icon: PeopleAltRoundedIcon,
        isActive: (pathname: string) => pathname.startsWith('/users') || pathname.startsWith('/staff'),
      },
      {
        label: 'Audit',
        to: '/audit',
        icon: AssessmentRoundedIcon,
        isActive: (pathname: string) => pathname.startsWith('/audit') || pathname.startsWith('/checklist'),
      },
    ],
    [],
  );

  const headerLeftSlot = isFocusMode ? null : (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {!isDesktop && (
        <IconButton
          color="inherit"
          aria-label="メニューを開く"
          onClick={() => setMobileOpen(true)}
          edge="start"
          data-testid={TESTIDS['nav-open']}
          size="small"
          sx={{ p: 0.5 }}
        >
          <MenuIcon />
        </IconButton>
      )}
      {isDesktop && (
        <IconButton
          color="inherit"
          aria-label={desktopNavOpen ? 'サイドメニューを閉じる' : 'サイドメニューを開く'}
          aria-expanded={desktopNavOpen}
          onClick={() => setDesktopNavOpen((prev) => !prev)}
          edge="start"
          data-testid="desktop-nav-open"
          size="small"
          sx={{ p: 0.5 }}
        >
          <MenuIcon />
        </IconButton>
      )}
    </Box>
  );

  const headerRightSlot = isFocusMode ? null : (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <ConnectionStatus />
      <Tooltip title="表示設定">
        <IconButton
          color="inherit"
          onClick={() => setSettingsDialogOpen(true)}
          aria-label="表示設定"
          size="small"
          sx={{ p: 0.5 }}
        >
          <SettingsRoundedIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={mode === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}>
        <IconButton
          color="inherit"
          onClick={toggle}
          aria-label="テーマ切り替え"
          aria-pressed={mode === 'dark' ? 'true' : 'false'}
          size="small"
          sx={{ p: 0.5 }}
        >
          {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Tooltip>
      <IconButton
        component={RouterLink}
        to="/audit"
        color="inherit"
        aria-label="監査ログ"
        size="small"
        sx={{ p: 0.5 }}
      >
        <HistoryIcon />
      </IconButton>
      <SignInButton />
    </Box>
  );

  const sidebarContent = showDesktopSidebar ? (
    <Box
      role="navigation"
      aria-label="主要ナビゲーション"
      data-testid="nav-drawer"
      sx={{ pt: 2, pb: 2, height: '100%', overflow: 'auto' }}
    >
      {!navCollapsed && (
        <Box sx={{ px: 1.5, py: 1, pb: 1.5 }} key="nav-search">
          <TextField
            key="nav-search-field"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            onKeyDown={handleNavSearchKeyDown}
            size="small"
            placeholder="メニュー検索"
            fullWidth
            inputProps={{ 'aria-label': 'メニュー検索' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: navCollapsed ? 'center' : 'flex-end', px: 1, py: 0.5 }}>
        <Tooltip title={navCollapsed ? 'ナビを展開' : 'ナビを折りたたみ'} placement="right" enterDelay={100}>
          <IconButton
            onClick={handleToggleNavCollapse}
            aria-label={navCollapsed ? 'ナビを展開' : 'ナビを折りたたみ'}
            size="small"
          >
            {navCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      {renderGroupedNavList()}
    </Box>
  ) : null;

  const footerContent = !isFocusMode ? <FooterQuickActions fixed={false} /> : null;

  const headerContent = isFocusMode || useVscodeShell ? null : (
    <AppBar
      position="static"
      color="primary"
      enableColorOnDark
      sx={{
        height: '100%',
        width: '100%',
        borderRadius: 0,
        left: 0,
        right: 0,
        '& .MuiToolbar-root': {
          height: 44,
          minHeight: '44px !important',
          paddingTop: 0,
          paddingBottom: 0,
          alignItems: 'center',
        },
        '& .MuiToolbar-root .MuiTypography-root': {
          height: 44,
          lineHeight: '44px !important',
          display: 'flex',
          alignItems: 'center',
        },
        '& .MuiToolbar-root .MuiIconButton-root': {
          alignSelf: 'center',
        },
        '& .MuiToolbar-root .MuiChip-root': {
          alignSelf: 'center',
        },
        '& .MuiToolbar-root .MuiButton-root': {
          alignSelf: 'center',
        },
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          px: 1,
          minHeight: 44,
          height: 44,
          alignItems: 'center',
          '& > *': { alignSelf: 'center' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!isDesktop && (
            <IconButton
              color="inherit"
              aria-label="メニューを開く"
              onClick={() => setMobileOpen(true)}
              edge="start"
              data-testid={TESTIDS['nav-open']}
              size="small"
              sx={{ p: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {isDesktop && (
            <IconButton
              color="inherit"
              aria-label={desktopNavOpen ? 'サイドメニューを閉じる' : 'サイドメニューを開く'}
              aria-expanded={desktopNavOpen}
              onClick={() => setDesktopNavOpen((prev) => !prev)}
              edge="start"
              data-testid="desktop-nav-open"
              size="small"
              sx={{ p: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="subtitle1"
            component={RouterLink}
            to={dashboardPath}
            sx={{
              fontWeight: 600,
              lineHeight: '44px',
              height: 44,
              display: 'flex',
              alignItems: 'center',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            磯子区障害者地域活動ホーム
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ConnectionStatus />
          <Tooltip title="表示設定">
            <IconButton
              color="inherit"
              onClick={() => setSettingsDialogOpen(true)}
              aria-label="表示設定"
              size="small"
              sx={{ p: 0.5 }}
            >
              <SettingsRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={mode === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}>
            <IconButton
              color="inherit"
              onClick={toggle}
              aria-label="テーマ切り替え"
              aria-pressed={mode === 'dark' ? 'true' : 'false'}
              size="small"
              sx={{ p: 0.5 }}
            >
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          <IconButton
            component={RouterLink}
            to="/audit"
            color="inherit"
            aria-label="監査ログ"
            size="small"
            sx={{ p: 0.5 }}
          >
            <HistoryIcon />
          </IconButton>
          <SignInButton />
        </Box>
      </Toolbar>
    </AppBar>
  );

  const activityBarContent = isFocusMode || !useVscodeShell ? null : <ActivityBar items={activityItems} />;

  return (
    <RouteHydrationListener>
      <LiveAnnouncer>
        <div data-testid="app-shell">
        {useVscodeShell ? (
          <AppShellLayout
            title={(
              <Typography
                component={RouterLink}
                to={dashboardPath}
                variant="body2"
                sx={{
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                磯子区障害者地域活動ホーム
              </Typography>
            )}
            onSearchChange={setNavQuery}
            headerLeftSlot={headerLeftSlot}
            headerRightSlot={headerRightSlot}
            hideHeader={isFocusMode}
            activityBar={activityBarContent}
            sidebar={sidebarContent}
            footer={footerContent}
            sidebarWidth={showDesktopSidebar ? currentDrawerWidth : 0}
            contentPaddingX={isFocusMode ? 0 : 16}
            contentPaddingY={contentPaddingY}
            viewportMode={viewportMode}
          >
            {children}
          </AppShellLayout>
        ) : (
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
        )}

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
            <Box
              role="navigation"
              aria-label="主要ナビゲーション"
              data-testid="nav-items"
              sx={{ pt: 2, overflowY: 'auto', height: '100vh' }}
            >
              <Box sx={{ px: 1.5, pb: 1.5 }}>
                <TextField
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onKeyDown={(e) => handleNavSearchKeyDown(e as any, handleMobileNavigate)}
                  size="small"
                  placeholder="メニュー検索"
                  fullWidth
                  inputProps={{ 'aria-label': 'メニュー検索' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              {renderGroupedNavList(handleMobileNavigate)}
            </Box>
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
        {/* AuthDiagnosticsPanel — disabled to reduce layout noise. Enable via /auth/diagnostics if needed */}
        <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
      </div>
      </LiveAnnouncer>
    </RouteHydrationListener>
  );
};


export const shouldTriggerNavShellHud = (event: KeyboardEvent): boolean => {
  // Ignore repeated key events
  if (event.repeat) return false;

  // Must be Alt+P (case insensitive)
  if (!event.altKey || event.key.toLowerCase() !== 'p') return false;

  // Must not have other modifier keys
  if (event.ctrlKey || event.shiftKey || event.metaKey) return false;

  // Check if focused element is editable
  const target = event.target as Element;
  if (target) {
    const tagName = target.tagName?.toLowerCase();

    // Input and textarea elements
    if (tagName === 'input' || tagName === 'textarea') return false;

    // Contenteditable elements
    if (target instanceof HTMLElement && target.isContentEditable) return false;
  }

  return true;
};

export default AppShell;

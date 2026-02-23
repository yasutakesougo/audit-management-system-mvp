import LiveAnnouncer from '@/a11y/LiveAnnouncer';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
// Navigation Icons
import { useMsalContext } from '@/auth/MsalProvider';
import { canAccess } from '@/auth/roles';
import { useUserAuthz } from '@/auth/useUserAuthz';
import NavLinkPrefetch from '@/components/NavLinkPrefetch';
import { ActivityBar } from '@/app/layout/ActivityBar';
import { AppShell as AppShellLayout } from '@/app/layout/AppShell';
import { AppShellV2 } from '@/components/layout/AppShellV2';
import { useFeatureFlags } from '@/config/featureFlags';
import { useAuthStore } from '@/features/auth/store';
import { AuthDiagnosticsPanel } from '@/features/auth/diagnostics';
import { useDashboardPath } from '@/features/dashboard/dashboardRouting';
import { HandoffQuickNoteCard } from '@/features/handoff/HandoffQuickNoteCard';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';
import { getAppConfig, isE2eMsalMockEnabled, readBool, shouldSkipLogin } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { TESTIDS } from '@/testids';
import SignInButton from '@/ui/components/SignInButton';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import InsightsIcon from '@mui/icons-material/Insights';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Fab from '@mui/material/Fab';
import { ColorModeContext } from './theme';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { useSettingsContext } from '@/features/settings/SettingsContext';
import {
  createNavItems,
  filterNavItems,
  groupNavItems,
  groupLabel,
  NAV_AUDIENCE,
  type NavItem,
  type NavAudience,
} from '@/app/config/navigationConfig';

const SKIP_LOGIN = shouldSkipLogin();
const E2E_MSAL_MOCK_ENABLED = isE2eMsalMockEnabled();

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
  const { schedules, complianceForm, icebergPdca, staffAttendance, appShellVsCode } = useFeatureFlags();
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
  const [desktopNavOpen, setDesktopNavOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [navCollapsed, setNavCollapsed] = useState(false);
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
  }, [dashboardPath, currentRole, schedulesEnabled, complianceFormEnabled, icebergPdcaEnabled, staffAttendanceEnabled, isAdmin, authzReady, navAudience]);

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
    const active = isActive(currentPathname);
    const isBlackNote = label.includes('黒ノート');
    const showLabel = !navCollapsed;

    const handleClick = () => {

      if (onNavigate) onNavigate();
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
        {showLabel && <ListItemText primary={label} />}
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
          <Tooltip key={label} title={label} placement="right" enterDelay={100} disableInteractive>
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
        <Tooltip key={label} title={label} placement="right" enterDelay={100} disableInteractive>
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
      <List dense sx={{ px: 1 }}>
        {groupedNavItems.ORDER.map((groupKey) => {
          const items = groupedNavItems.map.get(groupKey) ?? [];
          if (items.length === 0) return null;

          return (
            <Box key={groupKey} sx={{ mb: 1.5 }}>
              {!navCollapsed && (
                <ListSubheader
                  sx={{
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
      sx={{ overflowY: 'auto', height: '100%', pt: 2, pb: 10 }}
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
            component="div"
            sx={{ fontWeight: 600, lineHeight: '44px', height: 44, display: 'flex', alignItems: 'center' }}
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
            title="磯子区障害者地域活動ホーム"
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
        {import.meta.env.DEV && <AuthDiagnosticsPanel limit={15} pollInterval={2000} />}
        <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
      </div>
      </LiveAnnouncer>
    </RouteHydrationListener>
  );
};

const ConnectionStatus: React.FC = () => {
  const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
  const e2eMode = readBool('VITE_E2E', false) && !isVitest;
  const sharePointDisabled = readBool('VITE_SKIP_SHAREPOINT', false);
  const shouldMockConnection = e2eMode || sharePointDisabled || E2E_MSAL_MOCK_ENABLED;

  return shouldMockConnection ? <ConnectionStatusMock /> : <ConnectionStatusReal sharePointDisabled={sharePointDisabled} />;
};

const ConnectionStatusMock: React.FC = () => {
  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="sp-connection-status"
      data-connection-state="ok"
      sx={{
        background: '#2e7d32',
        color: '#fff',
        px: 1,
        py: 0.25,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        minWidth: 90,
        textAlign: 'center',
      }}
    >
      SP Connected
    </Box>
  );
};

const ConnectionStatusReal: React.FC<{ sharePointDisabled: boolean }> = ({ sharePointDisabled }) => {
  const forceSharePoint = readBool('VITE_FORCE_SHAREPOINT', false);
  const sharePointFeatureEnabled = readBool('VITE_FEATURE_SCHEDULES_SP', false);
  const { spFetch } = useSP();
  const { accounts } = useMsalContext();
  const accountsCount = accounts.length;
  const [state, setState] = useState<'checking' | 'ok' | 'error' | 'signedOut'>('checking');
  const bypassAccountGate = SKIP_LOGIN || E2E_MSAL_MOCK_ENABLED;
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === '1';

  useEffect(() => {
    // Complete demo mode bypass: Skip SharePoint entirely when demo mode is active
    if (isDemoMode) {
      // eslint-disable-next-line no-console
      console.info('[demo] Skip SharePoint bootstrap');
      setState('ok');
      return;
    }

    const { isDev: isDevelopment } = getAppConfig();
    const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
    const shouldCheckSharePoint =
      !sharePointDisabled && (!isDevelopment || isVitest || forceSharePoint || sharePointFeatureEnabled);

    if (!shouldCheckSharePoint) {
      console.info('SharePoint 接続チェックをスキップし、モック状態に設定');
      setState('ok');
      return;
    }

    if (!bypassAccountGate && accountsCount === 0) {
      setState('signedOut');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setState('checking');
        const result = await spFetch('/currentuser?$select=Id', { signal: controller.signal });
        if (cancelled) return;
        let ok = false;
        if (result instanceof Response) {
          ok = result.ok;
        } else if (result && typeof result === 'object' && 'ok' in result) {
          ok = Boolean((result as { ok?: unknown }).ok);
        }
        setState(ok ? 'ok' : 'error');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') {
          setState('checking');
          return;
        }
        console.warn('SharePoint 接続エラー:', error);
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isDemoMode, accountsCount, bypassAccountGate, forceSharePoint, sharePointFeatureEnabled, sharePointDisabled]);

  const { label, background } = useMemo(() => {
    switch (state) {
      case 'signedOut':
        return { label: 'SP Sign-In', background: '#0277bd' };
      case 'ok':
        return { label: 'SP Connected', background: '#2e7d32' };
      case 'error':
        return { label: 'SP Error', background: '#d32f2f' };
      default:
        return { label: 'Checking', background: '#ffb300' };
    }
  }, [state]);

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="sp-connection-status"
      data-connection-state={state}
      sx={{
        background,
        color: '#fff',
        px: 1,
        py: 0.25,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        minWidth: 90,
        textAlign: 'center',
      }}
    >
      {label}
    </Box>
  );
};

const FooterQuickActions: React.FC<{ fixed?: boolean }> = ({ fixed = true }) => {
  const location = useLocation();
  const theme = useTheme();
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const isHandoffTimeline =
    location.pathname === '/handoff-timeline' || location.pathname.startsWith('/handoff-timeline/');

  type FooterAction = {
    key: string;
    label: string;
    color: 'primary' | 'secondary' | 'info';
    variant: 'contained' | 'outlined';
    to?: string;
    onClick?: () => void;
  };

  const footerTestIds: Record<string, string> = {
    'schedules-month': TESTIDS['schedules-footer-month'],
    'daily-attendance': TESTIDS['daily-footer-attendance'],
    'daily-activity': TESTIDS['daily-footer-activity'],
    'daily-support': TESTIDS['daily-footer-support'],
    'handoff-quicknote': TESTIDS['handoff-footer-quicknote'],
  };

  const footerAccentByKey: Record<string, string> = {
    'handoff-quicknote': '#C53030',
    'schedules-month': '#B7791F',
    'daily-attendance': '#2F855A',
    'daily-activity': '#C05621',
    'daily-support': '#6B46C1',
  };

  const footerShortLabelByKey: Record<string, string> = {
    'handoff-quicknote': '申し送り',
    'schedules-month': '予定',
    'daily-attendance': '通所',
    'daily-activity': 'ケース記録',
    'daily-support': '支援手順',
  };

  const scheduleMonthAction: FooterAction = {
    key: 'schedules-month',
    label: 'スケジュール',
    to: '/schedules/month',
    color: 'info' as const,
    variant: 'contained' as const,
  };

  const baseActions: FooterAction[] = [
    {
      key: 'daily-attendance',
      label: '通所管理',
      to: '/daily/attendance',
      color: 'info' as const,
      variant: 'contained' as const,
    },
    {
      key: 'daily-activity',
      label: 'ケース記録入力',
      to: '/daily/table',
      color: 'primary' as const,
      variant: 'contained' as const,
    },
    {
      key: 'daily-support',
      label: '支援手順記録入力',
      to: '/daily/support',
      color: 'primary' as const,
      variant: 'outlined' as const,
    },
  ] as const;

  const handleQuickNoteClick = () => {
    if (isHandoffTimeline) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('handoff-open-quicknote'));
      }
      return;
    }
    setQuickNoteOpen(true);
  };

  const actions: FooterAction[] = [
    {
      key: 'handoff-quicknote',
      label: '今すぐ申し送り',
      color: 'secondary' as const,
      variant: 'contained' as const,
      onClick: handleQuickNoteClick,
    },
    scheduleMonthAction,
    ...baseActions,
  ];

  return (
    <Box
      component="footer"
      role="contentinfo"
      sx={{
        position: fixed ? 'fixed' : 'static',
        bottom: fixed ? { xs: 8, sm: 16 } : 'auto',
        left: fixed ? 0 : 'auto',
        width: '100%',
        pointerEvents: fixed ? 'none' : 'auto',
        zIndex: fixed ? ((theme) => theme.zIndex.appBar) : 'auto',
      }}
    >
      <Container maxWidth="lg" sx={fixed ? { pointerEvents: 'auto' } : undefined}>
        <Paper
          elevation={6}
          sx={{
            height: 56,
            borderRadius: 0,
            px: { xs: 1, sm: 2 },
            py: { xs: 0.5, sm: 1 },
            pb: 'calc(1px * (var(--mobile-safe-area, 0)) + 0.5rem)',
            backdropFilter: 'blur(6px)',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(33, 33, 33, 0.95)'
                : 'rgba(255, 255, 255, 0.98)',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{
              width: '100%',
              height: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              flexWrap: 'nowrap',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': { height: 4 },
            }}
          >
            {actions.map(({ key, label, to, color, variant: baseVariant, onClick }) => {
              const displayLabel = footerShortLabelByKey[key] ?? label;
              const commonProps = {
                color,
                size: 'small' as const,
                fullWidth: true,
                sx: {
                  flex: 1,
                  minHeight: 44,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  py: 0.5,
                },
                'data-testid': footerTestIds[key],
              };

              if (to) {
                const targetPath = to.split('?')[0];
                const isActive = location.pathname.startsWith(targetPath);
                const accent = footerAccentByKey[key] ?? theme.palette.primary.main;
                const activeSx = isActive
                  ? {
                      color: accent,
                      borderBottom: `3px solid ${accent}`,
                      borderRadius: 0,
                      fontWeight: 700,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }
                  : undefined;
                return (
                  <Button
                    key={key}
                    {...commonProps}
                    component={RouterLink as unknown as React.ElementType}
                    to={to}
                    variant={isActive ? 'contained' : baseVariant}
                    aria-current={isActive ? 'page' : undefined}
                    sx={{ ...commonProps.sx, ...activeSx }}
                  >
                    {displayLabel}
                  </Button>
                );
              }

              return (
                <Button
                  key={key}
                  {...commonProps}
                  variant={baseVariant}
                  startIcon={<EditNoteIcon />}
                  onClick={onClick}
                  data-testid={key === 'handoff-quicknote' ? TESTIDS['handoff-footer-quicknote'] : undefined}
                >
                  {displayLabel}
                </Button>
              );
            })}
          </Stack>
        </Paper>
      </Container>
      {!isHandoffTimeline && (
        <Dialog
          open={quickNoteOpen}
          onClose={() => setQuickNoteOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            今すぐ申し送り
            <IconButton aria-label="申し送りダイアログを閉じる" onClick={() => setQuickNoteOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <HandoffQuickNoteCard />
          </DialogContent>
        </Dialog>
      )}
    </Box>
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

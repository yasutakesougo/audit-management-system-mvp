import LiveAnnouncer from '@/a11y/LiveAnnouncer';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
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
import { useUserAuthz } from '@/auth/useUserAuthz';
import NavLinkPrefetch from '@/components/NavLinkPrefetch';
import { AppShellV2 } from '@/components/layout/AppShellV2';
import { useFeatureFlags } from '@/config/featureFlags';
import { useAuthStore } from '@/features/auth/store';
import { AuthDiagnosticsPanel } from '@/features/auth/diagnostics';
import { useDashboardPath } from '@/features/dashboard/dashboardRouting';
import { HandoffQuickNoteCard } from '@/features/handoff/HandoffQuickNoteCard';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';
import { getAppConfig, isE2eMsalMockEnabled, readBool, shouldSkipLogin } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { PREFETCH_KEYS, type PrefetchKey } from '@/prefetch/routes';
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

type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  prefetchKey?: PrefetchKey;
  prefetchKeys?: PrefetchKey[];
};

type NavGroupKey = 'blacknote' | 'record' | 'analysis' | 'master' | 'admin' | 'report';

const groupLabel: Record<NavGroupKey, string> = {
  blacknote: '📓 黒ノート',
  record: '🗓 記録・運用',
  analysis: '📊 分析・PDCA',
  master: '👥 マスター',
  admin: '🛡 管理',
  report: '📣 申請・報告',
};

function pickGroup(item: NavItem, isAdmin: boolean): NavGroupKey {
  const { to, label, testId } = item;
  // 黒ノート: testId起点で安定判定（最優先）
  if (testId === TESTIDS.nav.dashboard || to === '/' || to.startsWith('/dashboard') || to.startsWith('/admin/dashboard') || label.includes('黒ノート')) {
    return 'blacknote';
  }
  // 記録・運用: daily, schedules
  if (testId === TESTIDS.nav.daily || testId === TESTIDS.nav.schedules || to.startsWith('/daily') || to.startsWith('/schedule') || label.includes('日次') || label.includes('スケジュール')) {
    return 'record';
  }
  // 分析・PDCA: analysis, iceberg, assessment
  if (testId === TESTIDS.nav.analysis || testId === TESTIDS.nav.iceberg || testId === TESTIDS.nav.icebergPdca || testId === TESTIDS.nav.assessment || to.startsWith('/analysis') || to.startsWith('/assessment') || to.startsWith('/survey') || label.includes('分析') || label.includes('氷山') || label.includes('アセスメント') || label.includes('特性')) {
    return 'analysis';
  }
  // マスター: users, staff
  if (to.startsWith('/users') || to.startsWith('/staff') || label.includes('利用者') || label.includes('職員')) {
    return 'master';
  }
  // 管理: checklist, audit, admin/templates (管理者のみ)
  if (isAdmin && (testId === TESTIDS.nav.checklist || testId === TESTIDS.nav.audit || testId === TESTIDS.nav.admin || to.startsWith('/checklist') || to.startsWith('/audit') || to.startsWith('/admin') || label.includes('自己点検') || label.includes('監査') || label.includes('設定'))) {
    return 'admin';
  }
  // 申請・報告: compliance
  if (to.startsWith('/compliance') || label.includes('コンプラ')) {
    return 'report';
  }
  // デフォルトは記録
  return 'record';
}

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
  const { schedules, complianceForm, icebergPdca, staffAttendance } = useFeatureFlags();
  const { mode, toggle } = useContext(ColorModeContext);
  const dashboardPath = useDashboardPath();
  const currentRole = useAuthStore((s) => s.currentUserRole);
  const setCurrentUserRole = useAuthStore((s) => s.setCurrentUserRole);
  const { isAdmin, ready: authzReady } = useUserAuthz();
  const theme = useTheme();
  const { settings, updateSettings } = useSettingsContext();
  const isFocusMode = settings.layoutMode === 'focus';

  // ✅ 修正：Object を直接依存に入れず、boolean フラグを作る
  const schedulesEnabled = Boolean(schedules);
  const complianceFormEnabled = Boolean(complianceForm);
  const icebergPdcaEnabled = Boolean(icebergPdca);
  const staffAttendanceEnabled = Boolean(staffAttendance);
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavOpen, setDesktopNavOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [navCollapsed, setNavCollapsed] = useState(true);
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

  const navItems = useMemo(() => {
    // Side-nav intentionally excludes:
    // - /analysis/iceberg-pdca/edit (edit-only)
    // - /dev/schedule-create-dialog (dev-only)
    // - /daily/activity, /daily/support-checklist, /daily/time-based
    // - /schedules/day, /schedules/month
    const items: NavItem[] = [
      {
        label: '日次記録',
        to: '/dailysupport',
        isActive: (pathname) => pathname === '/dailysupport' || pathname.startsWith('/daily/'),
        icon: AssignmentTurnedInRoundedIcon,
        prefetchKey: PREFETCH_KEYS.dailyMenu,
        testId: TESTIDS.nav.daily,
      },
      {
        label: '健康記録',
        to: '/daily/health',
        isActive: (pathname) => pathname.startsWith('/daily/health'),
        icon: EditNoteIcon,
      },
      {
        label: '申し送りタイムライン',
        to: '/handoff-timeline',
        isActive: (pathname) => pathname.startsWith('/handoff-timeline'),
        icon: HistoryIcon,
      },
      {
        label: '司会ガイド',
        to: '/meeting-guide',
        isActive: (pathname) => pathname.startsWith('/meeting-guide'),
        icon: PsychologyIcon,
      },
      {
        label: '黒ノート一覧',
        to: '/records',
        isActive: (pathname) => pathname.startsWith('/records'),
        icon: AssignmentTurnedInRoundedIcon,
      },
      {
        label: '月次記録',
        to: '/records/monthly',
        isActive: (pathname) => pathname.startsWith('/records/monthly'),
        icon: AssessmentRoundedIcon,
      },
      {
        label: '分析',
        to: '/analysis/dashboard',
        isActive: (pathname) => pathname.startsWith('/analysis/dashboard'),
        icon: InsightsIcon,
        prefetchKey: PREFETCH_KEYS.analysisDashboard,
        testId: TESTIDS.nav.analysis,
      },
      {
        label: '氷山分析',
        to: '/analysis/iceberg',
        isActive: (pathname) => pathname.startsWith('/analysis/iceberg'),
        icon: WorkspacesIcon,
        prefetchKey: PREFETCH_KEYS.iceberg,
        testId: TESTIDS.nav.iceberg,
      },
      {
        label: 'アセスメント',
        to: '/assessment',
        isActive: (pathname) => pathname.startsWith('/assessment'),
        icon: PsychologyIcon,
        prefetchKey: PREFETCH_KEYS.assessmentDashboard,
        testId: TESTIDS.nav.assessment,
      },
      {
        label: '特性アンケート',
        to: '/survey/tokusei',
        isActive: (pathname) => pathname.startsWith('/survey/tokusei'),
        icon: EditNoteIcon,
      },
      {
        label: '利用者',
        to: '/users',
        isActive: (pathname: string) => pathname.startsWith('/users'),
        icon: PeopleAltRoundedIcon,
        prefetchKey: PREFETCH_KEYS.users,
      },
      {
        label: '職員',
        to: '/staff',
        isActive: (pathname: string) => pathname.startsWith('/staff') && !pathname.startsWith('/staff/attendance'),
        icon: BadgeRoundedIcon,
        prefetchKey: PREFETCH_KEYS.staff,
      },
      ...(staffAttendanceEnabled ? [
        {
          label: '職員勤怠',
          to: '/staff/attendance',
          isActive: (pathname: string) => pathname.startsWith('/staff/attendance'),
          icon: BadgeRoundedIcon,
          prefetchKey: PREFETCH_KEYS.staff,
          testId: TESTIDS.nav.staffAttendance,
        },
      ] : []),
      ...(isAdmin && (authzReady || SKIP_LOGIN) ? [
        {
          label: '支援手順テンプレ',
          to: '/admin/step-templates',
          isActive: (pathname: string) => pathname.startsWith('/admin/step-templates'),
          icon: ChecklistRoundedIcon,
        },
        {
          label: '個別支援手順',
          to: '/admin/individual-support',
          isActive: (pathname: string) => pathname.startsWith('/admin/individual-support'),
          icon: WorkspacesIcon,
        },
        {
          label: '職員勤怠管理',
          to: '/admin/staff-attendance',
          isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
          icon: BadgeRoundedIcon,
        },
        {
          label: '自己点検',
          to: '/checklist',
          isActive: (pathname: string) => pathname.startsWith('/checklist'),
          icon: ChecklistRoundedIcon,
          prefetchKey: PREFETCH_KEYS.checklist,
          testId: TESTIDS.nav.checklist,
        },
        {
          label: '監査ログ',
          to: '/audit',
          isActive: (pathname: string) => pathname.startsWith('/audit'),
          testId: TESTIDS.nav.audit,
          icon: AssessmentRoundedIcon,
          prefetchKey: PREFETCH_KEYS.audit,
        },
      ] : []),
      {
        label: '設定管理',
        to: '/admin/templates',
        isActive: (pathname: string) => pathname.startsWith('/admin'),
        icon: SettingsRoundedIcon,
        prefetchKey: PREFETCH_KEYS.adminTemplates,
        prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
        testId: TESTIDS.nav.admin,
      },
    ];

    if (icebergPdcaEnabled && !items.some(item => item.testId === TESTIDS.nav.icebergPdca)) {
      items.splice(3, 0, {
        label: '氷山PDCA',
        to: '/analysis/iceberg-pdca',
        isActive: (pathname: string) => pathname.startsWith('/analysis/iceberg-pdca'),
        icon: HistoryIcon,
        prefetchKey: PREFETCH_KEYS.icebergPdcaBoard,
        testId: TESTIDS.nav.icebergPdca,
      });
    }

    if (schedulesEnabled && !items.some(item => item.testId === TESTIDS.nav.schedules)) {
      items.push({
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: (pathname: string) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
        testId: TESTIDS.nav.schedules,
        icon: EventAvailableRoundedIcon,
        prefetchKey: PREFETCH_KEYS.schedulesWeek,
        prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
      });
    }

    if (complianceFormEnabled) {
      items.push({
        label: 'コンプラ報告',
        to: '/compliance',
        isActive: (pathname: string) => pathname.startsWith('/compliance'),
        icon: ChecklistRoundedIcon,
      });
    }

    return items;
  }, [dashboardPath, currentRole, schedulesEnabled, complianceFormEnabled, icebergPdcaEnabled, staffAttendanceEnabled, isAdmin, authzReady]);

  const filteredNavItems = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((item) => (item.label ?? '').toLowerCase().includes(q));
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
    const ORDER: NavGroupKey[] = ['blacknote', 'record', 'analysis', 'master', 'admin', 'report'];
    const map = new Map<NavGroupKey, NavItem[]>();
    ORDER.forEach((k) => map.set(k, []));

    for (const item of filteredNavItems) {
      const group = pickGroup(item, isAdmin);
      map.get(group)!.push(item);
    }

    return { map, ORDER };
  }, [filteredNavItems, isAdmin]);

  const currentPathname = location.pathname;  // ✅ 参照を安定化
  
  const renderNavItem = useCallback((item: NavItem, onNavigate?: () => void) => {
    const { label, to, isActive, testId, icon: IconComponent, prefetchKey, prefetchKeys } = item;
    const active = isActive(currentPathname);
    const isBlackNote = pickGroup(item, isAdmin) === 'blacknote';
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
              {!navCollapsed && groupKey !== 'report' && <Divider sx={{ mt: 1, mb: 0.5 }} />}
            </Box>
          );
        })}
      </List>
    );
  };

  const showDesktopSidebar = !isFocusMode && isDesktop && desktopNavOpen;

  const headerContent = !isFocusMode ? (
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
  ) : null;

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
          contentPaddingY={isFocusMode ? 0 : 16}
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
    'daily-attendance': TESTIDS['daily-footer-attendance'],
    'daily-activity': TESTIDS['daily-footer-activity'],
    'daily-support': TESTIDS['daily-footer-support'],
    'handoff-quicknote': TESTIDS['handoff-footer-quicknote'],
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
      label: '支援記録（ケース記録）入力',
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

  const actions: FooterAction[] = [...baseActions];

  const handleQuickNoteClick = () => {
    if (isHandoffTimeline) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('handoff-open-quicknote'));
      }
      return;
    }
    setQuickNoteOpen(true);
  };

  actions.unshift({
    key: 'handoff-quicknote',
    label: '今すぐ申し送り',
    color: 'secondary' as const,
    variant: 'contained' as const,
    onClick: handleQuickNoteClick,
  });

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
            borderRadius: { xs: 3, sm: 5 },
            px: { xs: 2, sm: 3 },
            py: { xs: 1.5, sm: 2 },
            backdropFilter: 'blur(6px)',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(33, 33, 33, 0.85)'
                : 'rgba(255, 255, 255, 0.9)',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
            {actions.map(({ key, label, to, color, variant: baseVariant, onClick }) => {
              const commonProps = {
                color,
                size: 'large' as const,
                fullWidth: true,
                sx: { flex: 1, fontWeight: 600 },
                'data-testid': footerTestIds[key],
              };

              if (to) {
                const targetPath = to.split('?')[0];
                const isActive = location.pathname.startsWith(targetPath);
                return (
                  <Button
                    key={key}
                    {...commonProps}
                    component={RouterLink as unknown as React.ElementType}
                    to={to}
                    variant={isActive ? 'contained' : baseVariant}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {label}
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
                  {label}
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

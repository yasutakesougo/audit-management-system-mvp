import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import HistoryIcon from '@mui/icons-material/History';
import AppBar from '@mui/material/AppBar';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import { useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useContext, useEffect, useMemo, useState } from 'react';
// Navigation Icons
import { useFeatureFlags } from '@/config/featureFlags';
import { formatArchiveLabel, getArchiveYears, getCurrentFiscalYear } from '@/features/archive/archiveUtils';
import { getAppConfig, readBool } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import SignInButton from '@/ui/components/SignInButton';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import BookRoundedIcon from '@mui/icons-material/BookRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PhotoAlbumRoundedIcon from '@mui/icons-material/PhotoAlbumRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { ColorModeContext } from './theme';

type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { schedules, schedulesCreate, complianceForm } = useFeatureFlags();
  const { mode, toggle } = useContext(ColorModeContext);
  const [navOpen, setNavOpen] = useState(false);
  const currentFiscalYear = getCurrentFiscalYear();

  const navItems = useMemo(() => {
    const items: NavItem[] = [
      {
        label: '黒ノート',
        to: '/dashboard',
        isActive: (pathname) => pathname === '/dashboard',
        icon: AssessmentRoundedIcon,
      },
      {
        label: '記録一覧',
        to: '/',
        isActive: (pathname) => pathname === '/' || pathname === '/records',
        icon: AssignmentTurnedInRoundedIcon,
      },
      {
        label: '日次記録（活動日誌）',
        to: '/records/diary',
        isActive: (pathname) => pathname.startsWith('/records/diary'),
        icon: BookRoundedIcon,
      },
      {
        label: '支援手順記録（強度行動障害）',
        to: '/records/support-procedures',
        isActive: (pathname) => pathname.startsWith('/records/support-procedures'),
        icon: AssignmentTurnedInRoundedIcon,
      },
      {
        label: '統合利用者記録',
        to: '/profiles/user001',
        isActive: (pathname) => pathname.startsWith('/profiles'),
        icon: HistoryIcon,
      },
      {
        label: '自己点検',
        to: '/checklist',
        isActive: (pathname) => pathname.startsWith('/checklist'),
        icon: ChecklistRoundedIcon,
      },
      {
        label: '監査ログ',
        to: '/audit',
        isActive: (pathname) => pathname.startsWith('/audit'),
        icon: AssessmentRoundedIcon,
      },
      {
        label: '利用者',
        to: '/users',
        isActive: (pathname) => pathname.startsWith('/users'),
        icon: PeopleAltRoundedIcon,
      },
      {
        label: '職員',
        to: '/staff',
        isActive: (pathname) => pathname.startsWith('/staff') && !pathname.startsWith('/staff/meetings'),
        icon: BadgeRoundedIcon,
      },
      {
        label: '職員会議',
        to: '/staff/meetings',
        isActive: (pathname) => pathname.startsWith('/staff/meetings'),
        icon: EventNoteRoundedIcon,
      },
    ];

    // ガイドはフラグで段階公開（強行支援手順管理の直前に配置）
    if (readBool('VITE_FEATURE_SUPPORT_PLAN_GUIDE', false)) {
      items.push({
        label: '個別支援計画書',
        to: '/guide/support-plan',
        isActive: (pathname: string) => pathname.startsWith('/guide/support-plan'),
        icon: DescriptionRoundedIcon,
      });
    }

    items.push(
      {
        label: '強行支援手順管理',
        to: '/admin/individual-support',
        isActive: (pathname) => pathname.startsWith('/admin/individual-support'),
        icon: SettingsRoundedIcon,
      }
    );

    if (schedules) {
      items.push({
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: (pathname) => pathname.startsWith('/schedules'),
        testId: 'nav-schedule',
        icon: EventAvailableRoundedIcon,
      });
    }

    if (schedulesCreate) {
      items.push({
        label: '新規予定',
        to: '/schedules/create',
        isActive: (pathname) => pathname.startsWith('/schedules/create'),
        icon: AddCircleOutlineRoundedIcon,
      });
    }

    if (complianceForm) {
      items.push({
        label: 'コンプラ報告',
        to: '/compliance',
        isActive: (pathname) => pathname.startsWith('/compliance'),
        icon: ChecklistRoundedIcon,
      });
    }

    items.push({
      label: '活動アルバム',
      to: '/albums',
      isActive: (pathname) => pathname.startsWith('/albums'),
      icon: PhotoAlbumRoundedIcon,
    });

    items.push({
      label: 'コーヒーショップ',
      to: '/coffee-shop',
      isActive: (pathname) => pathname.startsWith('/coffee-shop') && !pathname.includes('/summary'),
      icon: BookRoundedIcon,
    });

    items.push({
      label: 'コーヒー集計',
      to: '/coffee-shop/summary',
      isActive: (pathname) => pathname.startsWith('/coffee-shop/summary'),
      icon: AssessmentRoundedIcon,
    });

    const archiveYears = getArchiveYears(new Date(currentFiscalYear, 3, 1));
    archiveYears.forEach((year) => {
      items.push({
        label: formatArchiveLabel(year),
        to: `/archives/${year}`,
        isActive: (pathname: string) => pathname.startsWith(`/archives/${year}`),
        icon: ArchiveRoundedIcon,
      });
    });

    return items;
  }, [schedules, schedulesCreate, complianceForm, currentFiscalYear]);

  const navSections = useMemo(() => {
    const sections = {
      records: [] as NavItem[],
      people: [] as NavItem[],
      schedule: [] as NavItem[],
      admin: [] as NavItem[],
      archives: [] as NavItem[],
      others: [] as NavItem[],
    };

    navItems.forEach((item) => {
      const path = item.to;
      if (path === '/guide/support-plan') {
        sections.admin.push(item);
      } else if (
        path === '/dashboard' ||
        path === '/albums' ||
        path === '/' ||
        path.startsWith('/records') ||
        path.startsWith('/daily') ||
        path.startsWith('/checklist') ||
        path.startsWith('/compliance') ||
        path.startsWith('/guide') ||
        path.startsWith('/audit')
      ) {
        sections.records.push(item);
      } else if (path.startsWith('/profiles')) {
        sections.records.push(item);
      } else if (path.startsWith('/users') || path.startsWith('/staff')) {
        sections.people.push(item);
      } else if (path.startsWith('/schedules')) {
        sections.schedule.push(item);
      } else if (path.startsWith('/admin')) {
        sections.admin.push(item);
      } else if (path.startsWith('/archives')) {
        sections.archives.push(item);
      } else {
        sections.others.push(item);
      }
    });

    const order = [
      { key: 'records', title: '記録・分析' },
      { key: 'people', title: '利用者・スタッフ' },
      { key: 'schedule', title: 'スケジュール' },
      { key: 'admin', title: '支援計画・連携' },
      { key: 'archives', title: 'アーカイブコーナー' },
      { key: 'others', title: 'その他' },
    ] as const;

    return order
      .map(({ key, title }) => ({ title, items: sections[key] }))
      .filter((section) => section.items.length > 0);
  }, [navItems]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const renderNavList = () => (
    navSections.map((section, index) => (
      <React.Fragment key={section.title}>
        <List
          subheader={
            <ListSubheader disableSticky component="h2" sx={{ fontWeight: 700, fontSize: 13 }}>
              {section.title}
            </ListSubheader>
          }
        >
          {section.items.map(({ label, to, isActive, testId, icon: IconComponent }) => {
            const active = isActive(location.pathname);
            // 最小・安全: /records/diary だけaria-labelを追加
            const ariaLabel = to === '/records/diary' ? '日次記録' : undefined;
            return (
              <ListItemButton
                key={label}
                component={RouterLink}
                to={to}
                selected={active}
                data-testid={testId}
                aria-current={active ? 'page' : undefined}
                aria-label={ariaLabel}
              >
                {IconComponent ? (
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <IconComponent fontSize="small" />
                  </ListItemIcon>
                ) : null}
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{ fontWeight: active ? 600 : undefined }}
                />
              </ListItemButton>
            );
          })}
        </List>
        {index < navSections.length - 1 ? <Divider component="div" /> : null}
      </React.Fragment>
    ))
  );

  const bottomItems = useMemo(
    () =>
      [
        { label: '黒ノート', icon: <AssessmentRoundedIcon />, to: '/dashboard' },
        { label: '通所実績', icon: <EventAvailableRoundedIcon />, to: '/daily/attendance' },
        { label: '活動日誌', icon: <BookRoundedIcon />, to: '/records/diary' },
        { label: '支援手順記録', icon: <AssignmentTurnedInRoundedIcon />, to: '/records/support-procedures' },
        { label: '活動アルバム', icon: <PhotoAlbumRoundedIcon />, to: '/albums' },
        { label: '健康記録', icon: <HealingRoundedIcon />, to: '/health-record-tablet-mock' },
        ...(schedules
          ? [{ label: 'スケジュール', icon: <EventAvailableRoundedIcon />, to: '/schedules/week' }]
          : []),
        { label: 'コーヒーショップ', icon: <BookRoundedIcon />, to: '/coffee-shop' },
      ] as const,
    [schedules]
  );

  const bottomValue = useMemo(() => {
    const idx = bottomItems.findIndex(
      (item) =>
        location.pathname === item.to ||
        (item.to !== '/' && location.pathname.startsWith(`${item.to}/`))
    );
    return idx === -1 ? 0 : idx;
  }, [bottomItems, location.pathname]);

  const [bottomHeight, setBottomHeight] = useState(56);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const mainRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ResizeObserverCtor =
      typeof window !== 'undefined' ? (window as typeof window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver : undefined;
    if (!bottomRef.current || !ResizeObserverCtor) {
      return;
    }
    const observer = new ResizeObserverCtor(([entry]) => {
      if (entry) {
        setBottomHeight(Math.ceil(entry.contentRect.height));
      }
    });
    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      if (mainRef.current) {
        mainRef.current.focus();
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [location.pathname]);

  const themeToggleLabel =
    mode === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え';
  const navToggleLabel = navOpen ? 'ナビゲーションメニューを閉じる' : 'ナビゲーションメニューを開く';

  return (
    <>
      <Box
        component="a"
        href="#main"
        sx={{
          position: 'absolute',
          left: -9999,
          top: 0,
          zIndex: 1300,
          bgcolor: 'background.paper',
          px: 2,
          py: 1,
          borderRadius: 1,
          color: 'primary.main',
          fontWeight: 600,
          '&:focus': {
            left: 8,
            top: 8,
            boxShadow: 3,
          },
        }}
      >
        メインコンテンツへ移動
      </Box>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label={navToggleLabel}
            onClick={() => setNavOpen((prev) => !prev)}
            sx={{ mr: 1 }}
          >
            {navOpen ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
          </IconButton>
          <Button
            component={RouterLink}
            to="/"
            color="inherit"
            sx={{ textTransform: 'none', px: 0 }}
          >
            <Typography variant="h6" component="span" sx={{ flexGrow: 1, color: 'inherit' }}>
              磯子区障害者地域活動ホーム
            </Typography>
          </Button>
          <DevRoleSwitcher />
          <ConnectionStatus />
          <Tooltip title={themeToggleLabel}>
            <IconButton color="inherit" onClick={toggle} aria-label={themeToggleLabel}>
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          <IconButton component={RouterLink} to="/audit" color="inherit" aria-label="監査ログ">
            <HistoryIcon />
          </IconButton>
          <SignInButton />
        </Toolbar>
      </AppBar>
      <Drawer
        anchor="left"
        open={navOpen}
        onClose={() => setNavOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { width: 320, display: 'flex', flexDirection: 'column' } }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            ナビゲーション
          </Typography>
          <IconButton
            edge="end"
            aria-label="ナビゲーションメニューを閉じる"
            onClick={() => setNavOpen(false)}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Box>
        <Divider />
        <Box
          component="nav"
          role="navigation"
          aria-label="主要ナビゲーション"
          sx={{ flexGrow: 1, overflowY: 'auto', px: 1, py: 1 }}
        >
          {renderNavList()}
        </Box>
      </Drawer>
      <Container
        id="main"
        component="main"
        role="main"
        maxWidth="lg"
        tabIndex={-1}
        ref={mainRef}
        sx={{ py: 4, pb: { xs: bottomHeight + 16, lg: 12 }, outline: 'none' }}
      >
        <Box component="section" sx={{ flexGrow: 1, width: '100%' }}>
          {children}
        </Box>
      </Container>
      <Box
        ref={bottomRef}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1200,
          bgcolor: 'background.paper',
          boxShadow: 3,
        }}
      >
        <BottomNavigation
          component="nav"
          role="navigation"
          aria-label="主要ナビゲーション（モバイル）"
          showLabels
          value={bottomValue}
          data-testid="app-bottom-nav"
        >
          {bottomItems.map((item, index) => {
            const active = index === bottomValue;
            return (
              <BottomNavigationAction
                key={item.to}
                label={item.label}
                icon={item.icon}
                component={RouterLink}
                to={item.to}
                aria-current={active ? 'page' : undefined}
              />
            );
          })}
        </BottomNavigation>
      </Box>
    </>
  );
};

const ConnectionStatus: React.FC = () => {
  const { spFetch } = useSP();
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking');
  const theme = useTheme();

  useEffect(() => {
    const { isDev: isDevelopment } = getAppConfig();
    const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
    const skipCheck = (isDevelopment && !isVitest) || readBool('VITE_SKIP_SP_CHECK', false);

    // 開発モード本番ブラウザのみ SharePoint 接続チェックを省略（テストでは実行）
    if (skipCheck) {
      console.info('開発環境: SharePoint接続チェックをスキップし、モック状態に設定');
      setState('ok'); // 開発環境では常に OK として扱う
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
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
  }, [spFetch]);

  const { label, background } = useMemo(() => {
    switch (state) {
      case 'ok':
        return { label: 'SP Connected', background: theme.palette.success.main };
      case 'error':
        return { label: 'SP Error', background: theme.palette.error.main };
      default:
        return { label: 'Checking', background: theme.palette.warning.main };
    }
  }, [state, theme]);

  return (
    <Box
      role="status"
      aria-live="polite"
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

export default AppShell;

const DevRoleSwitcher: React.FC = () => {
  const enabled = readBool('VITE_FEATURE_RBAC', false);
  const dev = getAppConfig().isDev;
  const [role, setRole] = useState<string>(() => {
    try { return window.localStorage.getItem('role') || ''; } catch { return ''; }
  });
  useEffect(() => {
    try {
      if (role) window.localStorage.setItem('role', role);
      else window.localStorage.removeItem('role');
    } catch {}
  }, [role]);
  if (!dev || !enabled) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <label htmlFor="dev-role" style={{ fontSize: 12, opacity: 0.8 }}>Role</label>
      <select
        id="dev-role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        style={{ height: 28, fontSize: 12, borderRadius: 6 }}
        aria-label="開発用ロール切替"
      >
        <option value="">(なし)</option>
        <option value="Admin">Admin</option>
        <option value="Manager">Manager</option>
        <option value="Staff">Staff</option>
        <option value="Viewer">Viewer</option>
      </select>
    </Box>
  );
};

import LiveAnnouncer from '@/a11y/LiveAnnouncer';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HistoryIcon from '@mui/icons-material/History';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useContext, useEffect, useMemo, useState } from 'react';
// Navigation Icons
import { useMsalContext } from '@/auth/MsalProvider';
import NavLinkPrefetch from '@/components/NavLinkPrefetch';
import { useFeatureFlags } from '@/config/featureFlags';
import { setCurrentUserRole, useAuthStore } from '@/features/auth/store';
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
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ColorModeContext } from './theme';

type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  prefetchKey?: PrefetchKey;
  prefetchKeys?: PrefetchKey[];
};

const SKIP_LOGIN = shouldSkipLogin();
const E2E_MSAL_MOCK_ENABLED = isE2eMsalMockEnabled();

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { schedules, complianceForm } = useFeatureFlags();
  const { mode, toggle } = useContext(ColorModeContext);
  const dashboardPath = useDashboardPath();
  const currentRole = useAuthStore((s) => s.currentUserRole);

  useEffect(() => {
    if (SKIP_LOGIN && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/admin/dashboard')) {
      setCurrentUserRole('admin');
    } else if (location.pathname === '/' || location.pathname.startsWith('/dashboard')) {
      setCurrentUserRole('staff');
    }
  }, [location.pathname]);

  const navItems = useMemo(() => {
    const items: NavItem[] = [
      {
        label: '黒ノート',
        to: dashboardPath,
        isActive: (pathname) => {
          if (currentRole === 'admin') {
            return pathname.startsWith('/admin/dashboard');
          }
          return pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/records');
        },
        icon: AssignmentTurnedInRoundedIcon,
        prefetchKey: PREFETCH_KEYS.dashboard,
        prefetchKeys: [PREFETCH_KEYS.muiData, PREFETCH_KEYS.muiFeedback],
        testId: 'nav-dashboard',
      },
      {
        label: '分析',
        to: '/analysis/dashboard',
        isActive: (pathname) => pathname.startsWith('/analysis/dashboard'),
        icon: InsightsIcon,
        prefetchKey: PREFETCH_KEYS.analysisDashboard,
        testId: 'nav-analysis',
      },
      {
        label: '氷山分析',
        to: '/analysis/iceberg',
        isActive: (pathname) => pathname.startsWith('/analysis/iceberg'),
        icon: WorkspacesIcon,
        prefetchKey: PREFETCH_KEYS.iceberg,
        testId: 'nav-iceberg',
      },
      {
        label: 'アセスメント',
        to: '/assessment',
        isActive: (pathname) => pathname.startsWith('/assessment'),
        icon: PsychologyIcon,
        prefetchKey: PREFETCH_KEYS.assessmentDashboard,
        testId: 'nav-assessment',
      },
      {
        label: '特性アンケート',
        to: '/survey/tokusei',
        isActive: (pathname) => pathname.startsWith('/survey/tokusei'),
        icon: EditNoteIcon,
      },
      {
        label: '日次記録',
        to: '/daily/activity',
        isActive: (pathname) => pathname.startsWith('/daily'),
        icon: AssignmentTurnedInRoundedIcon,
        prefetchKey: PREFETCH_KEYS.dailyMenu,
        testId: 'nav-daily',
      },
      {
        label: '自己点検',
        to: '/checklist',
        isActive: (pathname) => pathname.startsWith('/checklist'),
        icon: ChecklistRoundedIcon,
        prefetchKey: PREFETCH_KEYS.checklist,
        testId: 'nav-checklist',
      },
      {
        label: '監査ログ',
        to: '/audit',
        isActive: (pathname) => pathname.startsWith('/audit'),
        testId: 'nav-audit',
        icon: AssessmentRoundedIcon,
        prefetchKey: PREFETCH_KEYS.audit,
      },
      {
        label: '利用者',
        to: '/users',
        isActive: (pathname) => pathname.startsWith('/users'),
        icon: PeopleAltRoundedIcon,
        prefetchKey: PREFETCH_KEYS.users,
      },
      {
        label: '職員',
        to: '/staff',
        isActive: (pathname) => pathname.startsWith('/staff'),
        icon: BadgeRoundedIcon,
        prefetchKey: PREFETCH_KEYS.staff,
      },
      {
        label: '設定管理',
        to: '/admin/templates',
        isActive: (pathname) => pathname.startsWith('/admin'),
        icon: SettingsRoundedIcon,
        prefetchKey: PREFETCH_KEYS.adminTemplates,
        prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
        testId: 'nav-admin',
      },
    ];

    if (schedules) {
      items.push({
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: (pathname) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
        testId: 'nav-schedules',
        icon: EventAvailableRoundedIcon,
        prefetchKey: PREFETCH_KEYS.schedulesWeek,
        prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
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

    return items;
  }, [dashboardPath, currentRole, schedules, complianceForm]);

  return (
    <RouteHydrationListener>
      <LiveAnnouncer>
        <div data-testid="app-shell">
        <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            磯子区障害者地域活動ホーム
          </Typography>
          <ConnectionStatus />
          <Tooltip title={mode === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}>
            <IconButton
              color="inherit"
              onClick={toggle}
              aria-label="テーマ切り替え"
              aria-pressed={mode === 'dark' ? 'true' : 'false'}
            >
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          <IconButton component={RouterLink} to="/audit" color="inherit" aria-label="監査ログ">
            <HistoryIcon />
          </IconButton>
          <SignInButton />
        </Toolbar>
        </AppBar>
        <Container component="main" role="main" maxWidth="lg" sx={{ py: 4, pb: { xs: 18, sm: 14 } }}>
        <Box component="nav" role="navigation" aria-label="主要ナビゲーション" mb={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {navItems.map(({ label, to, isActive, testId, icon: IconComponent, prefetchKey, prefetchKeys }) => {
              const active = isActive(location.pathname);
              const sx = {
                minWidth: 'auto',
                px: 2,
                py: 1,
                gap: 1,
                '& .MuiButton-startIcon': {
                  marginRight: '6px',
                  marginLeft: 0,
                },
              } as const;

              if (prefetchKey) {
                return (
                  <Button
                    key={label}
                    component={NavLinkPrefetch as unknown as React.ElementType}
                    to={to}
                    variant={active ? 'contained' : 'outlined'}
                    size="small"
                    data-testid={testId === 'nav-schedules' ? TESTIDS['schedules-nav-link'] : testId}
                    aria-current={active ? 'page' : undefined}
                    startIcon={IconComponent ? <IconComponent /> : undefined}
                    sx={sx}
                    {...({ preloadKey: prefetchKey, preloadKeys: prefetchKeys, meta: { label } } as Record<string, unknown>)}
                  >
                    {label}
                  </Button>
                );
              }

              return (
                <Button
                  key={label}
                  component={RouterLink as unknown as React.ElementType}
                  to={to}
                  variant={active ? 'contained' : 'outlined'}
                  size="small"
                  data-testid={testId}
                  aria-current={active ? 'page' : undefined}
                  startIcon={IconComponent ? <IconComponent /> : undefined}
                  sx={sx}
                >
                  {label}
                </Button>
              );
            })}
          </Stack>
        </Box>
          {children}
        </Container>
        <FooterQuickActions />
      </div>
      </LiveAnnouncer>
    </RouteHydrationListener>
  );
};

const ConnectionStatus: React.FC = () => {
  const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
  const e2eMode = readBool('VITE_E2E', false) && !isVitest;

  if (e2eMode) {
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
  }

  const sharePointDisabled = readBool('VITE_SKIP_SHAREPOINT', false);
  const forceSharePoint = readBool('VITE_FORCE_SHAREPOINT', false);
  const sharePointFeatureEnabled = readBool('VITE_FEATURE_SCHEDULES_SP', false);
  const shouldMockConnection = sharePointDisabled || E2E_MSAL_MOCK_ENABLED;

  if (shouldMockConnection) {
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
  }

  const { spFetch } = useSP();
  const { accounts } = useMsalContext();
  const accountsCount = accounts.length;
  const [state, setState] = useState<'checking' | 'ok' | 'error' | 'signedOut'>('checking');
  const bypassAccountGate = SKIP_LOGIN || E2E_MSAL_MOCK_ENABLED;

  useEffect(() => {
    const { isDev: isDevelopment } = getAppConfig();
    const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
    const shouldCheckSharePoint = !sharePointDisabled && (!isDevelopment || isVitest || forceSharePoint || sharePointFeatureEnabled);

    // Skip SharePoint connectivity checks when disabled via env or flag overrides
    if (!shouldCheckSharePoint) {
      console.info('SharePoint 接続チェックをスキップし、モック状態に設定');
      setState('ok'); // スキップ時は常に OK として扱う
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
  }, [accountsCount, bypassAccountGate, forceSharePoint, sharePointFeatureEnabled, sharePointDisabled, spFetch]);

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

const FooterQuickActions: React.FC = () => {
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
    'daily-attendance': 'footer-action-daily-attendance',
    'daily-activity': 'footer-action-daily-activity',
    'daily-support': TESTIDS['daily-footer-support'],
    'daily-health': TESTIDS['daily-footer-health'],
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
      to: '/daily/activity',
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
    {
      key: 'daily-health',
      label: '健康記録',
      to: '/daily/health',
      color: 'secondary' as const,
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
        position: 'fixed',
        bottom: { xs: 8, sm: 16 },
        left: 0,
        width: '100%',
        pointerEvents: 'none',
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <Container maxWidth="lg" sx={{ pointerEvents: 'auto' }}>
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
              const dataTestId = footerTestIds[key];
              const resolvedTestId = dataTestId && dataTestId in TESTIDS ? TESTIDS[dataTestId as keyof typeof TESTIDS] : dataTestId;
              const commonProps = {
                color,
                size: 'large' as const,
                fullWidth: true,
                sx: { flex: 1, fontWeight: 600 },
                'data-testid': resolvedTestId,
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

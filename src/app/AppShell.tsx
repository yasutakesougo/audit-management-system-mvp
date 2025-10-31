import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import HistoryIcon from '@mui/icons-material/History';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useContext, useEffect, useMemo, useState } from 'react';
// Navigation Icons
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import NavLinkPrefetch from '@/components/NavLinkPrefetch';
import { useFeatureFlags } from '@/config/featureFlags';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';
import { getAppConfig } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { PREFETCH_KEYS, type PrefetchKey } from '@/prefetch/routes';
import SignInButton from '@/ui/components/SignInButton';
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

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { schedules, schedulesCreate, complianceForm } = useFeatureFlags();
  const { mode, toggle } = useContext(ColorModeContext);

  const navItems = useMemo(() => {
    const items: NavItem[] = [
      {
        label: '記録一覧',
        to: '/',
        isActive: (pathname) => pathname === '/' || pathname.startsWith('/records'),
        icon: AssignmentTurnedInRoundedIcon,
        prefetchKey: PREFETCH_KEYS.dashboard,
        prefetchKeys: [PREFETCH_KEYS.muiData, PREFETCH_KEYS.muiFeedback],
        testId: 'nav-dashboard',
      },
      {
        label: '日次記録',
        to: '/daily',
        isActive: (pathname) => pathname.startsWith('/daily'),
        icon: AssignmentTurnedInRoundedIcon,
        prefetchKey: PREFETCH_KEYS.dailyMenu,
      },
      {
        label: '自己点検',
        to: '/checklist',
        isActive: (pathname) => pathname.startsWith('/checklist'),
        icon: ChecklistRoundedIcon,
        prefetchKey: PREFETCH_KEYS.checklist,
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
        to: '/checklist',
        isActive: (pathname) => pathname.startsWith('/compliance'),
        icon: ChecklistRoundedIcon,
      });
    }

    return items;
  }, [schedules, schedulesCreate, complianceForm]);

  return (
    <RouteHydrationListener>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            磯子区障害者地域活動ホーム
          </Typography>
          <ConnectionStatus />
          <Tooltip title={mode === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}>
            <IconButton color="inherit" onClick={toggle} aria-label="テーマ切り替え">
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
                    data-testid={testId}
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
    </RouteHydrationListener>
  );
};

const ConnectionStatus: React.FC = () => {
  const { spFetch } = useSP();
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    const { isDev: isDevelopment } = getAppConfig();
    const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);

    // 開発モード本番ブラウザのみ SharePoint 接続チェックを省略（テストでは実行）
    if (isDevelopment && !isVitest) {
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

  type FooterAction = {
    key: string;
    label: string;
    to: string;
    color: 'primary' | 'secondary' | 'info';
    variant: 'contained' | 'outlined';
  };

  const actions: FooterAction[] = [
    {
      key: 'daily-attendance',
      label: '通所管理',
      to: '/daily/attendance',
      color: 'info' as const,
      variant: 'contained' as const,
    },
    {
      key: 'daily-activity',
      label: '活動日誌入力',
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
      key: 'health-log',
      label: '健康記録',
      to: '/daily/health',
      color: 'secondary' as const,
      variant: 'outlined' as const,
    },
  ] as const;

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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {actions.map(({ key, label, to, color, variant }) => {
              const isActive = location.pathname.startsWith(to);

              return (
                <Button
                  key={key}
                  component={RouterLink as unknown as React.ElementType}
                  to={to}
                  variant={isActive ? 'contained' : variant}
                  color={color}
                  size="large"
                  fullWidth
                  sx={{ flex: 1, fontWeight: 600 }}
                >
                  {label}
                </Button>
              );
            })}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default AppShell;

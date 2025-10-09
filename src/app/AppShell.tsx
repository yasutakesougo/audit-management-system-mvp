import React, { useContext, useEffect, useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Tooltip from '@mui/material/Tooltip';
import HistoryIcon from '@mui/icons-material/History';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Box from '@mui/material/Box';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useFeatureFlags, type FeatureFlagSnapshot } from '@/config/featureFlags';
import SignInButton from '@/ui/components/SignInButton';
import { ColorModeContext } from '@/app/theme';
import { useSP } from '../lib/spClient';

type NavItem = {
  label: string;
  to: string;
  isActive: (path: string) => boolean;
};

const buildNavItems = (flags: FeatureFlagSnapshot): NavItem[] => {
  const { schedules, schedulesCreate, complianceForm } = flags;
  const items: NavItem[] = [
    {
      label: '日次記録',
      to: '/',
      isActive: (path) => path === '/',
    },
    {
      label: '利用者',
      to: '/users',
      isActive: (path) => path.startsWith('/users'),
    },
  ];

  if (schedules) {
    if (schedulesCreate) {
      items.push({
        label: '新規予定',
        to: '/schedules/create',
        isActive: (path) => path.startsWith('/schedules/create'),
      });
    }
    items.push({
      label: 'スケジュール（週表示）',
      to: '/schedules/week',
      isActive: (path) => path.startsWith('/schedules/week'),
    });
    items.push({
      label: 'スケジュール（月表示）',
      to: '/schedules/month',
      isActive: (path) => path.startsWith('/schedules/month'),
    });
  }
  if (complianceForm) {
    items.push({
      label: 'コンプラ報告',
      to: '/compliance',
      isActive: (path) => path.startsWith('/compliance'),
    });
  }

  items.push({
    label: '監査ログ',
    to: '/audit',
    isActive: (path) => path.startsWith('/audit'),
  });

  return items;
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const flags = useFeatureFlags();
  const { mode, toggle } = useContext(ColorModeContext);
  const navItems = useMemo(() => buildNavItems(flags), [flags, location.pathname]);

  return (
    <>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            運営指導・記録管理
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
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box component="nav" aria-label="主要ナビゲーション" role="navigation" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {navItems.map((item) => {
              const active = item.isActive(location.pathname);
              return (
                <Button
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  variant={active ? 'contained' : 'outlined'}
                  size="small"
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Box>
        {children}
      </Container>
    </>
  );
};

const ConnectionStatus: React.FC = () => {
  const { spFetch } = useSP();
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();

    (async () => {
      try {
  const result = await spFetch('/currentuser?$select=Id', { signal: controller.signal });
  if (disposed) return;
  const ok = typeof result === 'object' && result !== null && 'ok' in result && Boolean((result as { ok?: unknown }).ok);
        setState(ok ? 'ok' : 'error');
      } catch (error: unknown) {
        if (disposed) return;
        const name = (error as { name?: string } | null)?.name;
        if (name === 'AbortError') {
          setState('checking');
          return;
        }
        setState('error');
      }
    })();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [spFetch]);

  const { label, background } = (() => {
    switch (state) {
      case 'ok':
        return { label: 'SP Connected', background: '#2e7d32' };
      case 'error':
        return { label: 'SP Error', background: '#d32f2f' };
      default:
        return { label: 'Checking', background: '#ffb300' };
    }
  })();

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
